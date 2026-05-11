from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class TranscriptionBackend(str, Enum):
    whisper_local = "whisper_local"
    whisper_api = "whisper_api"
    google_cloud = "google_cloud"
    web_speech = "web_speech"


class WhisperModel(str, Enum):
    tiny = "tiny"
    base = "base"
    small = "small"
    medium = "medium"
    large = "large"


class JobStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    done = "done"
    error = "error"


class TranscribeResponse(BaseModel):
    job_id: str
    total_chunks: int
    status: JobStatus


class StatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    completed_chunks: int
    total_chunks: int
    current_chunk_label: Optional[str] = None
    error_message: Optional[str] = None
    progress_percent: float = 0.0


class ChunkResult(BaseModel):
    index: int
    label: str
    text: str
    start_seconds: float
    end_seconds: float


class ResultResponse(BaseModel):
    job_id: str
    status: JobStatus
    transcript: str
    chunks: List[ChunkResult]
    duration_seconds: float
    backend: str
    model: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    ffmpeg_available: bool
    whisper_local: bool
    whisper_api: bool
    google_cloud: bool
    web_speech: bool
