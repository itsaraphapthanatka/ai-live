"""Platform connections — Facebook & YouTube OAuth + Auto-start Live"""
import asyncio
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.platform import PlatformConnection
from app.config import settings
from app.services import facebook_service, youtube_service
from app.routers.platform_config import get_company_config

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/platforms", tags=["platforms"])

BACKEND_URL = "http://localhost:8000"


# ─── helpers ────────────────────────────────────────────────────────

def _redirect_uri(platform: str) -> str:
    return f"{BACKEND_URL}/platforms/{platform}/callback"


async def _get_conn(db: AsyncSession, company_id: int, platform: str) -> Optional[PlatformConnection]:
    res = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.company_id == company_id,
            PlatformConnection.platform == platform,
        )
    )
    return res.scalar_one_or_none()


# ─── List connected platforms ────────────────────────────────────────

@router.get("/")
async def list_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(PlatformConnection).where(PlatformConnection.company_id == current_user.company_id)
    )
    conns = res.scalars().all()
    return [
        {
            "platform": c.platform,
            "page_id": c.page_id,
            "page_name": c.page_name,
            "channel_id": c.channel_id,
            "channel_title": c.channel_title,
            "connected_at": c.created_at,
        }
        for c in conns
    ]


# ─── Facebook OAuth ──────────────────────────────────────────────────

@router.get("/facebook/connect")
async def facebook_connect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cfg = await get_company_config(db, current_user.company_id, "facebook")
    app_id = cfg.get("app_id") or settings.FACEBOOK_APP_ID
    if not app_id:
        raise HTTPException(status_code=400, detail="กรุณาใส่ Facebook App ID ในหน้าตั้งค่าก่อน")
    url = facebook_service.oauth_url_with_id(app_id, _redirect_uri("facebook"), state=str(current_user.company_id))
    return {"oauth_url": url}


@router.get("/facebook/callback")
async def facebook_callback(code: str, state: str = "", db: AsyncSession = Depends(get_db)):
    """Facebook OAuth callback"""
    try:
        company_id = int(state)
        cfg = await get_company_config(db, company_id, "facebook")
        app_id = cfg.get("app_id") or settings.FACEBOOK_APP_ID
        app_secret = cfg.get("app_secret") or settings.FACEBOOK_APP_SECRET
        tokens = await facebook_service.exchange_code_with_creds(code, _redirect_uri("facebook"), app_id, app_secret)
        long_token = await facebook_service.get_long_lived_token_with_creds(tokens["access_token"], app_id, app_secret)

        # ดึงรายการ Pages
        pages = await facebook_service.get_pages(long_token)
        if not pages:
            return RedirectResponse(f"{settings.FRONTEND_URL}/dashboard/settings?error=no_pages")

        # ใช้ Page แรก (ถ้ามีหลาย Page จะปรับให้เลือกได้ทีหลัง)
        page = pages[0]

        # บันทึกหรืออัปเดต
        conn = await _get_conn(db, company_id, "facebook")
        if conn:
            conn.access_token = page["access_token"]
            conn.page_id = page["id"]
            conn.page_name = page["name"]
            conn.updated_at = datetime.utcnow()
        else:
            conn = PlatformConnection(
                company_id=company_id,
                platform="facebook",
                access_token=page["access_token"],
                page_id=page["id"],
                page_name=page["name"],
            )
            db.add(conn)
        await db.commit()
        return RedirectResponse(f"{settings.FRONTEND_URL}/dashboard/settings?connected=facebook")
    except Exception as e:
        logger.error(f"[Facebook] callback error: {e}")
        return RedirectResponse(f"{settings.FRONTEND_URL}/dashboard/settings?error=facebook_failed")


@router.delete("/facebook")
async def facebook_disconnect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conn = await _get_conn(db, current_user.company_id, "facebook")
    if conn:
        await db.delete(conn)
        await db.commit()
    return {"status": "disconnected"}


# ─── YouTube OAuth ───────────────────────────────────────────────────

@router.get("/youtube/connect")
async def youtube_connect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cfg = await get_company_config(db, current_user.company_id, "youtube")
    client_id = cfg.get("client_id") or settings.YOUTUBE_CLIENT_ID
    if not client_id:
        raise HTTPException(status_code=400, detail="กรุณาใส่ YouTube Client ID ในหน้าตั้งค่าก่อน")
    url = youtube_service.oauth_url_with_id(client_id, _redirect_uri("youtube"), state=str(current_user.company_id))
    return {"oauth_url": url}


@router.get("/youtube/callback")
async def youtube_callback(code: str, state: str = "", db: AsyncSession = Depends(get_db)):
    """YouTube OAuth callback"""
    try:
        company_id = int(state)
        cfg = await get_company_config(db, company_id, "youtube")
        client_id = cfg.get("client_id") or settings.YOUTUBE_CLIENT_ID
        client_secret = cfg.get("client_secret") or settings.YOUTUBE_CLIENT_SECRET
        tokens = await youtube_service.exchange_code_with_creds(code, _redirect_uri("youtube"), client_id, client_secret)
        channel = await youtube_service.get_channel_info(tokens["access_token"])

        expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
        conn = await _get_conn(db, company_id, "youtube")
        if conn:
            conn.access_token = tokens["access_token"]
            conn.refresh_token = tokens.get("refresh_token", conn.refresh_token)
            conn.channel_id = channel.get("id")
            conn.channel_title = channel.get("title")
            conn.expires_at = expires_at
            conn.updated_at = datetime.utcnow()
        else:
            conn = PlatformConnection(
                company_id=company_id,
                platform="youtube",
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token"),
                channel_id=channel.get("id"),
                channel_title=channel.get("title"),
                expires_at=expires_at,
            )
            db.add(conn)
        await db.commit()
        return RedirectResponse(f"{settings.FRONTEND_URL}/dashboard/settings?connected=youtube")
    except Exception as e:
        logger.error(f"[YouTube] callback error: {e}")
        return RedirectResponse(f"{settings.FRONTEND_URL}/dashboard/settings?error=youtube_failed")


@router.delete("/youtube")
async def youtube_disconnect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conn = await _get_conn(db, current_user.company_id, "youtube")
    if conn:
        await db.delete(conn)
        await db.commit()
    return {"status": "disconnected"}


# ─── Auto-start Live ─────────────────────────────────────────────────

class AutoStartRequest(BaseModel):
    platform: str        # facebook | youtube
    campaign_id: int
    title: str
    description: str = ""


@router.post("/live/start")
async def auto_start_live(
    req: AutoStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    สร้าง Live broadcast บน Facebook/YouTube อัตโนมัติ แล้วคืน RTMP URL
    Frontend นำ RTMP URL ไปใช้กับ stream session
    """
    conn = await _get_conn(db, current_user.company_id, req.platform)
    if not conn:
        raise HTTPException(status_code=404, detail=f"ยังไม่ได้เชื่อมต่อ {req.platform} — ไปที่ตั้งค่าก่อน")

    if req.platform == "facebook":
        try:
            live = await facebook_service.create_live_video(
                page_token=conn.access_token,
                page_id=conn.page_id,
                title=req.title,
                description=req.description,
            )
            return {
                "platform": "facebook",
                "rtmp_url": live["stream_url"],
                "stream_key": "",
                "live_id": live["id"],
                "dashboard_url": live["dashboard_url"],
                "page_name": conn.page_name,
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    elif req.platform == "youtube":
        # Refresh token ถ้าหมดอายุ
        if conn.expires_at and conn.expires_at <= datetime.utcnow():
            if conn.refresh_token:
                new_tokens = await youtube_service.refresh_access_token(conn.refresh_token)
                conn.access_token = new_tokens["access_token"]
                conn.expires_at = datetime.utcnow() + timedelta(seconds=new_tokens.get("expires_in", 3600))
                await db.commit()
            else:
                raise HTTPException(status_code=401, detail="YouTube token หมดอายุ กรุณาเชื่อมต่อใหม่")

        try:
            live = await youtube_service.create_broadcast(
                access_token=conn.access_token,
                title=req.title,
                description=req.description,
            )
            # Transition to live หลัง FFmpeg เริ่ม push (รอ 5 วิ)
            asyncio.create_task(_delayed_transition(conn.access_token, live["broadcast_id"]))
            return {
                "platform": "youtube",
                "rtmp_url": live["rtmp_url"],
                "stream_key": live["stream_key"],
                "live_id": live["broadcast_id"],
                "watch_url": live["watch_url"],
                "channel_title": conn.channel_title,
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    raise HTTPException(status_code=400, detail="platform ไม่รองรับ")


async def _delayed_transition(access_token: str, broadcast_id: str):
    """รอให้ FFmpeg เริ่ม push ก่อนแล้วค่อย transition เป็น live"""
    await asyncio.sleep(15)
    await youtube_service.transition_broadcast(access_token, broadcast_id, "live")


class AutoEndRequest(BaseModel):
    platform: str
    live_id: str


@router.post("/live/end")
async def auto_end_live(
    req: AutoEndRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """จบ Live broadcast อัตโนมัติ"""
    conn = await _get_conn(db, current_user.company_id, req.platform)
    if not conn:
        return {"status": "no_connection"}

    if req.platform == "facebook":
        ok = await facebook_service.end_live_video(conn.access_token, req.live_id)
    elif req.platform == "youtube":
        ok = await youtube_service.end_broadcast(conn.access_token, req.live_id)
    else:
        ok = False

    return {"status": "ended" if ok else "error"}
