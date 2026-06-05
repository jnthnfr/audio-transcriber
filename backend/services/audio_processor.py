"""
Audio probing and chunk splitting via FFmpeg.

All chunks are produced as 16kHz mono PCM WAV — the optimal input format for
all supported STT engines (Whisper, OpenAI API, Google Cloud STT).

Splitting uses FFmpeg's segment muxer in a single pass, which decodes the
source once instead of N times. For an 8-minute file split into 30-second
chunks (16 chunks), this is roughly 16x faster than per-chunk ffmpeg calls.
"""

from __future__ import annotations

import glob
import json
import shutil
import subprocess
from pathlib import Path
from typing import List, Tuple

ChunkSpec = Tuple[str, float, float]  # (path, start_sec, end_sec)


def check_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def probe_duration(file_path: str) -> float:
    """Return audio duration in seconds via ffprobe."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            file_path,
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr.strip()}")
    return float(json.loads(result.stdout)["format"]["duration"])


def trim(input_path: str, out_path: str, start_sec: float, end_sec: float | None) -> float:
    """Clip `input_path` to [start_sec, end_sec) and write to out_path.

    Returns the duration of the trimmed clip in seconds. The output keeps the
    source codec/format — re-encoding to wav happens later during chunk split.
    """
    if start_sec < 0:
        raise ValueError("start_sec must be >= 0")
    if end_sec is not None and end_sec <= start_sec:
        raise ValueError("end_sec must be > start_sec")

    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-ss", str(start_sec),
        "-i", input_path,
    ]
    if end_sec is not None:
        cmd += ["-to", str(end_sec - start_sec)]
    cmd += ["-c", "copy", out_path]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        # Stream-copy can fail if the codec doesn't allow mid-keyframe cuts.
        # Fall back to re-encoding the clipped range.
        fallback = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-ss", str(start_sec),
            "-i", input_path,
        ]
        if end_sec is not None:
            fallback += ["-to", str(end_sec - start_sec)]
        fallback += [out_path]
        result = subprocess.run(fallback, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg trim failed: {result.stderr.strip()}")

    return probe_duration(out_path)


def _convert_full(input_path: str, out_path: str) -> None:
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", input_path,
            "-ar", "16000", "-ac", "1",
            "-f", "wav",
            out_path,
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg conversion failed: {result.stderr.strip()}")


def _segment_split(input_path: str, out_dir: Path, chunk_duration: int) -> None:
    """Single-pass split into fixed-duration WAV segments using FFmpeg's segment muxer."""
    pattern = str(out_dir / "chunk_%03d.wav")
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", input_path,
            "-ar", "16000", "-ac", "1",
            "-f", "segment",
            "-segment_time", str(chunk_duration),
            "-reset_timestamps", "1",
            "-c:a", "pcm_s16le",
            pattern,
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg segment split failed: {result.stderr.strip()}")


def split_to_chunks(
    input_path: str,
    output_dir: str,
    chunk_duration: int,
    total_duration: float | None = None,
) -> List[ChunkSpec]:
    """
    Split audio into 16kHz mono PCM WAV chunks.

    Returns a list of (path, start_sec, end_sec) tuples ordered by start time.
    If `chunk_duration == 0`, the file is converted as a single chunk.
    `total_duration` may be passed in to skip a duplicate ffprobe call.
    """
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if total_duration is None:
        total_duration = probe_duration(input_path)

    if chunk_duration <= 0:
        single = str(out_dir / "chunk_000.wav")
        _convert_full(input_path, single)
        return [(single, 0.0, total_duration)]

    _segment_split(input_path, out_dir, chunk_duration)

    chunk_files = sorted(glob.glob(str(out_dir / "chunk_*.wav")))
    if not chunk_files:
        raise RuntimeError("ffmpeg produced no chunk files")

    chunks: List[ChunkSpec] = []
    for i, path in enumerate(chunk_files):
        start = i * chunk_duration
        end = min(start + chunk_duration, total_duration)
        chunks.append((path, float(start), float(end)))
    return chunks


def format_chunk_label(start_sec: float, end_sec: float) -> str:
    def fmt(s: float) -> str:
        m, sec = divmod(int(s), 60)
        return f"{m}:{sec:02d}"
    return f"{fmt(start_sec)}–{fmt(end_sec)}"
