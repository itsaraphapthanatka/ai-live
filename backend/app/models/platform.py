from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class PlatformConnection(Base):
    """เก็บ OAuth token ของแต่ละ platform (Facebook, YouTube)"""
    __tablename__ = "platform_connections"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    platform = Column(String, nullable=False)          # facebook | youtube
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    page_id = Column(String, nullable=True)            # Facebook Page ID
    page_name = Column(String, nullable=True)          # Facebook Page name
    channel_id = Column(String, nullable=True)         # YouTube channel ID
    channel_title = Column(String, nullable=True)      # YouTube channel name
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
