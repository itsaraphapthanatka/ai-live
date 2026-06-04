"""Facebook Live API Service — สร้าง/จบ Live Video อัตโนมัติ"""
import logging
import httpx
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)
GRAPH = "https://graph.facebook.com/v19.0"


def oauth_url(redirect_uri: str, state: str = "") -> str:
    return oauth_url_with_id(settings.FACEBOOK_APP_ID, redirect_uri, state)

def oauth_url_with_id(app_id: str, redirect_uri: str, state: str = "") -> str:
    """สร้าง URL สำหรับ Facebook OAuth"""
    # สิทธิ์ขั้นต่ำสำหรับ Live Video API
    # pages_show_list  — ดูรายการ Pages ที่จัดการอยู่
    # pages_manage_posts — สร้าง Live Video บน Page
    # publish_video   — สำหรับบาง app type ที่ต้องการ
    scopes = ",".join([
        "pages_show_list",
        "pages_manage_posts",
    ])
    return (
        f"https://www.facebook.com/v19.0/dialog/oauth"
        f"?client_id={app_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scopes}"
        f"&response_type=code"
        f"&state={state}"
    )


async def exchange_code(code: str, redirect_uri: str) -> dict:
    return await exchange_code_with_creds(code, redirect_uri, settings.FACEBOOK_APP_ID, settings.FACEBOOK_APP_SECRET)

async def exchange_code_with_creds(code: str, redirect_uri: str, app_id: str, app_secret: str) -> dict:
    """แลก authorization code เป็น access token"""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{GRAPH}/oauth/access_token", params={
            "client_id": app_id, "client_secret": app_secret,
            "redirect_uri": redirect_uri, "code": code,
        }, timeout=15)
        r.raise_for_status()
        return r.json()


async def get_long_lived_token(short_token: str) -> str:
    return await get_long_lived_token_with_creds(short_token, settings.FACEBOOK_APP_ID, settings.FACEBOOK_APP_SECRET)

async def get_long_lived_token_with_creds(short_token: str, app_id: str, app_secret: str) -> str:
    """แปลง short-lived token เป็น long-lived (60 วัน)"""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{GRAPH}/oauth/access_token", params={
            "grant_type": "fb_exchange_token",
            "client_id": app_id, "client_secret": app_secret,
            "fb_exchange_token": short_token,
        }, timeout=15)
        return r.json().get("access_token", short_token)


async def get_pages(user_token: str) -> list[dict]:
    """ดึงรายการ Pages ที่ user จัดการ"""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{GRAPH}/me/accounts", params={
            "access_token": user_token,
            "fields": "id,name,access_token",
        }, timeout=15)
        r.raise_for_status()
        return r.json().get("data", [])


async def create_live_video(page_token: str, page_id: str, title: str, description: str = "") -> dict:
    """
    สร้าง Facebook Live Video และรับ RTMP URL
    Returns: {id, stream_url, secure_stream_url, dashboard_url}
    """
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{GRAPH}/{page_id}/live_videos", params={
            "access_token": page_token,
        }, json={
            "title": title,
            "description": description,
            "status": "LIVE_NOW",
        }, timeout=20)
        data = r.json()
        if "error" in data:
            raise Exception(f"Facebook API error: {data['error']['message']}")
        return {
            "id": data["id"],
            "stream_url": data.get("stream_url") or data.get("secure_stream_url"),
            "secure_stream_url": data.get("secure_stream_url"),
            "dashboard_url": f"https://www.facebook.com/live/producer?stream_id={data['id']}",
        }


async def end_live_video(page_token: str, live_video_id: str) -> bool:
    """จบ Facebook Live Video"""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{GRAPH}/{live_video_id}", params={
                "access_token": page_token,
            }, json={"end_live_video": True}, timeout=15)
            return r.status_code == 200
    except Exception as e:
        logger.error(f"[Facebook] end live error: {e}")
        return False


async def get_live_comments(page_token: str, live_video_id: str, since: Optional[str] = None) -> list[dict]:
    """ดึง comment จาก Facebook Live"""
    params: dict = {
        "access_token": page_token,
        "fields": "from{name},message,created_time",
        "limit": 50,
    }
    if since:
        params["since"] = since
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{GRAPH}/{live_video_id}/comments", params=params, timeout=10)
        data = r.json()
        return data.get("data", [])
