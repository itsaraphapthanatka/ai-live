from openai import AsyncOpenAI
from app.config import settings

_client = None


def get_openai_client(api_key: str = "") -> AsyncOpenAI:
    global _client
    key = api_key or settings.OPENAI_API_KEY
    if _client is None or api_key:
        return AsyncOpenAI(api_key=key)
    return _client


async def get_client_for_company(company_id: int) -> AsyncOpenAI:
    """อ่าน OpenAI key จาก DB ถ้ามี ไม่งั้นใช้จาก settings"""
    try:
        from app.database import AsyncSessionLocal
        from app.routers.platform_config import get_company_config
        async with AsyncSessionLocal() as db:
            cfg = await get_company_config(db, company_id, "openai")
            key = cfg.get("api_key") or settings.OPENAI_API_KEY
            return AsyncOpenAI(api_key=key)
    except Exception:
        return get_openai_client()


TONE_MAP = {
    "friendly": "เป็นกันเอง สนุกสนาน และน่าเชื่อถือ",
    "luxury": "หรูหรา สง่างาม และมีระดับ",
    "energetic": "กระตือรือร้น มีพลังงานสูง และโน้มน้าวใจ",
    "professional": "มืออาชีพ น่าเชื่อถือ และตรงประเด็น",
}

LANGUAGE_MAP = {
    "th": "ภาษาไทย",
    "en": "English",
    "zh": "中文",
}


async def generate_live_script(
    product_name: str,
    product_price: str = "",
    product_highlights: str = "",
    promotion: str = "",
    language: str = "th",
    tone: str = "friendly",
    business_type: str = "",
) -> str:
    client = get_openai_client()
    tone_desc = TONE_MAP.get(tone, tone)
    lang_desc = LANGUAGE_MAP.get(language, language)

    prompt = f"""คุณคือ AI Host ผู้เชี่ยวชาญด้าน Live Commerce
    
สร้าง script สำหรับ Live Selling ใน{lang_desc} สำหรับสินค้าต่อไปนี้:

ชื่อสินค้า: {product_name}
ราคา: {product_price or 'ไม่ระบุ'}
จุดขายหลัก: {product_highlights or 'ไม่ระบุ'}
โปรโมชัน: {promotion or 'ไม่มี'}
ประเภทธุรกิจ: {business_type or 'ทั่วไป'}
น้ำเสียง (tone): {tone_desc}

กรุณาสร้าง script แบบ Live Selling ที่สมบูรณ์ ประกอบด้วย:
1. การทักทายและแนะนำตัว (30 วินาที)
2. แนะนำสินค้า - จุดเด่น ประโยชน์ (2 นาที)
3. บอกราคาและโปรโมชัน (30 วินาที)
4. กระตุ้นการสั่งซื้อ / Call to Action (30 วินาที)
5. ตอบคำถามที่พบบ่อย (1 นาที)
6. ปิดการขาย (30 วินาที)

Script ต้องฟังดูเป็นธรรมชาติ ตอบโต้กับผู้ชมได้ และมี emoji ที่เหมาะสม"""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
        temperature=0.8,
    )
    return response.choices[0].message.content


async def generate_comment_reply(
    comment: str,
    product_name: str = "",
    language: str = "th",
) -> str:
    client = get_openai_client()
    lang_desc = LANGUAGE_MAP.get(language, language)

    prompt = f"""คุณคือ AI Sales Agent ตอบคอมเมนต์ใน Live Commerce ใน{lang_desc}

สินค้า: {product_name or 'ทั่วไป'}
คอมเมนต์จากลูกค้า: "{comment}"

กรุณาตอบแบบ:
- สั้น กระชับ ไม่เกิน 2-3 ประโยค
- เป็นมิตร โน้มน้าวใจ
- กระตุ้นให้สั่งซื้อหรือถามข้อมูลเพิ่ม
- ใช้ emoji ที่เหมาะสม"""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0.7,
    )
    return response.choices[0].message.content
