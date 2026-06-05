"""Resemblyzer + agglomerative clustering diarization engine.

Zero-setup local diarization: no HF token, no model download UI step (the
small voice encoder ships with the resemblyzer package). Trades accuracy
for simplicity — expect more speaker-swap errors than pyannote, especially
with similar-sounding voices, but it works fully offline.

Algorithm:
  1. Slide a ~1.6s window over the audio, computing a 256-d voice embedding
     per window (resemblyzer's VoiceEncoder).
  2. Estimate the number of speakers via silhouette score over n=2..4
     (fall back to 1 if silhouette stays below `_SINGLE_SPEAKER_THRESHOLD`).
  3. Cluster the embeddings with agglomerative clustering at the chosen n.
  4. Collapse consecutive same-label windows into SpeakerTurns.

The encoder is cached in-process after first load.
"""

from __future__ import annotations

from services.diarization_service import SpeakerTurn

_encoder = None

# Silhouette below this value means we can't separate speakers — treat as one.
_SINGLE_SPEAKER_THRESHOLD = 0.10
_MAX_SPEAKERS = 4
_SAMPLE_RATE = 16000


def is_available() -> bool:
    """True iff resemblyzer + scikit-learn are installed."""
    try:
        import resemblyzer  # noqa: F401
        import sklearn  # noqa: F401
    except ImportError:
        return False
    return True


def diarize(audio_path: str, num_speakers: int | None = None) -> list[SpeakerTurn]:
    """Run diarization. If `num_speakers` is None, estimates it via silhouette score."""
    from resemblyzer import preprocess_wav

    wav = preprocess_wav(audio_path)
    _, partial_embeds, wav_splits = _encoder_singleton().embed_utterance(
        wav, return_partials=True, rate=16,
    )

    if len(partial_embeds) == 0:
        return []

    n = num_speakers if num_speakers else _estimate_num_speakers(partial_embeds)
    if n <= 1:
        labels = [0] * len(partial_embeds)
    else:
        from sklearn.cluster import AgglomerativeClustering
        labels = AgglomerativeClustering(n_clusters=n).fit_predict(partial_embeds).tolist()

    return _windows_to_turns(labels, wav_splits)


def _encoder_singleton():
    global _encoder
    if _encoder is None:
        from resemblyzer import VoiceEncoder
        _encoder = VoiceEncoder()
    return _encoder


def _estimate_num_speakers(embeds) -> int:
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics import silhouette_score

    if len(embeds) < 4:
        return 1

    best_n, best_score = 1, -1.0
    for n in range(2, min(_MAX_SPEAKERS, len(embeds)) + 1):
        labels = AgglomerativeClustering(n_clusters=n).fit_predict(embeds)
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(embeds, labels)
        if score > best_score:
            best_score, best_n = score, n

    return best_n if best_score >= _SINGLE_SPEAKER_THRESHOLD else 1


def _windows_to_turns(labels: list[int], wav_splits) -> list[SpeakerTurn]:
    """Collapse consecutive same-label windows into SpeakerTurns."""
    turns: list[SpeakerTurn] = []
    cur_label = labels[0]
    cur_start = float(wav_splits[0].start) / _SAMPLE_RATE
    cur_end = float(wav_splits[0].stop) / _SAMPLE_RATE

    for i in range(1, len(labels)):
        win_start = float(wav_splits[i].start) / _SAMPLE_RATE
        win_end = float(wav_splits[i].stop) / _SAMPLE_RATE
        if labels[i] == cur_label:
            cur_end = win_end
        else:
            turns.append(SpeakerTurn(cur_start, cur_end, f"SPEAKER_{cur_label:02d}"))
            cur_label = labels[i]
            cur_start = win_start
            cur_end = win_end

    turns.append(SpeakerTurn(cur_start, cur_end, f"SPEAKER_{cur_label:02d}"))
    return turns
