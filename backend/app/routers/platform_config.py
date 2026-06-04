"""Platform Config — บันทึก API credentials ผ่าน UI ไม่ต้องแก้ .env"""
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.platform_config import PlatformConfig
from app.config import settings

router = APIRouter(prefix="/platform-config", tags=["platform-config"])

# ── Mapping: platform.field_key → settings attribute ────────────────
ENV_MAP: dict[str, dict[str, str]] = {
    "openai":      {"api_key": "OPENAI_API_KEY"},
    "facebook":    {"app_id": "FACEBOOK_APP_ID", "app_secret": "FACEBOOK_APP_SECRET"},
    "youtube":     {"client_id": "YOUTUBE_CLIENT_ID", "client_secret": "YOUTUBE_CLIENT_SECRET"},
    "heygen":      {"api_key": "HEYGEN_API_KEY", "avatar_id": "HEYGEN_AVATAR_ID"},
    "tiktool":     {"api_key": "TIKTOOL_API_KEY"},
    "tiktok_rtmp": {"rtmp_url": "", "stream_key": ""},  # ไม่มีใน settings
}

def _read_env_values(platform: str) -> dict[str, str]:
    """อ่านค่าจาก settings ตาม ENV_MAP"""
    result = {}
    mapping = ENV_MAP.get(platform, {})
    for field_key, env_attr in mapping.items():
        if env_attr:
            val = getattr(settings, env_attr, "") or ""
            if val:
                result[field_key] = val
    return result

# ── Fields per platform ──────────────────────────────────────────────
PLATFORM_FIELDS: dict[str, list[dict]] = {
    "openai": [
        {"key": "api_key", "label": "API Key", "type": "password", "help": "จาก platform.openai.com → API Keys → Create new secret key"},
    ],
    "facebook": [
        {"key": "app_id",     "label": "App ID",     "type": "text",     "help": "จาก developers.facebook.com → My Apps → App ID"},
        {"key": "app_secret", "label": "App Secret",  "type": "password", "help": "จาก App Dashboard → Settings → Basic → App Secret"},
    ],
    "youtube": [
        {"key": "client_id",     "label": "Client ID",     "type": "text",     "help": "จาก console.cloud.google.com → OAuth 2.0 Client IDs"},
        {"key": "client_secret", "label": "Client Secret",  "type": "password", "help": "Client secret จาก Google Cloud Console"},
    ],
    "heygen": [
        {"key": "api_key",   "label": "API Key",   "type": "password", "help": "จาก app.heygen.com → Settings → API"},
        {"key": "avatar_id", "label": "Avatar ID",  "type": "text",     "help": "เลือก Avatar แล้ว copy ID จากหน้า Avatar Library"},
    ],
    "tiktool": [
        {"key": "api_key", "label": "API Key", "type": "password", "help": "จาก tik.tools → Dashboard → API Keys"},
    ],
    "tiktok_rtmp": [
        {"key": "rtmp_url",   "label": "RTMP URL",   "type": "text",     "help": "rtmp://push-rtmp-l3.tiktok.com/live/ (ค่า default ของ TikTok)"},
        {"key": "stream_key", "label": "Stream Key",  "type": "password", "help": "จาก TikTok LIVE Studio → Copy Stream Key (ต้องมี 1,000+ followers)"},
    ],
}


async def _get_config(db: AsyncSession, company_id: int, platform: str) -> dict:
    """ดึง config dict ของ platform นั้น"""
    res = await db.execute(
        select(PlatformConfig).where(
            PlatformConfig.company_id == company_id,
            PlatformConfig.platform == platform,
        )
    )
    row = res.scalar_one_or_none()
    if not row:
        return {}
    try:
        return json.loads(row.config_json)
    except Exception:
        return {}


async def get_company_config(db: AsyncSession, company_id: int, platform: str) -> dict:
    """Public helper ใช้ใน routers อื่น"""
    return await _get_config(db, company_id, platform)


# ─── GET /platform-config/{platform} ────────────────────────────────

@router.get("/{platform}")
async def get_config(
    platform: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """ดึง config — DB ก่อน, fallback ดู .env"""
    if platform not in PLATFORM_FIELDS:
        raise HTTPException(status_code=404, detail="platform ไม่รองรับ")

    db_cfg = await _get_config(db, current_user.company_id, platform)
    env_cfg = _read_env_values(platform)
    fields = PLATFORM_FIELDS[platform]

    result = []
    for f in fields:
        db_val = db_cfg.get(f["key"], "")
        env_val = env_cfg.get(f["key"], "")
        val = db_val or env_val
        source = "db" if db_val else ("env" if env_val else "")
        result.append({
            **f,
            "configured": bool(val),
            "source": source,            # "db" | "env" | ""
            "masked_value": ("•" * 8) if (val and f["type"] == "password") else val,
        })

    configured = any(r["configured"] for r in result)
    has_env = bool(env_cfg)

    return {
        "platform": platform,
        "fields": result,
        "configured": configured,
        "has_env": has_env,              # มีค่าใน .env รอ import
        "env_keys": list(env_cfg.keys()) if env_cfg else [],
    }


# ─── PUT /platform-config/{platform} ────────────────────────────────

class ConfigSave(BaseModel):
    values: dict[str, Any]

@router.put("/{platform}")
async def save_config(
    platform: str,
    data: ConfigSave,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """บันทึก config — ถ้าส่ง '' สำหรับ field ที่มีค่าอยู่แล้วจะ keep ค่าเดิม"""
    if platform not in PLATFORM_FIELDS:
        raise HTTPException(status_code=404, detail="platform ไม่รองรับ")

    # โหลดค่าเดิม
    existing = await _get_config(db, current_user.company_id, platform)

    # merge: ถ้าส่งค่าว่างและมีค่าเดิม → keep เดิม
    for f in PLATFORM_FIELDS[platform]:
        k = f["key"]
        new_val = data.values.get(k, "")
        if new_val:
            existing[k] = new_val
        # ถ้าว่างและมีเดิม → ไม่เปลี่ยน

    # บันทึก
    res = await db.execute(
        select(PlatformConfig).where(
            PlatformConfig.company_id == current_user.company_id,
            PlatformConfig.platform == platform,
        )
    )
    row = res.scalar_one_or_none()
    if row:
        row.config_json = json.dumps(existing)
    else:
        row = PlatformConfig(
            company_id=current_user.company_id,
            platform=platform,
            config_json=json.dumps(existing),
        )
        db.add(row)

    await db.commit()
    return {"platform": platform, "saved": True}


# ─── DELETE /platform-config/{platform} ─────────────────────────────

@router.delete("/{platform}")
async def delete_config(
    platform: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(PlatformConfig).where(
            PlatformConfig.company_id == current_user.company_id,
            PlatformConfig.platform == platform,
        )
    )
    row = res.scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()
    return {"platform": platform, "deleted": True}


# ─── POST /platform-config/{platform}/import-env ────────────────────

@router.post("/{platform}/import-env")
async def import_from_env(
    platform: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Copy ค่าจาก .env เข้า DB สำหรับ platform นั้น"""
    if platform not in PLATFORM_FIELDS:
        raise HTTPException(status_code=404, detail="platform ไม่รองรับ")

    env_vals = _read_env_values(platform)
    if not env_vals:
        raise HTTPException(status_code=404, detail=f"ไม่พบค่าใน .env สำหรับ {platform}")

    existing = await _get_config(db, current_user.company_id, platform)
    merged = {**existing, **env_vals}  # env overwrites nothing existing keeps

    res = await db.execute(
        select(PlatformConfig).where(
            PlatformConfig.company_id == current_user.company_id,
            PlatformConfig.platform == platform,
        )
    )
    row = res.scalar_one_or_none()
    if row:
        row.config_json = json.dumps(merged)
    else:
        row = PlatformConfig(
            company_id=current_user.company_id,
            platform=platform,
            config_json=json.dumps(merged),
        )
        db.add(row)
    await db.commit()
    return {"platform": platform, "imported": list(env_vals.keys()), "saved": True}


# ─── POST /platform-config/import-env-all ────────────────────────────

@router.post("/import-env-all")
async def import_all_from_env(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import ทุก platform จาก .env ครั้งเดียว"""
    imported = {}
    for platform in PLATFORM_FIELDS:
        env_vals = _read_env_values(platform)
        if not env_vals:
            continue
        existing = await _get_config(db, current_user.company_id, platform)
        merged = {**existing, **env_vals}

        res = await db.execute(
            select(PlatformConfig).where(
                PlatformConfig.company_id == current_user.company_id,
                PlatformConfig.platform == platform,
            )
        )
        row = res.scalar_one_or_none()
        if row:
            row.config_json = json.dumps(merged)
        else:
            row = PlatformConfig(
                company_id=current_user.company_id,
                platform=platform,
                config_json=json.dumps(merged),
            )
            db.add(row)
        imported[platform] = list(env_vals.keys())

    if imported:
        await db.commit()
    return {"imported": imported, "total": len(imported)}


# ─── GET /platform-config/ (all) ────────────────────────────────────

@router.get("/")
async def get_all_configs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = {}
    for platform in PLATFORM_FIELDS:
        cfg = await _get_config(db, current_user.company_id, platform)
        result[platform] = bool(cfg and any(cfg.values()))
    return result
