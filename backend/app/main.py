from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import init_db
from app.config import settings
from app.routers import auth, campaigns, ai, stream, leads, analytics, tiktok, heygen, platforms, platform_config
from app.models import platform as _platform_model  # register model for create_all
from app.models import platform_config as _platform_config_model  # register model


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="AI Live Agency API",
    description="SaaS platform for AI-powered live commerce",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(campaigns.router)
app.include_router(ai.router)
app.include_router(stream.router)
app.include_router(leads.router)
app.include_router(analytics.router)
app.include_router(tiktok.router)
app.include_router(heygen.router)
app.include_router(platforms.router)
app.include_router(platform_config.router)


@app.get("/")
async def root():
    return {"message": "AI Live Agency API", "version": "1.0.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
