from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from pathlib import Path
import httpx
from app.database import get_db
from app.models.user import User
from app.models.campaign import Campaign
from app.schemas.schemas import CampaignCreate, CampaignUpdate, CampaignOut, AvatarGenerateRequest
from app.auth import get_current_user
from app.config import settings
from app.services import heygen_service

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=List[CampaignOut])
async def list_campaigns(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(Campaign.company_id == current_user.company_id)
        .order_by(Campaign.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=CampaignOut)
async def create_campaign(
    data: CampaignCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = Campaign(**data.model_dump(), company_id=current_user.company_id)
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}", response_model=CampaignOut)
async def get_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.company_id == current_user.company_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.put("/{campaign_id}", response_model=CampaignOut)
async def update_campaign(
    campaign_id: int,
    data: CampaignUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.company_id == current_user.company_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(campaign, field, value)

    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/generate-avatar")
async def generate_avatar(
    campaign_id: int,
    data: AvatarGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit HeyGen video generation. Returns immediately with video_id."""
    from app.routers.platform_config import get_company_config
    cfg = await get_company_config(db, current_user.company_id, "heygen")
    api_key = cfg.get("api_key") or settings.HEYGEN_API_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="กรุณาใส่ HeyGen API Key ในหน้าตั้งค่าก่อน")

    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.company_id == current_user.company_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.script:
        raise HTTPException(status_code=400, detail="Campaign has no script. Generate a script first.")

    try:
        video_id = await heygen_service.generate_avatar_video(
            script=campaign.script,
            avatar_id=data.avatar_id,
            voice_id=data.voice_id,
            api_key=api_key,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"HeyGen error: {e.response.text}")

    campaign.heygen_video_id = video_id
    await db.commit()
    return {"video_id": video_id, "status": "processing"}


@router.get("/{campaign_id}/avatar-status")
async def avatar_status(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check HeyGen generation status. Downloads and saves video when completed."""
    from app.routers.platform_config import get_company_config
    cfg = await get_company_config(db, current_user.company_id, "heygen")
    api_key = cfg.get("api_key") or settings.HEYGEN_API_KEY

    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.company_id == current_user.company_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.heygen_video_id:
        raise HTTPException(status_code=400, detail="No avatar generation in progress")

    try:
        info = await heygen_service.get_video_status(campaign.heygen_video_id, api_key=api_key)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"HeyGen error: {e.response.text}")

    if info["status"] == "completed" and info["video_url"]:
        # Download and save to media volume
        avatar_dir = Path(settings.MEDIA_DIR) / "avatars"
        avatar_dir.mkdir(parents=True, exist_ok=True)
        file_path = avatar_dir / f"{campaign_id}.mp4"

        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.get(info["video_url"])
            resp.raise_for_status()
            file_path.write_bytes(resp.content)

        campaign.avatar_url = str(file_path)
        await db.commit()
        info["avatar_url"] = str(file_path)

    return info


@router.get("/heygen/avatars")
async def list_heygen_avatars(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List available HeyGen avatars — อ่าน API key จาก DB ก่อน"""
    from app.routers.platform_config import get_company_config
    cfg = await get_company_config(db, current_user.company_id, "heygen")
    api_key = cfg.get("api_key") or settings.HEYGEN_API_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="กรุณาใส่ HeyGen API Key ในหน้าตั้งค่าก่อน")
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://api.heygen.com/v2/avatars",
                headers={"X-Api-Key": api_key},
                timeout=15,
            )
            r.raise_for_status()
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
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"HeyGen error: {e.response.text}")


@router.get("/heygen/voices")
async def list_heygen_voices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List available HeyGen voices — อ่าน API key จาก DB ก่อน"""
    from app.routers.platform_config import get_company_config
    cfg = await get_company_config(db, current_user.company_id, "heygen")
    api_key = cfg.get("api_key") or settings.HEYGEN_API_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="กรุณาใส่ HeyGen API Key ในหน้าตั้งค่าก่อน")
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://api.heygen.com/v2/voices",
                headers={"X-Api-Key": api_key},
                timeout=15,
            )
            r.raise_for_status()
            data = r.json()
            voices = data.get("data", {}).get("voices", [])
            return {
                "voices": [
                    {
                        "id": v["voice_id"],
                        "name": v.get("name", v["voice_id"]),
                        "language": v.get("language"),
                        "gender": v.get("gender"),
                    }
                    for v in voices
                ]
            }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"HeyGen error: {e.response.text}")


@router.post("/{campaign_id}/upload-avatar")
async def upload_avatar(
    campaign_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.company_id == current_user.company_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    avatar_dir = Path(settings.MEDIA_DIR) / "avatars"
    avatar_dir.mkdir(parents=True, exist_ok=True)
    file_path = avatar_dir / f"{campaign_id}.mp4"
    file_path.write_bytes(await file.read())

    campaign.avatar_url = str(file_path)
    await db.commit()
    return {"avatar_url": str(file_path)}


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.company_id == current_user.company_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.delete(campaign)
    await db.commit()
    return {"status": "deleted"}
