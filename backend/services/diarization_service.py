"""
Speaker diarization via pyannote.audio.

Diarization runs once per job on the full source audio (not per chunk) so
speaker labels remain consistent across chunk boundaries. Callers intersect
the returned speaker turns with their own chunk windows to label each chunk.

Setup: requires a Hugging Face access token (HF_TOKEN) with the model
license at https://huggingface.co/pyannote/speaker-diarization-3.1 accepted.

The loaded pipeline is cached in-process so subsequent jobs skip the
multi-second model load.
"""

from __future__ import annotations

from dataclasses import dataclass

from config import settings

_pipeline = None


@dataclass(frozen=True)
class SpeakerTurn:
    """A contiguous span where one speaker is talking."""
    start: float
    end: float
    speaker: str


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
    """Run diarization on a full audio file. Returns speaker turns ordered by start time."""
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


def dominant_speaker(turns: list[SpeakerTurn], start: float, end: float) -> str | None:
    """Return the speaker with the most overlap in [start, end), or None if no overlap."""
    if end <= start or not turns:
        return None

    totals: dict[str, float] = {}
    for t in turns:
        overlap = min(t.end, end) - max(t.start, start)
        if overlap > 0:
            totals[t.speaker] = totals.get(t.speaker, 0.0) + overlap

    if not totals:
        return None
    return max(totals, key=totals.get)


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
