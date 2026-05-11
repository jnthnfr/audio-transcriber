import os
from google.cloud import speech
from config import settings

if settings.google_application_credentials:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.google_application_credentials


def _get_client():
    return speech.SpeechClient()


def transcribe_chunk(chunk_path: str, language: str, duration_seconds: float) -> str:
    """
    Transcribe a WAV chunk via Google Cloud Speech-to-Text.
    Uses long_running_recognize for chunks > 60 seconds.
    """
    client = _get_client()

    lang_code = language if language.lower() != "auto" else "en-US"

    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        audio_channel_count=1,
        language_code=lang_code,
        enable_automatic_punctuation=True,
    )

    with open(chunk_path, "rb") as f:
        audio_content = f.read()

    audio = speech.RecognitionAudio(content=audio_content)

    if duration_seconds <= 60:
        response = client.recognize(config=config, audio=audio)
        return " ".join(
            result.alternatives[0].transcript
            for result in response.results
            if result.alternatives
        ).strip()
    else:
        operation = client.long_running_recognize(config=config, audio=audio)
        response = operation.result(timeout=300)
        return " ".join(
            result.alternatives[0].transcript
            for result in response.results
            if result.alternatives
        ).strip()
