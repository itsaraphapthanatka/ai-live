from app.database import Base
import sqlalchemy as sa
from sqlalchemy.orm import relationship


class StreamAccount(Base):
    __tablename__ = "stream_accounts"

    id = sa.Column(sa.Integer, primary_key=True, index=True)
    company_id = sa.Column(sa.Integer, sa.ForeignKey("companies.id"), nullable=False)
    platform = sa.Column(sa.String(50))  # facebook / youtube / tiktok
    rtmp_url = sa.Column(sa.String(500))
    stream_key = sa.Column(sa.String(500))
    label = sa.Column(sa.String(255))
    created_at = sa.Column(sa.DateTime, server_default=sa.func.now())

    company = relationship("Company", back_populates="stream_accounts")


class StreamSession(Base):
    __tablename__ = "stream_sessions"

    id = sa.Column(sa.Integer, primary_key=True, index=True)
    campaign_id = sa.Column(sa.Integer, sa.ForeignKey("campaigns.id"), nullable=False)
    platform = sa.Column(sa.String(50))
    rtmp_url = sa.Column(sa.String(500))
    stream_key = sa.Column(sa.String(500))
    status = sa.Column(sa.String(50), default="idle")  # idle / connecting / live / ended / error
    viewer_count = sa.Column(sa.Integer, default=0)
    comment_count = sa.Column(sa.Integer, default=0)
    lead_count = sa.Column(sa.Integer, default=0)
    started_at = sa.Column(sa.DateTime, nullable=True)
    ended_at = sa.Column(sa.DateTime, nullable=True)
    created_at = sa.Column(sa.DateTime, server_default=sa.func.now())

    campaign = relationship("Campaign", back_populates="stream_sessions")
    comments = relationship("Comment", back_populates="session")


class Comment(Base):
    __tablename__ = "comments"

    id = sa.Column(sa.Integer, primary_key=True, index=True)
    session_id = sa.Column(sa.Integer, sa.ForeignKey("stream_sessions.id"), nullable=False)
    user_name = sa.Column(sa.String(255))
    message = sa.Column(sa.Text)
    ai_reply = sa.Column(sa.Text, nullable=True)
    sentiment = sa.Column(sa.String(50), nullable=True)  # positive / neutral / negative
    created_at = sa.Column(sa.DateTime, server_default=sa.func.now())

    session = relationship("StreamSession", back_populates="comments")
