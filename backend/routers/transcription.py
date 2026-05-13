import asyncio
import math
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from config import settings
from models.schemas import (
    ChunkResult,
    JobStatus,
    ResultResponse,
    StatusResponse,
    TranscribeResponse,
    TranscriptionBackend,
)
from services.audio_processor import (
    check_ffmpeg,
    format_chunk_label,
    probe_duration,
    split_to_chunks,
)

router = APIRouter()

# In-memory job store. Keyed by job_id. Resets on server restart.
_jobs: dict = {}
_jobs_lock = asyncio.Lock()


# ----- Job state helpers -----

def _new_job(job_id: str, total_chunks: int, backend: str, model: Optional[str]) -> dict:
    return {
        "job_id": job_id,
        "status": JobStatus.queued,
        "completed_chunks": 0,
        "total_chunks": total_chunks,
        "current_chunk_label": None,
        "error_message": None,
        "chunks": [],
        "transcript": "",
        "duration_seconds": 0.0,
        "backend": backend,
        "model": model,
        "diarized": False,
    }


async def _update_job(job_id: str, **changes) -> None:
    async with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].update(changes)


async def _append_chunk(job_id: str, chunk: ChunkResult) -> None:
    async with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job["chunks"].append(chunk.model_dump())
        job["completed_chunks"] = len(job["chunks"])
        job["transcript"] = _assemble_transcript(job["chunks"])


def _assemble_transcript(chunks: list[dict]) -> str:
    """Join chunks in index order into one transcript, prefixing each with its speaker if known."""
    ordered = sorted(chunks, key=lambda c: c["index"])
    parts: list[str] = []
    for c in ordered:
        text = c.get("text")
        if not text:
            continue
        speaker = c.get("speaker")
        parts.append(f"{speaker}: {text}" if speaker else text)
    return "\n\n".join(parts)


# ----- Transcription dispatch -----

async def _transcribe_one(
    backend: str,
    chunk_path: str,
    start_sec: float,
    end_sec: float,
    language: str,
    whisper_model: str,
) -> str:
    loop = asyncio.get_running_loop()
    if backend == TranscriptionBackend.whisper_local:
        from services import whisper_service
        return await loop.run_in_executor(
            None, whisper_service.transcribe_chunk, chunk_path, whisper_model, language,
        )
    if backend == TranscriptionBackend.whisper_api:
        from services import openai_service
        return await openai_service.transcribe_chunk(chunk_path, language)
    if backend == TranscriptionBackend.google_cloud:
        from services import google_stt_service
        return await loop.run_in_executor(
            None, google_stt_service.transcribe_chunk, chunk_path, language, end_sec - start_sec,
        )
    raise ValueError(f"Backend not handled in dispatch: {backend}")


async def _process_chunk(
    job_id: str,
    index: int,
    chunk_path: str,
    start_sec: float,
    end_sec: float,
    backend: str,
    language: str,
    whisper_model: str,
    sem: asyncio.Semaphore,
) -> None:
    label = format_chunk_label(start_sec, end_sec)
    async with sem:
        await _update_job(job_id, current_chunk_label=label)
        try:
            text = await _transcribe_one(
                backend, chunk_path, start_sec, end_sec, language, whisper_model,
            )
        except Exception as e:
            text = f"[error: {e}]"
        await _append_chunk(
            job_id,
            ChunkResult(
                index=index,
                label=label,
                text=text,
                start_seconds=start_sec,
                end_seconds=end_sec,
            ),
        )


def _concurrency_for(backend: str) -> int:
    """Local Whisper is sequential (single GPU/CPU model); APIs can parallelize."""
    if backend == TranscriptionBackend.whisper_local:
        return 1
    return max(1, settings.max_concurrent_chunks)


async def _apply_diarization(job_id: str, file_path: str) -> None:
    """Run diarization on the full source file and tag each chunk with its dominant speaker.

    The diarize call itself is offloaded to a thread (it's CPU-heavy and blocks the
    event loop otherwise). Speaker assignment + transcript reassembly run inside
    the job lock so they're atomic with respect to concurrent status reads.
    """
    from services import diarization_service

    await _update_job(job_id, current_chunk_label="detecting speakers…")
    turns = await asyncio.to_thread(diarization_service.diarize, file_path)

    async with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return
        for c in job["chunks"]:
            speaker = diarization_service.dominant_speaker(
                turns, c["start_seconds"], c["end_seconds"],
            )
            if speaker:
                c["speaker"] = speaker
        job["transcript"] = _assemble_transcript(job["chunks"])
        job["diarized"] = True


async def _run_job(
    job_id: str,
    file_path: str,
    chunk_dir: str,
    backend: str,
    chunk_duration: int,
    language: str,
    whisper_model: str,
    duration_seconds: float,
    diarize: bool,
):
    try:
        await _update_job(
            job_id,
            status=JobStatus.processing,
            duration_seconds=duration_seconds,
        )

        chunks = await asyncio.to_thread(
            split_to_chunks, file_path, chunk_dir, chunk_duration, duration_seconds,
        )
        await _update_job(job_id, total_chunks=len(chunks))

        sem = asyncio.Semaphore(_concurrency_for(backend))
        await asyncio.gather(
            *[
                _process_chunk(
                    job_id, i, path, start, end,
                    backend, language, whisper_model, sem,
                )
                for i, (path, start, end) in enumerate(chunks)
            ]
        )

        if diarize:
            try:
                await _apply_diarization(job_id, file_path)
            except Exception as e:
                await _update_job(
                    job_id,
                    error_message=f"Diarization skipped: {e}",
                )

        await _update_job(job_id, status=JobStatus.done, current_chunk_label=None)

    except Exception as e:
        await _update_job(job_id, status=JobStatus.error, error_message=str(e))


# ----- Endpoints -----

@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    backend: str = Form("whisper_local"),
    chunk_duration: int = Form(60),
    language: str = Form("auto"),
    whisper_model: str = Form("base"),
    diarize: bool = Form(False),
):
    if backend == TranscriptionBackend.web_speech:
        raise HTTPException(
            status_code=400,
            detail="web_speech backend runs entirely in the browser; do not POST to /transcribe",
        )

    if not check_ffmpeg():
        raise HTTPException(status_code=500, detail="ffmpeg/ffprobe not found on PATH")

    if diarize:
        from services import diarization_service
        if not diarization_service.is_available():
            raise HTTPException(
                status_code=400,
                detail="Speaker detection unavailable: set HF_TOKEN and accept the pyannote model license.",
            )

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    job_id = str(uuid.uuid4())

    job_dir = Path(settings.temp_dir) / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(file.filename).suffix if file.filename else ".audio"
    file_path = str(job_dir / f"original{suffix}")

    bytes_written = 0
    try:
        with open(file_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                bytes_written += len(chunk)
                if bytes_written > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds max size of {settings.max_upload_size_mb}MB",
                    )
                f.write(chunk)
    except HTTPException:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise

    try:
        duration = probe_duration(file_path)
    except Exception as e:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=f"Could not read audio file: {e}")

    chunk_dir = str(job_dir / "chunks")
    total_chunks = 1 if chunk_duration <= 0 else max(1, math.ceil(duration / chunk_duration))

    async with _jobs_lock:
        _jobs[job_id] = _new_job(job_id, total_chunks, backend, whisper_model)
        _jobs[job_id]["duration_seconds"] = duration

    background_tasks.add_task(
        _run_job,
        job_id, file_path, chunk_dir,
        backend, chunk_duration, language, whisper_model,
        duration, diarize,
    )

    return TranscribeResponse(
        job_id=job_id,
        total_chunks=total_chunks,
        status=JobStatus.queued,
    )


@router.get("/status/{job_id}", response_model=StatusResponse)
async def get_status(job_id: str):
    async with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    total = job["total_chunks"]
    completed = job["completed_chunks"]
    progress = (completed / total * 100) if total > 0 else 0.0

    return StatusResponse(
        job_id=job_id,
        status=job["status"],
        completed_chunks=completed,
        total_chunks=total,
        current_chunk_label=job["current_chunk_label"],
        error_message=job["error_message"],
        progress_percent=round(progress, 1),
    )


@router.get("/result/{job_id}", response_model=ResultResponse)
async def get_result(job_id: str):
    async with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] not in (JobStatus.done, JobStatus.error):
        raise HTTPException(status_code=202, detail="Job not complete yet")

    ordered = sorted(job["chunks"], key=lambda c: c["index"])
    return ResultResponse(
        job_id=job_id,
        status=job["status"],
        transcript=job["transcript"],
        chunks=[ChunkResult(**c) for c in ordered],
        duration_seconds=job["duration_seconds"],
        backend=job["backend"],
        model=job["model"],
        diarized=job.get("diarized", False),
    )


@router.delete("/job/{job_id}")
async def delete_job(job_id: str):
    async with _jobs_lock:
        job = _jobs.pop(job_id, None)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    job_dir = Path(settings.temp_dir) / job_id
    if job_dir.exists():
        shutil.rmtree(str(job_dir), ignore_errors=True)

    return {"detail": "Job deleted"}
