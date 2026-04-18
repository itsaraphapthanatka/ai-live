from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CampaignCreate(BaseModel):
    name: str
    product_name: Optional[str] = None
    product_price: Optional[str] = None
    product_highlights: Optional[str] = None
    language: str = "th"
    tone: str = "friendly"
    promotion: Optional[str] = None
    script: Optional[str] = None
    avatar_url: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    product_name: Optional[str] = None
    product_price: Optional[str] = None
    product_highlights: Optional[str] = None
    language: Optional[str] = None
    tone: Optional[str] = None
    promotion: Optional[str] = None
    script: Optional[str] = None
    avatar_url: Optional[str] = None
    status: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class CampaignOut(BaseModel):
    id: int
    company_id: int
    name: str
    product_name: Optional[str]
    product_price: Optional[str]
    product_highlights: Optional[str]
    language: str
    tone: str
    promotion: Optional[str]
    script: Optional[str]
    avatar_url: Optional[str]
    status: str
    scheduled_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScriptGenerateRequest(BaseModel):
    product_name: str
    product_price: Optional[str] = None
    product_highlights: Optional[str] = None
    promotion: Optional[str] = None
    language: str = "th"
    tone: str = "friendly"
    business_type: Optional[str] = None


class TTSRequest(BaseModel):
    text: str
    voice: str = "alloy"  # alloy / echo / fable / onyx / nova / shimmer


class CommentReplyRequest(BaseModel):
    comment: str
    product_name: Optional[str] = None
    language: str = "th"


class LeadCreate(BaseModel):
    campaign_id: int
    name: Optional[str] = None
    contact: Optional[str] = None
    source: str = "comment"
    notes: Optional[str] = None


class LeadOut(BaseModel):
    id: int
    campaign_id: int
    name: Optional[str]
    contact: Optional[str]
    source: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class StreamAccountCreate(BaseModel):
    platform: str
    rtmp_url: str
    stream_key: str
    label: Optional[str] = None


class StreamAccountOut(BaseModel):
    id: int
    company_id: int
    platform: str
    rtmp_url: str
    stream_key: str
    label: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class StreamSessionOut(BaseModel):
    id: int
    campaign_id: int
    platform: str
    status: str
    viewer_count: int
    comment_count: int
    lead_count: int
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
