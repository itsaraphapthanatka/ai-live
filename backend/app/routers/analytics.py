from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User
from app.models.campaign import Campaign
from app.models.stream import StreamSession
from app.models.lead import Lead
from app.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def get_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard overview stats."""
    company_id = current_user.company_id

    # Campaign counts
    campaigns_result = await db.execute(
        select(func.count(Campaign.id)).where(Campaign.company_id == company_id)
    )
    total_campaigns = campaigns_result.scalar() or 0

    live_result = await db.execute(
        select(func.count(Campaign.id)).where(
            Campaign.company_id == company_id, Campaign.status == "live"
        )
    )
    live_campaigns = live_result.scalar() or 0

    # Sessions
    sessions_result = await db.execute(
        select(func.count(StreamSession.id))
        .join(Campaign, StreamSession.campaign_id == Campaign.id)
        .where(Campaign.company_id == company_id)
    )
    total_sessions = sessions_result.scalar() or 0

    # Leads
    leads_result = await db.execute(
        select(func.count(Lead.id))
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .where(Campaign.company_id == company_id)
    )
    total_leads = leads_result.scalar() or 0

    # Recent campaigns
    recent_result = await db.execute(
        select(Campaign)
        .where(Campaign.company_id == company_id)
        .order_by(Campaign.created_at.desc())
        .limit(5)
    )
    recent_campaigns = recent_result.scalars().all()

    return {
        "total_campaigns": total_campaigns,
        "live_campaigns": live_campaigns,
        "total_sessions": total_sessions,
        "total_leads": total_leads,
        "recent_campaigns": [
            {
                "id": c.id,
                "name": c.name,
                "status": c.status,
                "product_name": c.product_name,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in recent_campaigns
        ],
    }


@router.get("/campaigns/{campaign_id}")
async def get_campaign_analytics(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Per-campaign analytics."""
    # Leads for this campaign
    leads_result = await db.execute(
        select(func.count(Lead.id)).where(Lead.campaign_id == campaign_id)
    )
    total_leads = leads_result.scalar() or 0

    # Sessions
    sessions_result = await db.execute(
        select(StreamSession)
        .where(StreamSession.campaign_id == campaign_id)
        .order_by(StreamSession.created_at.desc())
    )
    sessions = sessions_result.scalars().all()

    total_duration = 0
    for s in sessions:
        if s.started_at and s.ended_at:
            total_duration += int((s.ended_at - s.started_at).total_seconds())

    return {
        "campaign_id": campaign_id,
        "total_leads": total_leads,
        "total_sessions": len(sessions),
        "total_duration_seconds": total_duration,
        "sessions": [
            {
                "id": s.id,
                "platform": s.platform,
                "status": s.status,
                "viewer_count": s.viewer_count,
                "comment_count": s.comment_count,
                "lead_count": s.lead_count,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            }
            for s in sessions
        ],
    }
