# AI Live Agency — Walkthrough

## ✅ สิ่งที่สร้างเสร็จสมบูรณ์

### Frontend (Next.js 15 + TailwindCSS)
| หน้า | เส้นทาง | สถานะ |
|---|---|---|
| Login | `/login` | ✅ |
| Register | `/register` | ✅ |
| Dashboard Overview | `/dashboard` | ✅ |
| Campaigns List | `/dashboard/campaigns` | ✅ |
| Campaign Builder | `/dashboard/campaigns/new` | ✅ |
| Live Control Room | `/dashboard/live` | ✅ |
| Analytics | `/dashboard/analytics` | ✅ |
| Leads | `/dashboard/leads` | ✅ |
| Settings | `/dashboard/settings` | ✅ |
| Billing | `/dashboard/billing` | ✅ |

### Backend (FastAPI + SQLAlchemy + SQLite)
| Module | สถานะ |
|---|---|
| Auth (JWT + bcrypt) | ✅ |
| Multi-tenant (company_id) | ✅ |
| Campaign CRUD | ✅ |
| AI Script Generator (GPT-4o) | ✅ |
| TTS Engine (OpenAI) | ✅ |
| Comment AI Reply | ✅ |
| Stream Engine (FFmpeg/mock) | ✅ |
| Leads API | ✅ |
| Analytics API | ✅ |
| Database models (6 tables) | ✅ |

---

## 🚀 วิธีเริ่มใช้งาน

### Frontend
```bash
cd "ai live/frontend"
npm run dev
# เปิด http://localhost:3000
```

### Backend
> ต้องติดตั้ง Python 3.11+ ก่อน

```bash
cd "ai live/backend"
# สร้าง .env จาก example
copy .env.example .env
# ใส่ OpenAI API Key ใน .env

pip install -r requirements.txt
uvicorn app.main:app --reload
# API docs: http://localhost:8000/docs
```

---

## 🔐 ตัวอย่าง Login (Demo Mode)
เมื่อ Backend ไม่ได้เปิด — หน้า Dashboard จะแสดงข้อมูล Demo แทน

---

## 📸 Screenshots

![Login Page](file:///C:/Users/WIN11/.gemini/antigravity/brain/ac53e73d-e2c9-4b29-b265-abb3b5760061/login_page_1776482041941.png)

![Dashboard Overview](file:///C:/Users/WIN11/.gemini/antigravity/brain/ac53e73d-e2c9-4b29-b265-abb3b5760061/dashboard_main_1776482121562.png)

![Campaign Builder](file:///C:/Users/WIN11/.gemini/antigravity/brain/ac53e73d-e2c9-4b29-b265-abb3b5760061/campaign_new_form_1776482132549.png)

![Live Control Room](file:///C:/Users/WIN11/.gemini/antigravity/brain/ac53e73d-e2c9-4b29-b265-abb3b5760061/live_room_view_1776482139575.png)

---

## 📁 โครงสร้างไฟล์
```
ai live/
├── frontend/               # Next.js 15
│   ├── app/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── dashboard/
│   │       ├── layout.tsx  (sidebar + auth guard)
│   │       ├── page.tsx    (overview)
│   │       ├── campaigns/
│   │       ├── live/
│   │       ├── analytics/
│   │       ├── leads/
│   │       ├── settings/
│   │       └── billing/
│   └── lib/
│       ├── api.ts          (Axios client)
│       └── store.ts        (Zustand)
│
├── backend/
│   └── app/
│       ├── main.py         (FastAPI)
│       ├── models/         (6 DB tables)
│       ├── routers/        (auth/campaigns/ai/stream/leads/analytics)
│       └── services/       (ai_service/tts_service/stream_service)
│
└── docker-compose.yml
```

---

## ⚠️ สิ่งที่ต้องทำก่อน Deploy จริง

1. **Python** — ติดตั้ง [Python 3.11+](https://python.org) แล้วรัน `pip install -r requirements.txt`
2. **OpenAI API Key** — ใส่ใน `backend/.env`: `OPENAI_API_KEY=sk-xxx`
3. **FFmpeg** — ติดตั้งบน VPS Linux สำหรับ RTMP streaming
4. **PostgreSQL** — ใช้ `docker-compose.yml` หรือ Supabase แทน SQLite
5. **Payment** — เชื่อม Omise/Stripe สำหรับ Billing

## 🎬 Recording
![Full Dashboard Tour](file:///C:/Users/WIN11/.gemini/antigravity/brain/ac53e73d-e2c9-4b29-b265-abb3b5760061/dashboard_full_tour_1776482080497.webp)
