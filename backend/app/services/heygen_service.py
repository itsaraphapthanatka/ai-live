"""
HeyGen Streaming Avatar Service
ใช้ aiortc รับ WebRTC video+audio จาก HeyGen แล้วส่งต่อ RTMP ผ่าน PyAV
"""
from __future__ import annotations
import asyncio
import logging
from typing import Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

HEYGEN_API = "https://api.heygen.com"

# Global registry: tiktok_session_id → HeyGenAvatarStream
active_streams: dict[int, "HeyGenAvatarStream"] = {}

# Try importing optional heavy deps
try:
    from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
    import av
    AIORTC_AVAILABLE = True
except ImportError:
    AIORTC_AVAILABLE = False
    logger.warning("[HeyGen] aiortc/av not installed — HeyGen streaming unavailable")


class HeyGenAvatarStream:
    def __init__(self, tiktok_session_id: int, avatar_id: str, rtmp_url: str):
        self.tiktok_session_id = tiktok_session_id
        self.avatar_id = avatar_id
        self.rtmp_url = rtmp_url
        self.heygen_session_id: Optional[str] = None
        self.pc = None
        self._active = False
        self._output = None
        self._video_stream_av = None
        self._audio_stream_av = None
        self._mux_lock = asyncio.Lock()

    @property
    def is_active(self) -> bool:
        return self._active

    # ─── Start ──────────────────────────────────────────────────────
    async def start(self) -> dict:
        if not AIORTC_AVAILABLE:
            return {"ok": False, "error": "aiortc ยังไม่ได้ติดตั้ง — กรุณา rebuild Docker image"}

        try:
            # 1. สร้าง HeyGen streaming session
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    f"{HEYGEN_API}/v1/streaming.new",
                    headers={"X-Api-Key": settings.HEYGEN_API_KEY, "Content-Type": "application/json"},
                    json={
                        "quality": "high",
                        "avatar_name": self.avatar_id,
                        "voice": {"voice_id": ""},
                        "video_encoding": "H264",
                        "disable_idle_timeout": True,
                    },
                    timeout=30,
                )
                resp = r.json()

            if resp.get("code") != 100:
                return {"ok": False, "error": f"HeyGen: {resp.get('message', resp)}"}

            data = resp["data"]
            self.heygen_session_id = data["session_id"]
            sdp_offer = data["sdp"]
            ice_servers = data.get("ice_servers2", data.get("ice_servers", []))
            logger.info(f"[HeyGen] Session created: {self.heygen_session_id}")

            # 2. WebRTC via aiortc
            config = RTCConfiguration(
                iceServers=[
                    RTCIceServer(
                        urls=s["urls"],
                        username=s.get("username", ""),
                        credential=s.get("credential", ""),
                    )
                    for s in ice_servers
                ]
            )
            self.pc = RTCPeerConnection(configuration=config)
            video_ready = asyncio.Event()

            @self.pc.on("track")
            def on_track(track):
                logger.info(f"[HeyGen] Track: {track.kind}")
                if track.kind == "video":
                    asyncio.create_task(self._handle_video(track, video_ready))
                elif track.kind == "audio":
                    asyncio.create_task(self._handle_audio(track))

            # 3. SDP exchange
            await self.pc.setRemoteDescription(
                RTCSessionDescription(sdp=sdp_offer["sdp"], type=sdp_offer["type"])
            )
            answer = await self.pc.createAnswer()
            await self.pc.setLocalDescription(answer)

            # 4. ส่ง SDP answer กลับ HeyGen
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{HEYGEN_API}/v1/streaming.start",
                    headers={"X-Api-Key": settings.HEYGEN_API_KEY, "Content-Type": "application/json"},
                    json={
                        "session_id": self.heygen_session_id,
                        "sdp": {"type": answer.type, "sdp": answer.sdp},
                    },
                    timeout=30,
                )

            self._active = True

            # รอ video track ภายใน 15 วินาที
            try:
                await asyncio.wait_for(video_ready.wait(), timeout=15)
                logger.info(f"[HeyGen] Stream live → {self.rtmp_url}")
                return {"ok": True, "session_id": self.heygen_session_id}
            except asyncio.TimeoutError:
                await self.stop()
                return {"ok": False, "error": "Timeout รอ video track จาก HeyGen"}

        except Exception as e:
            logger.error(f"[HeyGen] start() error: {e}")
            return {"ok": False, "error": str(e)}

    # ─── Video handler ───────────────────────────────────────────────
    async def _open_output(self, width: int, height: int, fps: int, sample_rate: int = 16000):
        loop = asyncio.get_event_loop()

        def _open():
            out = av.open(self.rtmp_url, "w", format="flv")
            vs = out.add_stream("libx264", rate=fps)
            vs.width = width
            vs.height = height
            vs.pix_fmt = "yuv420p"
            vs.options = {"preset": "veryfast", "tune": "zerolatency", "b": "2500k"}
            as_ = out.add_stream("aac", rate=sample_rate)
            return out, vs, as_

        self._output, self._video_stream_av, self._audio_stream_av = await loop.run_in_executor(None, _open)

    async def _handle_video(self, track, ready_event: asyncio.Event):
        try:
            frame0 = await track.recv()
            img0 = frame0.to_ndarray(format="yuv420p")
            h, w = img0.shape[0], img0.shape[1]
            await self._open_output(w, h, 30)
            ready_event.set()
            await self._write_video_frame(frame0)

            while self._active:
                frame = await track.recv()
                await self._write_video_frame(frame)

        except Exception as e:
            logger.error(f"[HeyGen] video error: {e}")
            self._active = False
        finally:
            await self._close_output()

    async def _write_video_frame(self, frame):
        if not self._output or not self._video_stream_av:
            return
        try:
            img = frame.to_ndarray(format="yuv420p")
            vf = av.VideoFrame.from_ndarray(img, format="yuv420p")
            vf.pts = frame.pts
            vf.time_base = frame.time_base
            async with self._mux_lock:
                loop = asyncio.get_event_loop()
                def _w():
                    for pkt in self._video_stream_av.encode(vf):
                        self._output.mux(pkt)
                await loop.run_in_executor(None, _w)
        except Exception as e:
            logger.debug(f"[HeyGen] video write: {e}")

    # ─── Audio handler ───────────────────────────────────────────────
    async def _handle_audio(self, track):
        try:
            while self._active:
                frame = await track.recv()
                if not self._audio_stream_av:
                    continue
                try:
                    af = av.AudioFrame.from_ndarray(
                        frame.to_ndarray(), format="s16", layout="mono"
                    )
                    af.sample_rate = frame.sample_rate
                    af.pts = frame.pts
                    af.time_base = frame.time_base
                    async with self._mux_lock:
                        loop = asyncio.get_event_loop()
                        def _w():
                            for pkt in self._audio_stream_av.encode(af):
                                self._output.mux(pkt)
                        await loop.run_in_executor(None, _w)
                except Exception:
                    pass
        except Exception:
            pass

    async def _close_output(self):
        if self._output:
            try:
                loop = asyncio.get_event_loop()
                vs, as_, out = self._video_stream_av, self._audio_stream_av, self._output
                def _close():
                    if vs:
                        for pkt in vs.encode(None):
                            out.mux(pkt)
                    if as_:
                        for pkt in as_.encode(None):
                            out.mux(pkt)
                    out.close()
                await loop.run_in_executor(None, _close)
            except Exception:
                pass
            self._output = None

    # ─── Speak ──────────────────────────────────────────────────────
    async def speak(self, text: str) -> bool:
        if not self.heygen_session_id or not self._active:
            return False
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    f"{HEYGEN_API}/v1/streaming.task",
                    headers={"X-Api-Key": settings.HEYGEN_API_KEY, "Content-Type": "application/json"},
                    json={"session_id": self.heygen_session_id, "text": text, "task_type": "talk"},
                    timeout=10,
                )
                ok = r.json().get("code") == 100
                if ok:
                    logger.info(f"[HeyGen] Speaking: {text[:60]}")
                return ok
        except Exception as e:
            logger.error(f"[HeyGen] speak() error: {e}")
            return False

    # ─── Stop ───────────────────────────────────────────────────────
    async def stop(self):
        self._active = False
        if self.heygen_session_id:
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"{HEYGEN_API}/v1/streaming.stop",
                        headers={"X-Api-Key": settings.HEYGEN_API_KEY, "Content-Type": "application/json"},
                        json={"session_id": self.heygen_session_id},
                        timeout=10,
                    )
            except Exception:
                pass
        if self.pc:
            try:
                await self.pc.close()
            except Exception:
                pass
        self.heygen_session_id = None
        logger.info(f"[HeyGen] Stopped session {self.tiktok_session_id}")


# ─── Standalone functions (Video generation, not streaming) ─────────

async def generate_avatar_video(script: str, avatar_id: str, voice_id: str, api_key: str = "") -> str:
    """สร้าง HeyGen Avatar Video (async generation) — คืน video_id"""
    key = api_key or settings.HEYGEN_API_KEY
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{HEYGEN_API}/v2/video/generate",
            headers={"X-Api-Key": key, "Content-Type": "application/json"},
            json={
                "video_inputs": [{
                    "character": {
                        "type": "avatar",
                        "avatar_id": avatar_id,
                        "avatar_style": "normal",
                    },
                    "voice": {
                        "type": "text",
                        "input_text": script[:1500],
                        "voice_id": voice_id,
                    },
                }],
                "dimension": {"width": 1280, "height": 720},
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        video_id = data.get("data", {}).get("video_id")
        if not video_id:
            raise Exception(f"HeyGen generate error: {data}")
        return video_id


async def get_video_status(video_id: str, api_key: str = "") -> dict:
    """ดูสถานะ video generation"""
    key = api_key or settings.HEYGEN_API_KEY
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{HEYGEN_API}/v1/video_status.get",
            params={"video_id": video_id},
            headers={"X-Api-Key": key},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json().get("data", {})
        return {
            "status": data.get("status", "processing"),
            "video_url": data.get("video_url"),
            "thumbnail_url": data.get("thumbnail_url"),
            "error": data.get("error"),
        }
