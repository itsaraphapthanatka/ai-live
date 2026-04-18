from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    company_name: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    role: str
    company_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class CompanyOut(BaseModel):
    id: int
    name: str
    plan: str
    stream_quota_hours: int

    class Config:
        from_attributes = True
