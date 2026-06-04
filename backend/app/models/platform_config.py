"""เก็บ API credentials ของแต่ละ platform ต่อ company"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from app.database import Base


class PlatformConfig(Base):
    __tablename__ = "platform_configs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    platform = Column(String, nullable=False)   # facebook | youtube | heygen | tiktool
    config_json = Column(Text, nullable=False, default="{}")  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
