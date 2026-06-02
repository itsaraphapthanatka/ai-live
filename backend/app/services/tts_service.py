from openai import AsyncOpenAI
from app.config import settings
import base64

_client = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


VOICE_OPTIONS = {
    "alloy": "Alloy (Middle, Neutral)",
    "echo": "Echo (Male, Deep)",
    "fable": "Fable (Male, Expressive)",
    "onyx": "Onyx (Male, Authoritative)",
    "nova": "Nova (Female, Energetic)",
    "shimmer": "Shimmer (Female, Soft)",
}


async def text_to_speech(text: str, voice: str = "nova") -> bytes:
    """Convert text to speech using OpenAI TTS. Returns audio bytes (mp3)."""
    client = get_openai_client()

    if voice not in VOICE_OPTIONS:
        voice = "nova"

    # Trim text if too long (OpenAI TTS limit)
    if len(text) > 4096:
        text = text[:4096]

    response = await client.audio.speech.create(
        model="tts-1",
        voice=voice,
        input=text,
        response_format="mp3",
    )

    return await response.aread()


async def text_to_speech_base64(text: str, voice: str = "nova") -> str:
    """Convert text to speech, return as base64 data URL for browser playback."""
    audio_bytes = await text_to_speech(text, voice)
    b64 = base64.b64encode(audio_bytes).decode("utf-8")
    return f"data:audio/mpeg;base64,{b64}"
