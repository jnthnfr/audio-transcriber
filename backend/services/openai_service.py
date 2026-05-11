import asyncio
from openai import AsyncOpenAI
from config import settings

_client = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def transcribe_chunk(chunk_path: str, language: str) -> str:
    """Transcribe a single WAV chunk via OpenAI Whisper API."""
    client = get_client()
    with open(chunk_path, "rb") as f:
        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            language=language if language.lower() != "auto" else None,
        )
    # Rate-limit buffer
    await asyncio.sleep(0.5)
    return response.text.strip()
