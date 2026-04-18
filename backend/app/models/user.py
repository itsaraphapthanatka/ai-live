from app.database import Base
import sqlalchemy as sa
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = "users"

    id = sa.Column(sa.Integer, primary_key=True, index=True)
    email = sa.Column(sa.String(255), unique=True, nullable=False, index=True)
    password_hash = sa.Column(sa.String(255), nullable=False)
    full_name = sa.Column(sa.String(255))
    role = sa.Column(sa.String(50), default="admin")  # admin / member
    company_id = sa.Column(sa.Integer, sa.ForeignKey("companies.id"), nullable=True)
    is_active = sa.Column(sa.Boolean, default=True)
    created_at = sa.Column(sa.DateTime, server_default=sa.func.now())

    company = relationship("Company", back_populates="users")
