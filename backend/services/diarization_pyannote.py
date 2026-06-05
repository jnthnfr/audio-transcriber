"""pyannote.audio diarization engine.

Higher-quality speaker turns from a transformer-based pipeline. Requires a
Hugging Face access token (HF_TOKEN) with the pyannote/speaker-diarization-3.1
license accepted at https://huggingface.co/pyannote/speaker-diarization-3.1.

The loaded pipeline is cached in-process so subsequent jobs skip the
multi-second model load.
"""

from __future__ import annotations

from config import settings
from services.diarization_service import SpeakerTurn

_pipeline = None


def is_available() -> bool:
    """True iff pyannote is importable and an HF token is configured."""
    if not settings.hf_token.strip():
        return False
    try:
        import pyannote.audio  # noqa: F401
    except ImportError:
        return False
    return True


def diarize(audio_path: str) -> list[SpeakerTurn]:
    annotation = _pipeline_singleton()(audio_path)
    turns = [
        SpeakerTurn(
            start=float(segment.start),
            end=float(segment.end),
            speaker=str(speaker),
        )
        for segment, _, speaker in annotation.itertracks(yield_label=True)
    ]
    turns.sort(key=lambda t: t.start)
    return turns


def _pipeline_singleton():
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    from pyannote.audio import Pipeline

    _pipeline = Pipeline.from_pretrained(
        settings.diarization_model,
        use_auth_token=settings.hf_token,
    )
    if _pipeline is None:
        raise RuntimeError(
            f"Failed to load diarization pipeline '{settings.diarization_model}'. "
            "Check that HF_TOKEN is valid and that the model license has been accepted."
        )
    return _pipeline
