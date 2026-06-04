import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime
from pathlib import Path
from app.database import get_db
from app.models.user import User
from app.models.stream import StreamAccount, StreamSession
from app.models.campaign import Campaign
from app.schemas.schemas import StreamAccountCreate, StreamAccountOut, StreamSessionOut
from app.auth import get_current_user
from app.services import stream_service
from app.services import tts_service
from app.config import settings

router = APIRouter(prefix="/stream", tags=["stream"])


@router.get("/accounts", response_model=List[StreamAccountOut])
async def list_stream_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StreamAccount).where(StreamAccount.company_id == current_user.company_id)
    )
    return result.scalars().all()


@router.post("/accounts", response_model=StreamAccountOut)
async def create_stream_account(
    data: StreamAccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = StreamAccount(**data.model_dump(), company_id=current_user.company_id)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/accounts/{account_id}")
async def delete_stream_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StreamAccount).where(
            StreamAccount.id == account_id,
            StreamAccount.company_id == current_user.company_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Stream account not found")
    await db.delete(account)
    await db.commit()
    return {"status": "deleted"}


@router.post("/start/{campaign_id}", response_model=StreamSessionOut)
async def start_stream(
    campaign_id: int,
    platform: str = "facebook",
    tiktok_unique_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify campaign ownership
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.company_id == current_user.company_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Get stream account for platform
    result = await db.execute(
        select(StreamAccount).where(
            StreamAccount.company_id == current_user.company_id,
            StreamAccount.platform == platform,
        )
    )
    account = result.scalar_one_or_none()

    rtmp_url = account.rtmp_url if account else "rtmp://mock.stream/live"
    stream_key = account.stream_key if account else "mock-key"

    # Create session record
    session = StreamSession(
        campaign_id=campaign_id,
        platform=platform,
        rtmp_url=rtmp_url,
        stream_key=stream_key,
        status="connecting",
        started_at=datetime.utcnow(),
    )
    db.add(session)

    # Update campaign status
    campaign.status = "live"
    await db.commit()
    await db.refresh(session)

    # Generate and save TTS audio from campaign script
    audio_dir = Path(settings.MEDIA_DIR) / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    audio_path = str(audio_dir / f"{campaign_id}.mp3")
    if campaign.script:
        voice = campaign.tts_voice or "nova"
        audio_bytes = await tts_service.text_to_speech(campaign.script, voice)
        Path(audio_path).write_bytes(audio_bytes)

    # Start FFmpeg
    avatar_path = campaign.avatar_url or "avatar.mp4"
    stream_result = await stream_service.start_stream(
        session_id=session.id,
        avatar_path=avatar_path,
        audio_path=audio_path,
        rtmp_url=rtmp_url,
        stream_key=stream_key,
    )

    # Update status based on result
    session.status = "live" if stream_result.get("status") in ("started", "mock") else "error"
    await db.commit()
    await db.refresh(session)

    # For TikTok: also start comment/viewer monitoring via WebSocket
    if platform == "tiktok" and tiktok_unique_id:
        from app.routers.tiktok import active_connections
        from app.services.tiktok_service import TikTokConnection
        conn = TikTokConnection(
            session_id=session.id,
            unique_id=tiktok_unique_id,
            campaign_id=campaign_id,
        )
        active_connections[session.id] = conn
        asyncio.create_task(conn.connect())

    return session


@router.post("/stop/{session_id}")
async def stop_stream(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(StreamSession).where(StreamSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await stream_service.stop_stream(session_id)

    # Also disconnect TikTok monitoring if active
    from app.routers.tiktok import active_connections
    conn = active_connections.pop(session_id, None)
    if conn:
        await conn.disconnect()

    session.status = "ended"
    session.ended_at = datetime.utcnow()
    await db.commit()
    return {"status": "stopped", "session_id": session_id}


@router.get("/status/{session_id}")
async def get_stream_status(
    session_id: int,
    current_user: User = Depends(get_current_user),
):
    return stream_service.get_stream_status(session_id)


@router.get("/sessions/{campaign_id}", response_model=List[StreamSessionOut])
async def get_sessions(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StreamSession)
        .where(StreamSession.campaign_id == campaign_id)
        .order_by(StreamSession.created_at.desc())
    )
    return result.scalars().all()
