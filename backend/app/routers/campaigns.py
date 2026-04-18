from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.campaign import Campaign
from app.schemas.schemas import CampaignCreate, CampaignUpdate, CampaignOut
from app.auth import get_current_user

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
