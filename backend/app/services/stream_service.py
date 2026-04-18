import asyncio
import subprocess
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Track active stream processes: session_id -> subprocess
_active_streams: dict[int, subprocess.Popen] = {}


def build_ffmpeg_command(
    avatar_path: str,
    audio_path: str,
    rtmp_url: str,
    stream_key: str,
) -> list[str]:
    """Build FFmpeg command for RTMP push streaming."""
    rtmp_full = f"{rtmp_url.rstrip('/')}/{stream_key}"
    return [
        "ffmpeg",
        "-re",
        "-stream_loop", "-1",
        "-i", avatar_path,
        "-stream_loop", "-1",
        "-i", audio_path,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-maxrate", "3000k",
        "-bufsize", "6000k",
        "-pix_fmt", "yuv420p",
        "-g", "50",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ar", "44100",
        "-f", "flv",
        rtmp_full,
    ]


async def start_stream(
    session_id: int,
    avatar_path: str,
    audio_path: str,
    rtmp_url: str,
    stream_key: str,
) -> dict:
    """Start an FFmpeg RTMP stream. Returns status dict."""
    if session_id in _active_streams:
        return {"status": "already_running", "session_id": session_id}

    try:
        cmd = build_ffmpeg_command(avatar_path, audio_path, rtmp_url, stream_key)
        logger.info(f"Starting stream session {session_id}: {' '.join(cmd)}")

        # NOTE: On Windows local dev, this will fail gracefully if FFmpeg not installed
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        _active_streams[session_id] = process
        return {
            "status": "started",
            "session_id": session_id,
            "pid": process.pid,
            "started_at": datetime.utcnow().isoformat(),
        }
    except FileNotFoundError:
        logger.warning("FFmpeg not found — stream is mocked in local dev mode")
        return {
            "status": "mock",
            "session_id": session_id,
            "message": "FFmpeg not found. Stream is simulated in dev mode.",
        }
    except Exception as e:
        logger.error(f"Stream start error: {e}")
        return {"status": "error", "message": str(e)}


async def stop_stream(session_id: int) -> dict:
    """Stop an active FFmpeg stream."""
    process = _active_streams.pop(session_id, None)
    if process is None:
        return {"status": "not_running", "session_id": session_id}

    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()

    return {"status": "stopped", "session_id": session_id}


def get_stream_status(session_id: int) -> dict:
    """Get status of a stream session."""
    process = _active_streams.get(session_id)
    if process is None:
        return {"status": "idle", "session_id": session_id}

    poll = process.poll()
    if poll is None:
        return {"status": "live", "session_id": session_id, "pid": process.pid}
    else:
        _active_streams.pop(session_id, None)
        return {"status": "ended", "session_id": session_id, "exit_code": poll}
