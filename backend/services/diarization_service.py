"""Speaker diarization facade.

Picks the best available engine and dispatches to it:

  1. **pyannote** (`diarization_pyannote`) — high quality. Requires HF_TOKEN
     and accepting the model license.
  2. **resemblyzer** (`diarization_resemblyzer`) — lower quality but truly
     local, zero-setup. No token, no license.

Each engine module exposes `is_available()` and `diarize(audio_path)`. This
module holds the shared `SpeakerTurn` type and the `dominant_speaker` helper
that callers use to intersect speaker turns with their own chunk windows.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SpeakerTurn:
    """A contiguous span where one speaker is talking."""
    start: float
    end: float
    speaker: str


# Engine name returned when no engine is available. Used in messages, not the API.
ENGINE_NONE = "none"


def is_available() -> bool:
    """True iff any engine is configured and importable."""
    return engine_name() != ENGINE_NONE


def engine_name() -> str:
    """Returns the name of the engine that would be used, or ENGINE_NONE."""
    from services import diarization_pyannote, diarization_resemblyzer
    if diarization_pyannote.is_available():
        return "pyannote"
    if diarization_resemblyzer.is_available():
        return "resemblyzer"
    return ENGINE_NONE


def diarize(audio_path: str) -> list[SpeakerTurn]:
    """Run diarization with the best available engine."""
    name = engine_name()
    if name == "pyannote":
        from services import diarization_pyannote
        return diarization_pyannote.diarize(audio_path)
    if name == "resemblyzer":
        from services import diarization_resemblyzer
        return diarization_resemblyzer.diarize(audio_path)
    raise RuntimeError(
        "No diarization engine available. Either set HF_TOKEN + accept the "
        "pyannote license, or install resemblyzer."
    )


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
