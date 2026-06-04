import asyncio
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from app.auth import get_current_user
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.stream import StreamSession, StreamAccount
from app.schemas.schemas import StreamAccountOut
from app.services.tiktok_service import TikTokConnection

router = APIRouter(prefix="/tiktok", tags=["tiktok"])

active_connections: dict[int, TikTokConnection] = {}


@router.post("/accounts", response_model=StreamAccountOut)
async def create_account(
    platform: str,
    rtmp_url: str,
    stream_key: str,
    label: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    async with AsyncSessionLocal() as db:
        account = StreamAccount(
            company_id=current_user.company_id,
            platform=platform,
            rtmp_url=rtmp_url,
            stream_key=stream_key,
            label=label or platform,
        )
        db.add(account)
        await db.commit()
        await db.refresh(account)
        return account


@router.post("/connect/{campaign_id}")
async def tiktok_connect(
    campaign_id: int,
    unique_id: str,
    current_user: User = Depends(get_current_user),
):
    async with AsyncSessionLocal() as db:
        session = StreamSession(
            campaign_id=campaign_id,
            platform="tiktok",
            status="connecting",
            started_at=datetime.utcnow(),
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

    conn = TikTokConnection(session_id=session.id, unique_id=unique_id, campaign_id=campaign_id)
    active_connections[session.id] = conn
    asyncio.create_task(conn.connect())

    return {"session_id": session.id, "status": "connecting", "unique_id": unique_id}


@router.post("/disconnect/{session_id}")
async def tiktok_disconnect(
    session_id: int,
    current_user: User = Depends(get_current_user),
):
    conn = active_connections.pop(session_id, None)
    if conn:
        await conn.disconnect()
    return {"status": "disconnected"}


@router.post("/auto-reply/{session_id}")
async def set_auto_reply(
    session_id: int,
    enabled: bool,
    voice: str = "nova",
    current_user: User = Depends(get_current_user),
):
    """Enable or disable AI auto-reply for a TikTok session."""
    conn = active_connections.get(session_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Session not found or not active")
    conn.auto_reply = enabled
    conn.auto_reply_voice = voice
    return {
        "session_id": session_id,
        "auto_reply": enabled,
        "voice": voice,
        "pending": conn._pending_replies,
    }


@router.get("/auto-reply/{session_id}")
async def get_auto_reply_status(
    session_id: int,
    current_user: User = Depends(get_current_user),
):
    conn = active_connections.get(session_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "auto_reply": conn.auto_reply,
        "pending": conn._pending_replies,
        "comment_count": conn.comment_count,
    }


@router.get("/active")
async def list_active(
    current_user: User = Depends(get_current_user),
):
    return [
        {
            "session_id": sid,
            "unique_id": c.unique_id,
            "campaign_id": c.campaign_id,
            "viewers": c.viewer_count,
            "comments": c.comment_count,
        }
        for sid, c in active_connections.items()
    ]


@router.websocket("/ws/{session_id}")
async def tiktok_ws(websocket: WebSocket, session_id: int):
    conn = active_connections.get(session_id)
    if not conn:
        await websocket.accept()
        await websocket.send_json({"event": "error", "data": {"message": "Session not found"}})
        await websocket.close()
        return

    await websocket.accept()
    conn.add_frontend_ws(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        conn.remove_frontend_ws(websocket)
