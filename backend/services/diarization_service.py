"""
Speaker diarization via pyannote.audio.

Runs once per job on the full source audio (not per-chunk) so speaker IDs
remain consistent across chunk boundaries. Returns a list of speaker turns
that callers can intersect with their chunk windows to assign labels.

Model + token: requires a Hugging Face access token with the
`pyannote/speaker-diarization-3.1` license accepted. The pipeline is cached
in-process after first load.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from config import settings

_pipeline = None


@dataclass
class SpeakerTurn:
    start: float
    end: float
    speaker: str


def is_available() -> bool:
    """True iff the diarization dependency is installed and a token is configured."""
    if not settings.hf_token.strip():
        return False
    try:
        import pyannote.audio  # noqa: F401
        return True
    except ImportError:
        return False


def _get_pipeline():
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
            "Failed to load diarization pipeline. Check that HF_TOKEN is valid "
            f"and that the {settings.diarization_model} license has been accepted."
        )
    return _pipeline


def diarize(audio_path: str) -> List[SpeakerTurn]:
    """Run diarization on a full audio file. Returns speaker turns ordered by start time."""
    pipeline = _get_pipeline()
    annotation = pipeline(audio_path)

    turns: List[SpeakerTurn] = []
    for segment, _, speaker in annotation.itertracks(yield_label=True):
        turns.append(SpeakerTurn(start=float(segment.start), end=float(segment.end), speaker=str(speaker)))
    turns.sort(key=lambda t: t.start)
    return turns


def dominant_speaker(turns: List[SpeakerTurn], start: float, end: float) -> Optional[str]:
    """Return the speaker with the most overlap in [start, end), or None if no overlap."""
    if end <= start or not turns:
        return None

    totals: dict[str, float] = {}
    for t in turns:
        if t.end <= start or t.start >= end:
            continue
        overlap = min(t.end, end) - max(t.start, start)
        if overlap > 0:
            totals[t.speaker] = totals.get(t.speaker, 0.0) + overlap

    if not totals:
        return None
    return max(totals.items(), key=lambda kv: kv[1])[0]
