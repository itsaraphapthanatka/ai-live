"use client";
import { useEffect, useRef, useState } from "react";

interface TikTokVideoPlayerProps {
  streamUrl: string;
  username: string;
  quality?: string;
  isDemo?: boolean;
}

export default function TikTokVideoPlayer({
  streamUrl,
  username,
  quality = "origin",
  isDemo = false,
}: TikTokVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    setLoading(true);
    setError(null);

    let hls: any = null;

    async function initPlayer() {
      const isHls =
        streamUrl.includes(".m3u8") || streamUrl.includes("hls");
      const isMp4 = streamUrl.includes(".mp4");

      if (isHls) {
        // Try native HLS first (Safari)
        if (video!.canPlayType("application/vnd.apple.mpegurl")) {
          video!.src = streamUrl;
          video!.load();
        } else {
          // Use hls.js
          const Hls = (await import("hls.js")).default;
          if (!Hls.isSupported()) {
            setError("เบราว์เซอร์ไม่รองรับการเล่นวิดีโอ HLS");
            setLoading(false);
            return;
          }
          hls = new Hls({
            lowLatencyMode: true,
            enableWorker: true,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 10,
            maxBufferLength: 30,
          });
          hlsRef.current = hls;
          hls.loadSource(streamUrl);
          hls.attachMedia(video!);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video!.play().catch(() => {});
            setLoading(false);
          });
          hls.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (data.fatal) {
              setError("ไม่สามารถโหลดสตรีมได้ — ลองรีเฟรชหน้าใหม่");
              setLoading(false);
            }
          });
          return;
        }
      } else {
        // FLV or mp4 fallback
        video!.src = streamUrl;
        video!.load();
      }

      video!.oncanplay = () => {
        video!.play().catch(() => {});
        setLoading(false);
      };
      video!.onerror = () => {
        setError("ไม่สามารถโหลดสตรีมได้");
        setLoading(false);
      };
    }

    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
        video.src = "";
      }
    };
  }, [streamUrl]);

  return (
    <div
      style={{
        position: "relative",
        background: "#000",
        borderRadius: 12,
        overflow: "hidden",
        aspectRatio: "9 / 16",
        maxHeight: 480,
        width: "100%",
        maxWidth: 270,
        margin: "0 auto",
        boxShadow: "0 0 0 2px rgba(0,242,234,0.3), 0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        muted={muted}
        playsInline
        autoPlay
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />

      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid rgba(0,242,234,0.3)",
              borderTop: "3px solid #00f2ea",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ fontSize: 13, color: "#00f2ea" }}>กำลังโหลดสตรีม...</span>
        </div>
      )}

      {/* Error overlay */}
      {error && !loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.8)",
            gap: 10,
            padding: 20,
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 32 }}>📡</span>
          <span style={{ fontSize: 13, color: "#ef4444" }}>{error}</span>
        </div>
      )}

      {/* Top bar — username + LIVE badge */}
      {!loading && !error && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "10px 12px",
            background: "linear-gradient(180deg,rgba(0,0,0,0.6) 0%,transparent 100%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 100,
              background: "#ff0050",
              fontSize: 11,
              fontWeight: 800,
              color: "white",
              letterSpacing: 0.5,
            }}
          >
            ● LIVE
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "white" }}>
            @{username}
          </span>
          {isDemo && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                color: "rgba(255,255,255,0.5)",
                fontStyle: "italic",
              }}
            >
              Demo
            </span>
          )}
          {quality && quality !== "origin" && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              {quality}
            </span>
          )}
        </div>
      )}

      {/* Mute button */}
      {!loading && !error && (
        <button
          onClick={() => {
            setMuted((v) => !v);
            if (videoRef.current) videoRef.current.muted = !muted;
          }}
          title={muted ? "เปิดเสียง" : "ปิดเสียง"}
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "white",
            fontSize: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
