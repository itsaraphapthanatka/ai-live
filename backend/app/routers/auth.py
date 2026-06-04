from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import secrets
import string
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.schemas.auth import UserCreate, UserLogin, Token, UserOut
from app.auth import hash_password, verify_password, create_access_token, get_current_user

# in-memory invite store: token → {company_id, email, role, created_at}
_invite_store: dict[str, dict] = {}

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check existing user
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create company
    company = Company(
        name=data.company_name or f"{data.full_name or data.email}'s Company",
        plan="starter",
        stream_quota_hours=30,
    )
    db.add(company)
    await db.flush()

    # Create user
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        company_id=company.id,
        role="admin",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None

@router.put("/profile", response_model=UserOut)
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.full_name is not None:
        current_user.full_name = data.full_name
    await db.commit()
    await db.refresh(current_user)
    return UserOut.model_validate(current_user)


# ═══════════════════════════════════════════════════════════════════
#  TEAM MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

def _require_admin(user: User):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="เฉพาะ Admin เท่านั้น")


# ─── List members ────────────────────────────────────────────────────

@router.get("/members")
async def list_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(User).where(User.company_id == current_user.company_id, User.is_active == True)
    )
    members = res.scalars().all()
    return [
        {
            "id": m.id,
            "email": m.email,
            "full_name": m.full_name,
            "role": m.role,
            "created_at": m.created_at,
            "is_me": m.id == current_user.id,
        }
        for m in members
    ]


# ─── Invite member ───────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str
    role: str = "member"  # admin | member

@router.post("/invite")
async def create_invite(
    data: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)

    # ตรวจว่า email นี้มีอยู่ใน company แล้วหรือไม่
    res = await db.execute(select(User).where(User.email == data.email, User.company_id == current_user.company_id))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email นี้เป็นสมาชิกอยู่แล้ว")

    # สร้าง invite token
    token = "inv_" + "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
    _invite_store[token] = {
        "company_id": current_user.company_id,
        "email": data.email,
        "role": data.role,
        "created_at": datetime.utcnow().isoformat(),
        "invited_by": current_user.full_name or current_user.email,
    }

    from app.config import settings
    invite_url = f"{settings.FRONTEND_URL}/invite/{token}"
    return {
        "token": token,
        "invite_url": invite_url,
        "email": data.email,
        "role": data.role,
        "expires_in": "7 วัน",
    }


# ─── Accept invite ───────────────────────────────────────────────────

class AcceptInviteRequest(BaseModel):
    token: str
    full_name: str
    password: str

@router.post("/invite/accept", response_model=Token)
async def accept_invite(data: AcceptInviteRequest, db: AsyncSession = Depends(get_db)):
    invite = _invite_store.get(data.token)
    if not invite:
        raise HTTPException(status_code=404, detail="ลิงก์เชิญหมดอายุหรือไม่ถูกต้อง")

    # ตรวจว่า email มีอยู่แล้วหรือไม่
    res = await db.execute(select(User).where(User.email == invite["email"]))
    existing = res.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email นี้ถูกใช้งานแล้ว")

    user = User(
        email=invite["email"],
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        company_id=invite["company_id"],
        role=invite["role"],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # ลบ token
    del _invite_store[data.token]

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


# ─── Get invite info ─────────────────────────────────────────────────

@router.get("/invite/{token}")
async def get_invite(token: str):
    invite = _invite_store.get(token)
    if not invite:
        raise HTTPException(status_code=404, detail="ลิงก์เชิญหมดอายุหรือไม่ถูกต้อง")
    return {
        "email": invite["email"],
        "role": invite["role"],
        "invited_by": invite["invited_by"],
    }


# ─── Update member role ──────────────────────────────────────────────

class RoleUpdate(BaseModel):
    role: str  # admin | member

@router.put("/members/{user_id}/role")
async def update_role(
    user_id: int,
    data: RoleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="ไม่สามารถเปลี่ยน role ของตัวเองได้")

    res = await db.execute(
        select(User).where(User.id == user_id, User.company_id == current_user.company_id)
    )
    member = res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

    if data.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="role ต้องเป็น admin หรือ member")

    member.role = data.role
    await db.commit()
    return {"id": member.id, "role": member.role}


# ─── Remove member ───────────────────────────────────────────────────

@router.delete("/members/{user_id}")
async def remove_member(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="ไม่สามารถลบตัวเองได้")

    res = await db.execute(
        select(User).where(User.id == user_id, User.company_id == current_user.company_id)
    )
    member = res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")

    member.is_active = False
    await db.commit()
    return {"status": "removed", "id": user_id}
