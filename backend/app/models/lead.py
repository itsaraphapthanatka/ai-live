from app.database import Base
import sqlalchemy as sa
from sqlalchemy.orm import relationship


class Lead(Base):
    __tablename__ = "leads"

    id = sa.Column(sa.Integer, primary_key=True, index=True)
    campaign_id = sa.Column(sa.Integer, sa.ForeignKey("campaigns.id"), nullable=False)
    name = sa.Column(sa.String(255))
    contact = sa.Column(sa.String(255))  # phone / line / email
    source = sa.Column(sa.String(100))   # comment / form / webhook
    notes = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(sa.DateTime, server_default=sa.func.now())

    campaign = relationship("Campaign", back_populates="leads")


class Billing(Base):
    __tablename__ = "billing"

    id = sa.Column(sa.Integer, primary_key=True, index=True)
    company_id = sa.Column(sa.Integer, sa.ForeignKey("companies.id"), nullable=False)
    plan = sa.Column(sa.String(50))
    amount = sa.Column(sa.Integer)  # in THB satang
    status = sa.Column(sa.String(50), default="pending")  # pending / paid / cancelled
    period_start = sa.Column(sa.DateTime)
    period_end = sa.Column(sa.DateTime)
    created_at = sa.Column(sa.DateTime, server_default=sa.func.now())

    company = relationship("Company", back_populates="billing_records")
