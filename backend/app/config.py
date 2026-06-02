from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./ailive.db"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    OPENAI_API_KEY: str = ""
    REDIS_URL: str = "redis://localhost:6379/0"
    FRONTEND_URL: str = "http://localhost:3000"
    MEDIA_DIR: str = "/app/media"
    HEYGEN_API_KEY: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
