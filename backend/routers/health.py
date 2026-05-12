import os
from pathlib import Path

from fastapi import APIRouter

from config import settings
from models.schemas import HealthResponse
from services.audio_processor import check_ffmpeg

router = APIRouter()


def _check_whisper_local() -> bool:
    try:
        import whisper  # noqa: F401
        return True
    except ImportError:
        return False


def _check_whisper_api() -> bool:
    return bool(settings.openai_api_key.strip())


def _check_google_cloud() -> bool:
    try:
        from google.cloud import speech  # noqa: F401
    except ImportError:
        return False
    creds = settings.google_application_credentials or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    return bool(creds) and Path(creds).is_file()


def _check_diarization() -> bool:
    from services import diarization_service
    return diarization_service.is_available()


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        ffmpeg_available=check_ffmpeg(),
        whisper_local=_check_whisper_local(),
        whisper_api=_check_whisper_api(),
        google_cloud=_check_google_cloud(),
        web_speech=True,  # Browser-side; always reported as available
        diarization=_check_diarization(),
    )
