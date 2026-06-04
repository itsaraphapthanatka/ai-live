"use client";
import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { heygenApi } from "@/lib/api";

export interface HeyGenAvatarHandle {
  speak: (text: string) => Promise<void>;
}

interface Props {
  avatarId: string;
  onReady?: () => void;
  onError?: (msg: string) => void;
}

const HeyGenAvatar = forwardRef<HeyGenAvatarHandle, Props>(
  ({ avatarId, onReady, onError }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const avatarRef = useRef<any>(null);
    const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const [statusText, setStatusText] = useState("กดเริ่มเพื่อเปิด Avatar");

    // Expose speak() to parent
    useImperativeHandle(ref, () => ({
      speak: async (text: string) => {
        if (!avatarRef.current || status !== "ready") return;
        try {
          await avatarRef.current.speak({ text, taskType: "repeat" });
        } catch (e) {
          console.error("[HeyGen] speak error:", e);
        }
      },
    }));

    async function startAvatar() {
      setStatus("loading");
      setStatusText("กำลังเชื่อมต่อ HeyGen...");
      try {
        // 1. ขอ token จาก backend
        const { token } = await heygenApi.token();

        // 2. import SDK (dynamic to avoid SSR issues)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = await import("@heygen/streaming-avatar" as any);
        const StreamingAvatar = mod.default || mod.StreamingAvatar;
        const StreamingEvents = mod.StreamingEvents;

        // 3. สร้าง avatar instance
        const avatar = new StreamingAvatar({ token });
        avatarRef.current = avatar;

        // 4. event listeners
        avatar.on(StreamingEvents.STREAM_READY, (e: any) => {
          if (videoRef.current && e.detail) {
            videoRef.current.srcObject = e.detail;
            videoRef.current.play().catch(() => {});
          }
          setStatus("ready");
          setStatusText("Avatar พร้อมแล้ว 🟢");
          onReady?.();
        });

        avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
          setStatus("idle");
          setStatusText("Avatar ถูกตัดการเชื่อมต่อ");
          avatarRef.current = null;
        });

        // 5. เริ่ม streaming
        await avatar.createStartAvatar({
          avatarName: avatarId,
          quality: "high",
          language: "th",
        });

        setStatusText("กำลังโหลด avatar...");
      } catch (e: any) {
        const msg = e?.message || "ไม่สามารถเชื่อมต่อ HeyGen ได้";
        setStatus("error");
        setStatusText(msg);
        onError?.(msg);
      }
    }

    async function stopAvatar() {
      if (avatarRef.current) {
        try { await avatarRef.current.stopAvatar(); } catch {}
        avatarRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setStatus("idle");
      setStatusText("กดเริ่มเพื่อเปิด Avatar");
    }

    // cleanup on unmount
    useEffect(() => () => { stopAvatar(); }, []);

    return (
      <div style={{
        borderRadius: 16, overflow: "hidden", background: "#000",
        position: "relative", aspectRatio: "9/16", maxHeight: 480,
        border: "2px solid var(--border-subtle)",
      }}>
        {/* Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: status === "ready" ? "block" : "none" }}
        />

        {/* Overlay when not ready */}
        {status !== "ready" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 14, background: "#111",
          }}>
            <div style={{ fontSize: 48 }}>🤖</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", padding: "0 20px" }}>
              {statusText}
            </div>
            {status === "loading" && (
              <div style={{
                width: 32, height: 32, border: "3px solid rgba(99,102,241,0.3)",
                borderTopColor: "#6366f1", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
            )}
            {(status === "idle" || status === "error") && (
              <button onClick={startAvatar} className="btn btn-primary btn-sm">
                {status === "error" ? "🔄 ลองใหม่" : "▶ เริ่ม Avatar"}
              </button>
            )}
          </div>
        )}

        {/* Ready badge */}
        {status === "ready" && (
          <div style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(34,197,94,0.9)", borderRadius: 100,
            padding: "3px 10px", fontSize: 11, fontWeight: 700, color: "white",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "white", display: "inline-block" }} />
            LIVE
          </div>
        )}

        {/* Stop button */}
        {status === "ready" && (
          <button onClick={stopAvatar} style={{
            position: "absolute", top: 10, right: 10,
            background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "white", cursor: "pointer",
          }}>
            ⏹ หยุด
          </button>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
);

HeyGenAvatar.displayName = "HeyGenAvatar";
export default HeyGenAvatar;
