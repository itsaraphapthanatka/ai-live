from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.lead import Lead
from app.models.campaign import Campaign
from app.schemas.schemas import LeadCreate, LeadOut
from app.auth import get_current_user

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=List[LeadOut])
async def list_leads(
    campaign_id: int = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify company owns the campaigns
    query = (
        select(Lead)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .where(Campaign.company_id == current_user.company_id)
        .order_by(Lead.created_at.desc())
    )
    if campaign_id:
        query = query.where(Lead.campaign_id == campaign_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=LeadOut)
async def create_lead(
    data: LeadCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify campaign belongs to current user's company
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == data.campaign_id,
            Campaign.company_id == current_user.company_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Campaign not found or access denied")

    lead = Lead(**data.model_dump())
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return lead


@router.delete("/{lead_id}")
async def delete_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lead)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .where(Lead.id == lead_id, Campaign.company_id == current_user.company_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await db.delete(lead)
    await db.commit()
    return {"status": "deleted"}
