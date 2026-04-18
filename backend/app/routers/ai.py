from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from app.models.user import User
from app.schemas.schemas import ScriptGenerateRequest, TTSRequest, CommentReplyRequest
from app.auth import get_current_user
from app.services import ai_service, tts_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/generate-script")
async def generate_script(
    data: ScriptGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a live selling script using GPT-4o."""
    try:
        script = await ai_service.generate_live_script(
            product_name=data.product_name,
            product_price=data.product_price or "",
            product_highlights=data.product_highlights or "",
            promotion=data.promotion or "",
            language=data.language,
            tone=data.tone,
            business_type=data.business_type or "",
        )
        return {"script": script, "language": data.language, "tone": data.tone}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/tts")
async def text_to_speech(
    data: TTSRequest,
    current_user: User = Depends(get_current_user),
):
    """Convert text to speech. Returns base64 audio data URL."""
    try:
        audio_b64 = await tts_service.text_to_speech_base64(data.text, data.voice)
        return {"audio": audio_b64, "voice": data.voice}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")


@router.post("/tts/stream")
async def text_to_speech_stream(
    data: TTSRequest,
    current_user: User = Depends(get_current_user),
):
    """Convert text to speech. Returns raw mp3 audio bytes."""
    try:
        audio_bytes = await tts_service.text_to_speech(data.text, data.voice)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": 'attachment; filename="tts.mp3"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")


@router.post("/reply-comment")
async def reply_comment(
    data: CommentReplyRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate AI reply for a live comment."""
    try:
        reply = await ai_service.generate_comment_reply(
            comment=data.comment,
            product_name=data.product_name or "",
            language=data.language,
        )
        return {"reply": reply, "original_comment": data.comment}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI reply failed: {str(e)}")


@router.get("/voices")
async def list_voices(current_user: User = Depends(get_current_user)):
    """List available TTS voices."""
    return {"voices": tts_service.VOICE_OPTIONS}
