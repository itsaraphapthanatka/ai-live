"""HeyGen Streaming Avatar endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
from app.auth import get_current_user
from app.models.user import User
from app.config import settings
from app.services.heygen_service import HeyGenAvatarStream, active_streams
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/heygen", tags=["heygen"])


# ─── Token (สำหรับ frontend JS SDK) ─────────────────────────────────
async def _get_heygen_key(company_id: int, db: AsyncSession) -> str:
    """อ่าน HeyGen API key จาก DB ก่อน ถ้าไม่มีใช้จาก settings"""
    try:
        from app.routers.platform_config import get_company_config
        cfg = await get_company_config(db, company_id, "heygen")
        return cfg.get("api_key") or settings.HEYGEN_API_KEY
    except Exception:
        return settings.HEYGEN_API_KEY


@router.get("/token")
async def get_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """ขอ short-lived token สำหรับ HeyGen Streaming Avatar JS SDK"""
    api_key = await _get_heygen_key(current_user.company_id, db)
    if not api_key:
        raise HTTPException(status_code=400, detail="กรุณาใส่ HeyGen API Key ในหน้าตั้งค่าก่อน")
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.heygen.com/v1/streaming.create_token",
                headers={"X-Api-Key": api_key},
                timeout=10,
            )
            data = r.json()
            token = data.get("data", {}).get("token")
            if not token:
                raise HTTPException(status_code=500, detail=f"HeyGen token error: {data}")
            return {"token": token}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class StartAvatarRequest(BaseModel):
    session_id: int
    avatar_id: Optional[str] = None
    rtmp_url: str
    stream_key: Optional[str] = None


class SpeakRequest(BaseModel):
    session_id: int
    text: str


# ─── Avatars list ────────────────────────────────────────────────────
@router.get("/avatars")
async def list_avatars(current_user: User = Depends(get_current_user)):
    """ดึงรายการ avatar ที่มีใน HeyGen account"""
    if not settings.HEYGEN_API_KEY:
        raise HTTPException(status_code=400, detail="HEYGEN_API_KEY ยังไม่ได้ตั้งค่า")
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://api.heygen.com/v2/avatars",
                headers={"X-Api-Key": settings.HEYGEN_API_KEY},
                timeout=15,
            )
            data = r.json()
            avatars = data.get("data", {}).get("avatars", [])
            return {
                "avatars": [
                    {
                        "id": a["avatar_id"],
                        "name": a.get("avatar_name", a["avatar_id"]),
                        "preview": a.get("preview_image_url"),
                        "gender": a.get("gender"),
                    }
                    for a in avatars
                ]
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Start avatar stream ─────────────────────────────────────────────
@router.post("/avatar/start")
async def start_avatar(req: StartAvatarRequest, current_user: User = Depends(get_current_user)):
    """
    เริ่ม HeyGen streaming avatar และ push ไป RTMP (TikTok/Facebook/YouTube)
    ต้องใช้กับ 'Stream จาก PC' mode เท่านั้น (ต้องมี RTMP URL + Stream Key)
    """
    if not settings.HEYGEN_API_KEY:
        raise HTTPException(status_code=400, detail="HEYGEN_API_KEY ยังไม่ได้ตั้งค่า")

    avatar_id = req.avatar_id or settings.HEYGEN_AVATAR_ID
    if not avatar_id:
        raise HTTPException(status_code=400, detail="กรุณาระบุ avatar_id")

    # รวม RTMP URL + stream key
    rtmp_full = req.rtmp_url.rstrip("/")
    if req.stream_key:
        rtmp_full = f"{rtmp_full}/{req.stream_key}"

    # หยุด stream เก่าถ้ามี
    old = active_streams.pop(req.session_id, None)
    if old:
        await old.stop()

    stream = HeyGenAvatarStream(
        tiktok_session_id=req.session_id,
        avatar_id=avatar_id,
        rtmp_url=rtmp_full,
    )
    active_streams[req.session_id] = stream

    result = await stream.start()
    if not result["ok"]:
        active_streams.pop(req.session_id, None)
        raise HTTPException(status_code=500, detail=result["error"])

    return {
        "status": "started",
        "session_id": req.session_id,
        "heygen_session_id": result["session_id"],
        "rtmp_url": rtmp_full,
    }


# ─── Speak ───────────────────────────────────────────────────────────
@router.post("/avatar/speak")
async def speak(req: SpeakRequest, current_user: User = Depends(get_current_user)):
    """ส่ง text ให้ avatar พูด"""
    stream = active_streams.get(req.session_id)
    if not stream or not stream.is_active:
        raise HTTPException(status_code=404, detail="Avatar stream ไม่ active")
    ok = await stream.speak(req.text)
    return {"status": "speaking" if ok else "error"}


# ─── Stop ────────────────────────────────────────────────────────────
@router.post("/avatar/stop")
async def stop_avatar(session_id: int, current_user: User = Depends(get_current_user)):
    """หยุด avatar stream"""
    stream = active_streams.pop(session_id, None)
    if stream:
        await stream.stop()
    return {"status": "stopped", "session_id": session_id}


# ─── Status ──────────────────────────────────────────────────────────
@router.get("/avatar/status/{session_id}")
async def avatar_status(session_id: int, current_user: User = Depends(get_current_user)):
    stream = active_streams.get(session_id)
    if not stream:
        return {"active": False}
    return {
        "active": stream.is_active,
        "heygen_session_id": stream.heygen_session_id,
        "avatar_id": stream.avatar_id,
    }
