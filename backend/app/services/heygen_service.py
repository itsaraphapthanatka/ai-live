import httpx
from app.config import settings

HEYGEN_BASE = "https://api.heygen.com"


def _headers() -> dict:
    return {
        "X-Api-Key": settings.HEYGEN_API_KEY,
        "Content-Type": "application/json",
    }


async def generate_avatar_video(script: str, avatar_id: str, voice_id: str) -> str:
    """Submit a HeyGen video generation job. Returns video_id."""
    payload = {
        "video_inputs": [
            {
                "character": {
                    "type": "avatar",
                    "avatar_id": avatar_id,
                    "avatar_style": "normal",
                },
                "voice": {
                    "type": "text",
                    "input_text": script[:1500],  # HeyGen limit per clip
                    "voice_id": voice_id,
                },
            }
        ],
        "dimension": {"width": 1280, "height": 720},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{HEYGEN_BASE}/v2/video/generate",
            json=payload,
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        return data["data"]["video_id"]


async def get_video_status(video_id: str) -> dict:
    """
    Check HeyGen video status.
    Returns dict with keys: status, video_url (when completed)
    status values: "processing" | "completed" | "failed"
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{HEYGEN_BASE}/v1/video_status.get",
            params={"video_id": video_id},
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        error = data.get("error")
        return {
            "status": data.get("status", "processing"),
            "video_url": data.get("video_url"),
            "thumbnail_url": data.get("thumbnail_url"),
            "error": error.get("detail") or error.get("message") if error else None,
        }


async def list_avatars() -> list:
    """List available HeyGen avatars."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{HEYGEN_BASE}/v2/avatars",
            headers=_headers(),
        )
        resp.raise_for_status()
        return resp.json().get("data", {}).get("avatars", [])


async def list_voices() -> list:
    """List available HeyGen voices."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{HEYGEN_BASE}/v2/voices",
            headers=_headers(),
        )
        resp.raise_for_status()
        return resp.json().get("data", {}).get("voices", [])
