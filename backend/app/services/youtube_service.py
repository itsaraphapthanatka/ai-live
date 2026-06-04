"""YouTube Live API Service — สร้าง/จบ Live Broadcast อัตโนมัติ"""
import logging
import httpx
from datetime import datetime, timedelta
from app.config import settings

logger = logging.getLogger(__name__)
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
YT_API = "https://www.googleapis.com/youtube/v3"


def oauth_url(redirect_uri: str, state: str = "") -> str:
    return oauth_url_with_id(settings.YOUTUBE_CLIENT_ID, redirect_uri, state)

def oauth_url_with_id(client_id: str, redirect_uri: str, state: str = "") -> str:
    """สร้าง URL สำหรับ Google OAuth"""
    scopes = " ".join([
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.force-ssl",
    ])
    return (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scopes}"
        f"&response_type=code"
        f"&access_type=offline"
        f"&prompt=consent"
        f"&state={state}"
    )


async def exchange_code(code: str, redirect_uri: str) -> dict:
    return await exchange_code_with_creds(code, redirect_uri, settings.YOUTUBE_CLIENT_ID, settings.YOUTUBE_CLIENT_SECRET)

async def exchange_code_with_creds(code: str, redirect_uri: str, client_id: str, client_secret: str) -> dict:
    """แลก code เป็น tokens"""
    async with httpx.AsyncClient() as client:
        r = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code, "client_id": client_id, "client_secret": client_secret,
            "redirect_uri": redirect_uri, "grant_type": "authorization_code",
        }, timeout=15)
        r.raise_for_status()
        return r.json()


async def refresh_access_token(refresh_token: str) -> dict:
    """Refresh expired access token"""
    async with httpx.AsyncClient() as client:
        r = await client.post(GOOGLE_TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": settings.YOUTUBE_CLIENT_ID,
            "client_secret": settings.YOUTUBE_CLIENT_SECRET,
            "grant_type": "refresh_token",
        }, timeout=15)
        r.raise_for_status()
        return r.json()


async def get_channel_info(access_token: str) -> dict:
    """ดึงข้อมูล YouTube channel"""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{YT_API}/channels", params={
            "part": "snippet",
            "mine": "true",
        }, headers={"Authorization": f"Bearer {access_token}"}, timeout=15)
        items = r.json().get("items", [])
        if not items:
            return {}
        ch = items[0]
        return {"id": ch["id"], "title": ch["snippet"]["title"]}


async def create_broadcast(access_token: str, title: str, description: str = "") -> dict:
    """
    สร้าง YouTube Live Broadcast + LiveStream แล้วรับ RTMP URL
    Returns: {broadcast_id, stream_id, rtmp_url, stream_key}
    """
    scheduled_start = (datetime.utcnow() + timedelta(seconds=10)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient() as client:
        # 1. สร้าง LiveBroadcast
        br = await client.post(f"{YT_API}/liveBroadcasts", params={"part": "snippet,status,contentDetails"},
            headers=headers,
            json={
                "snippet": {
                    "title": title,
                    "description": description,
                    "scheduledStartTime": scheduled_start,
                },
                "status": {"privacyStatus": "public"},
                "contentDetails": {"enableAutoStart": True, "enableAutoStop": True},
            }, timeout=20)
        br_data = br.json()
        if "error" in br_data:
            raise Exception(f"YouTube broadcast error: {br_data['error']['message']}")
        broadcast_id = br_data["id"]

        # 2. สร้าง LiveStream
        ls = await client.post(f"{YT_API}/liveStreams", params={"part": "snippet,cdn"},
            headers=headers,
            json={
                "snippet": {"title": title},
                "cdn": {
                    "frameRate": "30fps",
                    "ingestionType": "rtmp",
                    "resolution": "720p",
                },
            }, timeout=20)
        ls_data = ls.json()
        if "error" in ls_data:
            raise Exception(f"YouTube stream error: {ls_data['error']['message']}")
        stream_id = ls_data["id"]
        ingestion = ls_data["cdn"]["ingestionInfo"]
        rtmp_url = ingestion["ingestionAddress"]
        stream_key = ingestion["streamName"]

        # 3. Bind broadcast กับ stream
        await client.post(f"{YT_API}/liveBroadcasts/bind",
            params={"id": broadcast_id, "part": "id,contentDetails", "streamId": stream_id},
            headers=headers, timeout=20)

    return {
        "broadcast_id": broadcast_id,
        "stream_id": stream_id,
        "rtmp_url": rtmp_url,
        "stream_key": stream_key,
        "full_rtmp": f"{rtmp_url}/{stream_key}",
        "watch_url": f"https://www.youtube.com/watch?v={broadcast_id}",
    }


async def transition_broadcast(access_token: str, broadcast_id: str, status: str = "live") -> bool:
    """เปลี่ยนสถานะ broadcast: testing | live | complete"""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{YT_API}/liveBroadcasts/transition",
                params={"broadcastStatus": status, "id": broadcast_id, "part": "status"},
                headers={"Authorization": f"Bearer {access_token}"}, timeout=15)
            return r.status_code == 200
    except Exception as e:
        logger.error(f"[YouTube] transition error: {e}")
        return False


async def end_broadcast(access_token: str, broadcast_id: str) -> bool:
    """จบ YouTube Live"""
    return await transition_broadcast(access_token, broadcast_id, "complete")
