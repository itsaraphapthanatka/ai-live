from app.database import Base
import sqlalchemy as sa
from sqlalchemy.orm import relationship


class Company(Base):
    __tablename__ = "companies"

    id = sa.Column(sa.Integer, primary_key=True, index=True)
    name = sa.Column(sa.String(255), nullable=False)
    plan = sa.Column(sa.String(50), default="starter")  # starter / pro / business
    stream_quota_hours = sa.Column(sa.Integer, default=30)
    is_active = sa.Column(sa.Boolean, default=True)
    created_at = sa.Column(sa.DateTime, server_default=sa.func.now())

    users = relationship("User", back_populates="company")
    campaigns = relationship("Campaign", back_populates="company")
    stream_accounts = relationship("StreamAccount", back_populates="company")
    billing_records = relationship("Billing", back_populates="company")
