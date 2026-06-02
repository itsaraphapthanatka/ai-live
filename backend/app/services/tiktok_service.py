from __future__ import annotations
import asyncio
import json
import logging
from datetime import datetime
from typing import Optional
from fastapi import WebSocket
from sqlalchemy import select
import httpx
import websockets
from app.config import settings
from app.database import AsyncSessionLocal
from app.models.stream import StreamSession, Comment

logger = logging.getLogger(__name__)

API_BASE = "https://api.tik.tools"
WS_BASE = "wss://api.tik.tools"


class TikTokConnection:
    def __init__(self, session_id: int, unique_id: str, campaign_id: int):
        self.session_id = session_id
        self.unique_id = unique_id.lstrip("@")
        self.campaign_id = campaign_id
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._task: Optional[asyncio.Task] = None
        self._frontend_ws: list[WebSocket] = []
        self.viewer_count = 0
        self.comment_count = 0
        self.stream_url: Optional[str] = None
        self.stream_quality: str = "origin"
        self._jwt_token: Optional[str] = None
        self._should_reconnect = True
        self._reconnect_delay = 3
        self._reconnect_attempts = 0
        self._max_reconnect_attempts = 1

    def add_frontend_ws(self, ws: WebSocket):
        self._frontend_ws.append(ws)

    def remove_frontend_ws(self, ws: WebSocket):
        self._frontend_ws.remove(ws)

    async def broadcast(self, event_type: str, data: dict):
        dead = []
        for ws in self._frontend_ws:
            try:
                await ws.send_json({"event": event_type, "data": data})
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._frontend_ws.remove(ws)

    def _browser_headers(self) -> dict:
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Origin": "https://tik.tools",
            "Referer": "https://tik.tools/",
        }

    async def _get_jwt(self) -> Optional[str]:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    f"{API_BASE}/authentication/jwt?apiKey={settings.TIKTOOL_API_KEY}",
                    headers=self._browser_headers(),
                    json={
                        "allowed_creators": [self.unique_id],
                        "expire_after": 600,
                        "max_websockets": 1,
                    },
                    timeout=10,
                )
                j = r.json()
                token = j.get("data", {}).get("token")
                if not token:
                    logger.error(f"TikTok JWT auth failed: {j}")
                return token
        except Exception as e:
            logger.error(f"TikTok JWT request failed: {e}")
            return None

    async def _handle_message(self, raw: str):
        try:
            e = json.loads(raw)
        except json.JSONDecodeError:
            return

        event = e.get("event")
        data = e.get("data", {})
        user = data.get("user") or {}
        nickname = user.get("nickname") or data.get("user_unique_id") or ""

        if event == "roomInfo":
            return

        if event == "streamEnd":
            logger.info(f"TikTok stream ended for @{self.unique_id}")
            await self.broadcast("streamEnd", {})
            self._should_reconnect = False
            return

        if event == "connected":
            msg = {
                "unique_id": self.unique_id,
                "session_id": self.session_id,
            }
            if self.stream_url:
                msg["stream_url"] = self.stream_url
                msg["stream_quality"] = self.stream_quality
            await self.broadcast("connected", msg)
            return

        if event == "chat":
            comment_text = data.get("comment", "")
            await self.broadcast("chat", {
                "user": nickname,
                "text": comment_text,
                "timestamp": datetime.utcnow().isoformat(),
            })
            self.comment_count += 1
            await self._save_comment(nickname, comment_text)
            return

        if event == "gift":
            gift_name = data.get("giftName", "")
            repeat = data.get("repeatCount", 1)
            await self.broadcast("gift", {
                "user": nickname or data.get("user_unique_id", ""),
                "gift": gift_name,
                "count": repeat,
            })
            return

        if event == "like":
            count = data.get("likeCount", 0)
            await self.broadcast("like", {
                "user": nickname or data.get("user_unique_id", ""),
                "count": count,
            })
            return

        if event == "follow":
            await self.broadcast("follow", {
                "user": nickname or data.get("user_unique_id", ""),
            })
            return

        if event in ("roomUser", "roomUserSeq"):
            self.viewer_count = data.get("viewerCount", 0) or data.get("totalUser", 0)
            await self.broadcast("viewers", {
                "count": self.viewer_count,
            })
            return

        logger.debug(f"Unhandled event: {event} | {raw[:200]}")

    async def _save_comment(self, user: str, text: str):
        try:
            async with AsyncSessionLocal() as db:
                c = Comment(
                    session_id=self.session_id,
                    user_name=user,
                    message=text,
                )
                db.add(c)
                await db.commit()
        except Exception as e:
            logger.warning(f"Failed to save comment: {e}")

    async def _resolve_room_id(self, resolve_url: str, patterns: list[str]) -> Optional[str]:
        try:
            headers = self._browser_headers()
            headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            headers["Accept-Language"] = "en-US,en;q=0.9"
            async with httpx.AsyncClient() as client:
                r = await client.get(resolve_url, headers=headers, timeout=15, follow_redirects=True)
                html = r.text
                import re
                for pat in patterns:
                    m = re.search(pat, html)
                    if m:
                        room_id = m.group(1)
                        logger.info(f"Resolved room_id: {room_id}")
                        return room_id
                logger.warning(f"No room_id found in TikTok page")
                return None
        except Exception as e:
            logger.warning(f"Resolve room_id failed: {e}")
            return None

    async def _check_stream_live(self) -> Optional[str]:
        api_key = settings.TIKTOOL_API_KEY
        if not api_key:
            return None
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{API_BASE}/webcast/check_alive",
                    headers=self._browser_headers(),
                    params={"apiKey": api_key, "unique_id": self.unique_id},
                    timeout=10,
                )
                j = r.json()
                if j.get("status_code") == 0:
                    data = j.get("data", [])
                    if data and data[0].get("alive"):
                        room_id = data[0].get("room_id")
                        logger.info(f"TikTok @{self.unique_id} is LIVE (room={room_id})")
                        return room_id

                    action = j.get("action")
                    if action == "resolve_required":
                        resolve_url = j.get("resolve_url")
                        patterns = j.get("room_id_patterns", [])
                        if resolve_url and patterns:
                            logger.info(f"Resolving room_id from TikTok page...")
                            room_id = await self._resolve_room_id(resolve_url, patterns)
                            if room_id:
                                return await self._check_alive_with_room(room_id)

                logger.info(f"TikTok @{self.unique_id} not confirmed live (will try WS anyway)")
                return None
        except Exception as e:
            logger.warning(f"Stream check failed (non-fatal): {e}")
            return None

    async def _check_alive_with_room(self, room_id: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{API_BASE}/webcast/check_alive",
                    headers=self._browser_headers(),
                    params={"apiKey": settings.TIKTOOL_API_KEY, "unique_id": self.unique_id, "room_id": room_id},
                    timeout=10,
                )
                j = r.json()
                if j.get("status_code") == 0:
                    data = j.get("data", [])
                    if data and data[0].get("alive"):
                        logger.info(f"TikTok @{self.unique_id} confirmed LIVE (room={room_id})")
                        return room_id
                return None
        except Exception as e:
            logger.warning(f"check_alive with room failed: {e}")
            return None

    async def _fetch_stream_url(self, room_id: str) -> Optional[str]:
        api_key = settings.TIKTOOL_API_KEY
        if not api_key:
            return None
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    f"{API_BASE}/webcast/room_video",
                    headers=self._browser_headers(),
                    params={"apiKey": api_key},
                    json={"unique_id": self.unique_id, "room_id": room_id},
                    timeout=15,
                )
                j = r.json()
                if j.get("status_code") == 0:
                    data = j.get("data", {})
                    urls = data.get("stream_urls", {})
                    quality = data.get("default_quality", "origin")
                    self.stream_quality = quality
                    quality_urls = urls.get(quality, urls.get("origin", {}))
                    hls = quality_urls.get("hls") or quality_urls.get("flv")
                    if hls:
                        logger.info(f"Got stream URL ({quality}): {hls[:80]}...")
                        return hls
                logger.warning(f"No stream URL in response: {j}")
                return None
        except Exception as e:
            logger.warning(f"Stream URL fetch failed: {e}")
            return None

    async def connect(self):
        if not settings.TIKTOOL_API_KEY:
            logger.warning("TIKTOOL_API_KEY not set, using demo mode")
            self.stream_url = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
            self.stream_quality = "origin"
            await self.broadcast("connected", {
                "unique_id": self.unique_id,
                "session_id": self.session_id,
                "stream_url": self.stream_url,
                "stream_quality": self.stream_quality,
                "demo": True,
            })
            return

        token = await self._get_jwt()
        if not token:
            await self.broadcast("error", {"message": "Failed to authenticate with TikTok"})
            return

        try:
            room_id = await self._check_stream_live()
            if room_id:
                stream_url = await self._fetch_stream_url(room_id)
                if stream_url:
                    self.stream_url = stream_url
        except Exception as e:
            logger.warning(f"Stream URL fetch failed (non-fatal): {e}")

        self._should_reconnect = True
        self._reconnect_attempts = 0
        self._task = asyncio.create_task(self._run_ws(token))

    async def _run_ws(self, token: str):
        url = f"{WS_BASE}?uniqueId={self.unique_id}&jwtKey={token}"
        while self._should_reconnect and self._reconnect_attempts <= self._max_reconnect_attempts:
            try:
                async with websockets.connect(url) as ws:
                    self._ws = ws
                    logger.info(f"TikTok WS connected for @{self.unique_id}")
                    if self._reconnect_attempts > 0:
                        await self.broadcast("reconnected", {})
                    self._reconnect_attempts = 0
                    async for raw in ws:
                        await self._handle_message(raw)
            except websockets.exceptions.ConnectionClosed as e:
                logger.warning(f"TikTok WS closed: code={e.code}")
                if e.code == 4001:
                    self._should_reconnect = False
                    await self.broadcast("error", {"message": "Not live or invalid user"})
                    break
                self._reconnect_attempts += 1
                if self._reconnect_attempts <= self._max_reconnect_attempts:
                    await asyncio.sleep(self._reconnect_delay)
            except Exception as e:
                logger.error(f"TikTok WS error: {e}")
                self._reconnect_attempts += 1
                if self._reconnect_attempts <= self._max_reconnect_attempts:
                    await asyncio.sleep(self._reconnect_delay)

        await self.broadcast("disconnected", {})

    async def disconnect(self):
        self._should_reconnect = False
        if self._ws:
            await self._ws.close()
        if self._task:
            self._task.cancel()
        await self._update_session_end()

    async def _update_session_end(self):
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(StreamSession).where(StreamSession.id == self.session_id)
                )
                session = result.scalar_one_or_none()
                if session:
                    session.ended_at = datetime.utcnow()
                    session.viewer_count = self.viewer_count
                    session.comment_count = self.comment_count
                    await db.commit()
        except Exception as e:
            logger.warning(f"Failed to update session end: {e}")
