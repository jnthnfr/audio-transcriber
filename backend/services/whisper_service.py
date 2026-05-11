import whisper
from config import settings

_model_cache: dict = {}


def get_model(model_name: str):
    if model_name not in _model_cache:
        _model_cache[model_name] = whisper.load_model(
            model_name,
            download_root=settings.whisper_cache_dir
        )
    return _model_cache[model_name]


def transcribe_chunk(chunk_path: str, model_name: str, language: str) -> str:
    """Transcribe a single WAV chunk using local Whisper."""
    model = get_model(model_name)
    options = {}
    if language and language.lower() != "auto":
        options["language"] = language
    result = model.transcribe(chunk_path, **options)
    return result["text"].strip()
