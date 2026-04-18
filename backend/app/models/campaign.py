from app.database import Base
import sqlalchemy as sa
from sqlalchemy.orm import relationship


class Campaign(Base):
    __tablename__ = "campaigns"

    id = sa.Column(sa.Integer, primary_key=True, index=True)
    company_id = sa.Column(sa.Integer, sa.ForeignKey("companies.id"), nullable=False)
    name = sa.Column(sa.String(255), nullable=False)
    product_name = sa.Column(sa.String(255))
    product_price = sa.Column(sa.String(100))
    product_highlights = sa.Column(sa.Text)
    language = sa.Column(sa.String(50), default="th")  # th / en / zh
    tone = sa.Column(sa.String(50), default="friendly")  # friendly / luxury / energetic
    promotion = sa.Column(sa.Text)
    script = sa.Column(sa.Text)
    avatar_url = sa.Column(sa.String(500))
    status = sa.Column(sa.String(50), default="draft")  # draft / scheduled / live / ended
    scheduled_at = sa.Column(sa.DateTime, nullable=True)
    created_at = sa.Column(sa.DateTime, server_default=sa.func.now())
    updated_at = sa.Column(sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now())

    company = relationship("Company", back_populates="campaigns")
    stream_sessions = relationship("StreamSession", back_populates="campaign")
    leads = relationship("Lead", back_populates="campaign")
