"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { streamApi, campaignApi, aiApi, leadsApi, tiktokApi, heygenApi, platformApi } from "@/lib/api";
import dynamic from "next/dynamic";
const HeyGenAvatar = dynamic(() => import("@/components/HeyGenAvatar"), { ssr: false });
const TikTokVideoPlayer = dynamic(() => import("@/components/TikTokVideoPlayer"), { ssr: false });
import type { HeyGenAvatarHandle } from "@/components/HeyGenAvatar";
import { useCallback } from "react";
import { useUIStore } from "@/lib/store";

const PLATFORMS = [
  { key: "facebook", icon: "📘", label: "Facebook Live", color: "#1877f2" },
  { key: "youtube", icon: "📺", label: "YouTube Live", color: "#ff0000" },
  { key: "tiktok", icon: "🎵", label: "TikTok Live", color: "#00f2ea" },
];

const DEMO_COMMENTS = [
  { id: 1, user_name: "สมหญิง สวยงาม", message: "มีโปรโมชันอยู่ไหมคะ?", ai_reply: "มีเลยค่ะ! สั่งวันนี้รับส่วนลด 15% ทันที 🔥", created_at: new Date().toISOString() },
  { id: 2, user_name: "นายก ดีมาก", message: "ราคาเท่าไหร่ครับ", ai_reply: "ราคา 890฿ เท่านั้น ส่งฟรีทั่วประเทศ! 🚀", created_at: new Date().toISOString() },
  { id: 3, user_name: "คุณแม่บ้าน", message: "สั่งได้เลยไหม", ai_reply: "ได้เลยค่ะ! กด Link ด้านล่าง หรือพิมพ์ว่า 'สนใจ' ได้เลย! 💌", created_at: new Date().toISOString() },
];

export default function LivePage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaign");
  const addToast = useUIStore((s) => s.addToast);

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [selectedPlatform, setSelectedPlatform] = useState("tiktok");

  // TikTok mode: "monitor" = Live ผ่านมือถือแล้วให้ AI ดูคอมเมนต์, "rtmp" = push ผ่าน PC
  const [tiktokMode, setTiktokMode] = useState<"monitor" | "rtmp">("monitor");
  const [tiktokUsername, setTiktokUsername] = useState("");
  const [tiktokStatus, setTiktokStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [tiktokStreamUrl, setTiktokStreamUrl] = useState<string | null>(null);
  const [tiktokStreamQuality, setTiktokStreamQuality] = useState<string>("origin");
  const [tiktokStreamIsDemo, setTiktokStreamIsDemo] = useState(false);
  const [gifts, setGifts] = useState<{ user: string; gift: string; count: number }[]>([]);

  // RTMP fields (non-TikTok or TikTok rtmp mode)
  const [rtmpUrl, setRtmpUrl] = useState("");
  const [rtmpKey, setRtmpKey] = useState("");

  // Platform connections (Facebook / YouTube auto-live)
  const [platformConnections, setPlatformConnections] = useState<Record<string, any>>({});
  const [activeLiveId, setActiveLiveId] = useState<string | null>(null); // FB/YT live video ID

  const [session, setSession] = useState<any>(null);
  const [isLive, setIsLive] = useState(false);
  const [comments, setComments] = useState<any[]>(DEMO_COMMENTS);
  const [leads, setLeads] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [stats, setStats] = useState({ viewers: 0, comments: 0, leads: 0, duration: 0 });
  const [starting, setStarting] = useState(false);
  const [autoReply, setAutoReply] = useState(false);
  const [autoReplyPending, setAutoReplyPending] = useState(0);
  const [totalAutoReplied, setTotalAutoReplied] = useState(0);

  // HeyGen Avatar
  const [heygenEnabled, setHeygenEnabled] = useState(false);
  const [heygenAvatarId, setHeygenAvatarId] = useState("");
  const [heygenAvatars, setHeygenAvatars] = useState<any[]>([]);
  const heygenRef = useRef<HeyGenAvatarHandle>(null);
  const heygenEnabledRef = useRef(false);

  // TTS voice speaker
  const [speakReplies, setSpeakReplies] = useState(false);
  const [ttsVoice, setTtsVoice] = useState("nova");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakQueue, setSpeakQueue] = useState(0); // pending TTS count

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Audio queue: play one at a time, no overlap
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingAudioRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Refs for WS closure (always latest values)
  const speakRepliesRef = useRef(false);
  const ttsVoiceRef = useRef("nova");

  useEffect(() => {
    // โหลด campaigns
    campaignApi.list()
      .then((data) => {
        setCampaigns(data);
        const pre = data.find((c: any) => c.id === Number(campaignId));
        if (pre) setSelectedCampaign(pre);
        else if (data.length > 0) setSelectedCampaign(data[0]);
      })
      .catch(() => {
        const demo = [{ id: 1, name: "แคมเปญทดสอบ", product_name: "สินค้า", status: "draft" }];
        setCampaigns(demo);
        setSelectedCampaign(demo[0]);
      });

    // ─── Restore active TikTok session ───────────────────────────
    tiktokApi.active()
      .then((sessions: any[]) => {
        if (!sessions?.length) return;
        const s = sessions[0]; // session แรกที่กำลัง live
        setSession({ id: s.session_id, status: "live", mode: "monitor" });
        setIsLive(true);
        setTiktokUsername(s.unique_id || "");
        setTiktokStatus("connected");
        addToast(`🔴 Resumed: กำลัง Live @${s.unique_id} อยู่`, "success");
        // reconnect WS
        connectTikTokWS(s.session_id);
        // restore stats
        setStats((prev) => ({ ...prev, viewers: s.viewers || 0, comments: s.comments || 0 }));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  useEffect(() => {
    if (selectedPlatform === "tiktok") setRtmpUrl("rtmp://a-rtmp.tiktok.com/live/");
    else if (selectedPlatform === "facebook") setRtmpUrl("rtmps://live-api-s.facebook.com:443/rtmp/");
    else if (selectedPlatform === "youtube") setRtmpUrl("rtmp://a.rtmp.youtube.com/live2/");
  }, [selectedPlatform]);

  useEffect(() => {
    if (isLive) {
      timerRef.current = setInterval(() => setStats((s) => ({ ...s, duration: s.duration + 1 })), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isLive]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // Sync refs with state for WS closure
  useEffect(() => { speakRepliesRef.current = speakReplies; }, [speakReplies]);
  useEffect(() => { ttsVoiceRef.current = ttsVoice; }, [ttsVoice]);
  useEffect(() => { heygenEnabledRef.current = heygenEnabled; }, [heygenEnabled]);

  // โหลด platform connections (Facebook/YouTube)
  useEffect(() => {
    platformApi.list()
      .then((conns: any[]) => {
        const map: Record<string, any> = {};
        conns.forEach((c) => { map[c.platform] = c; });
        setPlatformConnections(map);
      })
      .catch(() => {});
  }, []);

  // โหลด HeyGen avatars ถ้ามี API key
  useEffect(() => {
    heygenApi.avatars()
      .then((r: any) => {
        setHeygenAvatars(r.avatars || []);
        if (r.avatars?.length) setHeygenAvatarId(r.avatars[0].id);
      })
      .catch(() => {});
  }, []);

  // ─── Audio Queue ────────────────────────────────────────────────
  function playNextInQueue() {
    if (audioQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false;
      setIsSpeaking(false);
      return;
    }
    isPlayingAudioRef.current = true;
    setIsSpeaking(true);
    const src = audioQueueRef.current.shift()!;
    const audio = new Audio(src);
    currentAudioRef.current = audio;
    audio.onended = playNextInQueue;
    audio.onerror = playNextInQueue;
    audio.play().catch(playNextInQueue);
  }

  async function speakText(text: string, voice?: string) {
    if (!text) return;
    setSpeakQueue((n) => n + 1);
    try {
      const res = await aiApi.tts(text.slice(0, 400), voice || ttsVoice);
      audioQueueRef.current.push(res.audio);
      setSpeakQueue((n) => Math.max(0, n - 1));
      if (!isPlayingAudioRef.current) playNextInQueue();
    } catch {
      setSpeakQueue((n) => Math.max(0, n - 1));
    }
  }

  function stopSpeaking() {
    audioQueueRef.current = [];
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    isPlayingAudioRef.current = false;
    setIsSpeaking(false);
    setSpeakQueue(0);
  }

  // ─── TikTok WebSocket ───────────────────────────────────────────
  function connectTikTokWS(sessionId: number) {
    const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws");
    const ws = new WebSocket(`${base}/tiktok/ws/${sessionId}`);
    wsRef.current = ws;
    setTiktokStatus("connecting");

    ws.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data);
        if (event === "connected") {
          setTiktokStatus("connected");
          addToast(`เชื่อมต่อ TikTok @${tiktokUsername} สำเร็จ! 🎵`, "success");
          if (data.stream_url) {
            setTiktokStreamUrl(data.stream_url);
            setTiktokStreamQuality(data.stream_quality || "origin");
            setTiktokStreamIsDemo(!!data.demo);
          }
        }
        if (event === "chat") {
          setComments((prev) => [
            ...prev.slice(-200),
            {
              id: data.id || (Date.now() + Math.random()),
              user_name: data.user || "ผู้ชม",
              message: data.text || "",
              ai_reply: null,
              auto_replying: data.auto_replying || false,
              created_at: data.timestamp || new Date().toISOString(),
              from_tiktok: true,
            },
          ]);
          setStats((s) => ({ ...s, comments: s.comments + 1 }));
          if (data.auto_replying) setAutoReplyPending((n) => n + 1);
        }
        if (event === "ai_reply") {
          setComments((prev) =>
            prev.map((c) =>
              c.id === data.comment_id
                ? { ...c, ai_reply: data.reply, auto_replying: false, auto_replied: true }
                : c,
            ),
          );
          setAutoReplyPending((n) => Math.max(0, n - 1));
          setTotalAutoReplied((n) => n + 1);
          // 🤖 HeyGen avatar พูด (ถ้าเปิดอยู่)
          if (heygenEnabledRef.current && data.reply && heygenRef.current) {
            heygenRef.current.speak(data.reply);
          }
          // 🔊 TTS พูดออกเสียง (ถ้าเปิดอยู่และ HeyGen ปิด)
          if (speakRepliesRef.current && !heygenEnabledRef.current && data.reply) {
            speakText(data.reply, ttsVoiceRef.current);
          }
        }
        if (event === "viewers") setStats((s) => ({ ...s, viewers: data.count || 0 }));
        if (event === "gift") {
          setGifts((prev) => [{ user: data.user, gift: data.gift, count: data.count }, ...prev.slice(0, 9)]);
          addToast(`🎁 ${data.user} ส่ง ${data.gift} ×${data.count}!`, "info");
        }
        if (event === "like") addToast(`❤️ ${data.user} กด Like!`, "info");
        if (event === "follow") addToast(`➕ ${data.user} ติดตามแล้ว!`, "success");
        if (event === "streamEnd") { setTiktokStatus("idle"); addToast("TikTok Live จบแล้ว", "info"); }
        if (event === "error") { setTiktokStatus("error"); addToast(`TikTok: ${data.message}`, "error"); }
        if (event === "disconnected") setTiktokStatus("idle");
      } catch {}
    };
    ws.onclose = () => { wsRef.current = null; setTiktokStatus("idle"); };
    ws.onerror = () => setTiktokStatus("error");
  }

  // ─── Start Live ─────────────────────────────────────────────────
  async function handleStartLive() {
    if (!selectedCampaign) return;
    if (selectedPlatform === "tiktok" && !tiktokUsername.trim()) {
      addToast("กรุณาใส่ TikTok Username ก่อน", "error");
      return;
    }
    setStarting(true);
    setComments([]);
    setGifts([]);
    setStats({ viewers: 0, comments: 0, leads: 0, duration: 0 });

    try {
      if (selectedPlatform === "tiktok" && tiktokMode === "monitor") {
        // Monitor-only mode: เชื่อมต่อ TikTok WebSocket โดยตรง ไม่ต้อง RTMP
        const res = await tiktokApi.connect(selectedCampaign.id, tiktokUsername);
        setSession({ id: res.session_id, status: "live", mode: "monitor" });
        setIsLive(true);
        addToast(`🔴 เชื่อมต่อ TikTok @${tiktokUsername} แล้ว!`, "success");
        connectTikTokWS(res.session_id);
      } else if (["facebook", "youtube"].includes(selectedPlatform) && platformConnections[selectedPlatform]) {
        // ── Auto-create Live บน Facebook / YouTube ──────────────
        const conn = platformConnections[selectedPlatform];
        addToast(`⏳ กำลังสร้าง Live บน ${selectedPlatform}...`, "info");

        const live = await platformApi.startLive({
          platform: selectedPlatform,
          campaign_id: selectedCampaign.id,
          title: selectedCampaign.name || "AI Live",
          description: selectedCampaign.product_name || "",
        });

        // ชื่อ page/channel
        const channelName = live.page_name || live.channel_title || selectedPlatform;
        addToast(`🔴 ${channelName} Live เริ่มแล้ว!`, "success");
        if (live.watch_url || live.dashboard_url) {
          addToast(`🔗 ${live.watch_url || live.dashboard_url}`, "info");
        }

        setActiveLiveId(live.live_id);

        // start FFmpeg RTMP stream
        const res = await streamApi.startStream(selectedCampaign.id, selectedPlatform);
        setSession({ ...res, rtmp_url: live.rtmp_url, stream_key: live.stream_key });
        setIsLive(true);

      } else {
        // ── Manual RTMP (ยังไม่ได้เชื่อมต่อ platform) ──────────
        const res = await streamApi.startStream(
          selectedCampaign.id,
          selectedPlatform,
          selectedPlatform === "tiktok" ? tiktokUsername : undefined,
        );
        setSession(res);
        setIsLive(true);
        addToast(`🔴 เริ่ม Live บน ${selectedPlatform} สำเร็จ!`, "success");
        if (selectedPlatform === "tiktok" && res.id) connectTikTokWS(res.id);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || String(err?.message || "");
      if (msg) addToast(msg, "error");
      else {
        // Demo fallback
        const demoId = Date.now();
        setSession({ id: demoId, status: "live" });
        setIsLive(true);
        addToast("🟡 Demo mode — ต้องการ TIKTOOL_API_KEY สำหรับ production", "info");
        if (selectedPlatform === "tiktok" && tiktokUsername) connectTikTokWS(demoId);
      }
    } finally {
      setStarting(false);
    }
  }

  // ─── Auto-reply toggle ──────────────────────────────────────────
  async function handleToggleAutoReply() {
    if (!session) return;
    const newVal = !autoReply;
    setAutoReply(newVal);
    try {
      await tiktokApi.setAutoReply(session.id, newVal);
      addToast(newVal ? "🤖 AI Auto-reply เปิดแล้ว!" : "⏸️ Auto-reply ปิดแล้ว", newVal ? "success" : "info");
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "ไม่สามารถตั้งค่า auto-reply ได้";
      addToast(msg, "error");
      setAutoReply(!newVal); // revert
    }
  }

  // ─── Stop Live ──────────────────────────────────────────────────
  async function handleStopLive() {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setTiktokStatus("idle");

    // จบ Facebook/YouTube Live อัตโนมัติ
    if (activeLiveId && ["facebook", "youtube"].includes(selectedPlatform)) {
      try { await platformApi.endLive(selectedPlatform, activeLiveId); } catch {}
      setActiveLiveId(null);
    }

    if (session) {
      try {
        if (session.mode === "monitor") await tiktokApi.disconnect(session.id);
        else await streamApi.stopStream(session.id);
      } catch {}
    }
    setIsLive(false);
    setSession(null);
    setAutoReply(false);
    setAutoReplyPending(0);
    setTotalAutoReplied(0);
    setSpeakReplies(false);
    setTiktokStreamUrl(null);
    stopSpeaking();
    addToast("⏹️ หยุด Live แล้ว", "info");
  }

  async function handleAIReply(comment: any) {
    setReplyingTo(comment.id);
    try {
      const res = await aiApi.replyComment(comment.message, selectedCampaign?.product_name, "th");
      setComments((c) => c.map((x) => x.id === comment.id ? { ...x, ai_reply: res.reply } : x));
    } catch {
      setComments((c) => c.map((x) => x.id === comment.id ? { ...x, ai_reply: "ขอบคุณที่ถามนะคะ! ติดต่อเราได้เลยค่ะ 💌" } : x));
    } finally { setReplyingTo(null); }
  }

  function handleAddComment() {
    if (!newComment.trim()) return;
    setComments((prev) => [...prev, { id: Date.now(), user_name: "ผู้ชม (ทดสอบ)", message: newComment, ai_reply: null, created_at: new Date().toISOString() }]);
    setStats((s) => ({ ...s, comments: s.comments + 1 }));
    setNewComment("");
  }

  async function handleCaptureLead(comment: any) {
    const lead = { campaign_id: selectedCampaign?.id || 1, name: comment.user_name, contact: "", source: "comment", notes: comment.message };
    try { await leadsApi.create(lead); } catch {}
    setLeads((l) => [...l, { ...lead, id: Date.now() }]);
    setStats((s) => ({ ...s, leads: s.leads + 1 }));
    addToast(`✅ เพิ่ม Lead: ${comment.user_name}`, "success");
  }

  function formatDuration(s: number) {
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
  }

  const statusDot: Record<string, string> = { idle: "var(--text-muted)", connecting: "#f59e0b", connected: "#22c55e", error: "#ef4444" };
  const statusText: Record<string, string> = { idle: "ยังไม่ได้เชื่อมต่อ", connecting: "กำลังเชื่อมต่อ...", connected: "เชื่อมต่อแล้ว", error: "เชื่อมต่อไม่สำเร็จ" };

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {isLive && <div className="live-dot" />}
            <div>
              <h1 className="page-title">{isLive ? "🔴 กำลัง LIVE" : "ห้อง Live"}</h1>
              <p className="page-subtitle">
                {isLive
                  ? `${selectedPlatform === "tiktok" ? "🎵 TikTok" : selectedPlatform} · ${formatDuration(stats.duration)}`
                  : "ตั้งค่าและเริ่มถ่ายทอดสด AI"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Controls when TikTok connected */}
            {isLive && selectedPlatform === "tiktok" && tiktokStatus === "connected" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

                {/* Voice selector */}
                {speakReplies && (
                  <select value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: 8, fontSize: 12, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", cursor: "pointer" }}>
                    <option value="nova">Nova (หญิง)</option>
                    <option value="shimmer">Shimmer (หญิง นุ่ม)</option>
                    <option value="alloy">Alloy (กลาง)</option>
                    <option value="onyx">Onyx (ชาย)</option>
                    <option value="echo">Echo (ชาย ลึก)</option>
                  </select>
                )}

                {/* 🔊 Speak toggle */}
                <button onClick={() => { setSpeakReplies((v) => !v); if (speakReplies) stopSpeaking(); }}
                  title={speakReplies ? "ปิดการพูด" : "เปิดให้ AI พูดออกเสียง"}
                  style={{
                    padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    background: speakReplies ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "var(--bg-surface)",
                    border: `2px solid ${speakReplies ? "#0ea5e9" : "var(--border-subtle)"}`,
                    color: speakReplies ? "white" : "var(--text-secondary)",
                    display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
                    boxShadow: speakReplies ? "0 0 14px rgba(14,165,233,0.4)" : "none",
                  }}>
                  {isSpeaking ? "🔊" : speakReplies ? "🔊" : "🔇"}
                  {speakReplies ? (isSpeaking ? "กำลังพูด..." : speakQueue > 0 ? `รอ ${speakQueue}` : "พูดออกเสียง") : "พูดออกเสียง"}
                </button>

                {/* 🤖 Auto-reply toggle */}
                <button onClick={handleToggleAutoReply}
                  style={{
                    padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    background: autoReply ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "var(--bg-surface)",
                    border: `2px solid ${autoReply ? "#6366f1" : "var(--border-subtle)"}`,
                    color: autoReply ? "white" : "var(--text-secondary)",
                    display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
                    boxShadow: autoReply ? "0 0 14px rgba(99,102,241,0.4)" : "none",
                  }}>
                  🤖 {autoReply ? "Auto-pilot" : "Auto-pilot"}
                  {autoReply && autoReplyPending > 0 && (
                    <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: 100, padding: "1px 7px", fontSize: 11 }}>
                      {autoReplyPending}
                    </span>
                  )}
                </button>

              </div>
            )}
            {isLive
              ? <button onClick={handleStopLive} className="btn btn-danger" style={{ padding: "10px 24px" }}>⏹️ หยุด Live</button>
              : <button onClick={handleStartLive} className="btn btn-primary" style={{ padding: "10px 24px", fontSize: 15 }} disabled={starting || !selectedCampaign}>
                  {starting ? "⏳ กำลังเชื่อมต่อ..." : "🔴 เริ่ม Live"}
                </button>
            }
          </div>
        </div>
      </div>

      <div style={{ padding: "0 32px", display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Stats */}
          {isLive && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${autoReply ? 5 : 4},1fr)`, gap: 12 }}>
              {[
                { label: "ผู้ชม", value: stats.viewers.toLocaleString(), icon: "👀", color: "#3b82f6" },
                { label: "คอมเมนต์", value: comments.length.toString(), icon: "💬", color: "#f59e0b" },
                ...(autoReply ? [{ label: "AI ตอบแล้ว", value: totalAutoReplied.toString(), icon: "🤖", color: "#8b5cf6" }] : []),
                { label: "ลูกค้าเป้าหมาย", value: stats.leads.toString(), icon: "🎯", color: "#22c55e" },
                { label: "เวลา", value: formatDuration(stats.duration), icon: "⏱️", color: "#6b7280" },
              ].map((s) => (
                <div key={s.label} className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* TikTok status bar */}
          {isLive && selectedPlatform === "tiktok" && (
            <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: statusDot[tiktokStatus], flexShrink: 0,
                boxShadow: tiktokStatus === "connected" ? "0 0 6px #22c55e" : "none" }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>🎵 @{tiktokUsername}</span>
                <span style={{ fontSize: 12, color: statusDot[tiktokStatus], marginLeft: 8 }}>{statusText[tiktokStatus]}</span>
              </div>
              {gifts.slice(0, 3).map((g, i) => (
                <span key={i} style={{ fontSize: 12, padding: "3px 8px", background: "rgba(99,102,241,0.1)", borderRadius: 100, border: "1px solid rgba(99,102,241,0.2)" }}>
                  🎁 {g.gift} ×{g.count}
                </span>
              ))}
            </div>
          )}

          {/* Setup form */}
          {!isLive && (
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 16 }}>📋 ตั้งค่า Live</h3>

              {/* Campaign + Platform */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div>
                  <label className="input-label">เลือกแคมเปญ</label>
                  <select className="input" value={selectedCampaign?.id || ""}
                    onChange={(e) => setSelectedCampaign(campaigns.find((c) => c.id === Number(e.target.value)))}>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">แพลตฟอร์ม</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {PLATFORMS.map((p) => {
                      const isConnected = p.key !== "tiktok" && !!platformConnections[p.key];
                      return (
                        <button key={p.key} onClick={() => setSelectedPlatform(p.key)} title={p.label}
                          style={{ flex: 1, padding: "10px 4px", borderRadius: 10, fontSize: 20, cursor: "pointer",
                            background: selectedPlatform === p.key ? `${p.color}22` : "var(--bg-surface)",
                            border: `2px solid ${selectedPlatform === p.key ? p.color : "var(--border-subtle)"}`,
                            transition: "all 0.15s", position: "relative" }}>
                          {p.icon}
                          {isConnected && (
                            <span style={{
                              position: "absolute", top: 4, right: 4,
                              width: 8, height: 8, borderRadius: "50%",
                              background: "#22c55e", border: "1px solid var(--bg-surface)",
                            }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* TikTok section */}
              {selectedPlatform === "tiktok" && (
                <div style={{ background: "rgba(0,242,234,0.05)", border: "1px solid rgba(0,242,234,0.2)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "#00c9c1" }}>🎵 TikTok Live</div>

                  {/* Mode selector */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    {([
                      { key: "monitor", icon: "📱", title: "Live ผ่านมือถือ", desc: "เปิด Live บน TikTok app แล้วให้ AI ช่วยดูคอมเมนต์" },
                      { key: "rtmp", icon: "💻", title: "Stream จาก PC", desc: "ต้องการ 1,000+ followers และ TikTok LIVE Studio" },
                    ] as const).map((m) => (
                      <div key={m.key} onClick={() => setTiktokMode(m.key)}
                        style={{ padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                          background: tiktokMode === m.key ? "rgba(0,242,234,0.12)" : "var(--bg-surface)",
                          border: `2px solid ${tiktokMode === m.key ? "#00c9c1" : "var(--border-subtle)"}`,
                          transition: "all 0.15s" }}>
                        <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{m.title}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>

                  {/* Username (both modes) */}
                  <div className="form-group">
                    <label className="input-label">TikTok Username</label>
                    <div style={{ display: "flex" }}>
                      <span style={{ padding: "9px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                        borderRight: "none", borderRadius: "8px 0 0 8px", fontSize: 14, color: "var(--text-muted)" }}>@</span>
                      <input className="input" placeholder="your_username"
                        value={tiktokUsername} onChange={(e) => setTiktokUsername(e.target.value.replace("@", ""))}
                        style={{ borderRadius: "0 8px 8px 0" }} />
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      {tiktokMode === "monitor"
                        ? "Username ของบัญชีที่กำลัง Live อยู่บน TikTok app"
                        : "Username ของบัญชีที่จะ Stream ผ่าน PC"}
                    </p>
                  </div>

                  {/* RTMP fields (rtmp mode only) */}
                  {tiktokMode === "rtmp" && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="input-label">RTMP Server URL</label>
                          <input className="input" value={rtmpUrl} onChange={(e) => setRtmpUrl(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="input-label">Stream Key</label>
                          <input className="input" type="password" placeholder="จาก TikTok LIVE Studio"
                            value={rtmpKey} onChange={(e) => setRtmpKey(e.target.value)} />
                        </div>
                      </div>
                      <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                        <strong>วิธีได้ Stream Key:</strong><br />
                        1. ดาวน์โหลด <strong>TikTok LIVE Studio</strong> (PC)<br />
                        2. Login → Settings → Stream Setup<br />
                        3. Copy Stream Key<br />
                        <span style={{ color: "#f59e0b" }}>⚠️ ต้องมี 1,000+ followers และบัญชีไม่ถูก restrict</span>
                      </div>
                    </>
                  )}

                  {/* Monitor mode hint */}
                  {tiktokMode === "monitor" && (
                    <div style={{ marginTop: 4, padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                      <strong>วิธีใช้:</strong><br />
                      1. เปิด TikTok app บนมือถือ → กด Live ตามปกติ<br />
                      2. ใส่ username ด้านบน → กด <strong>เริ่ม Live</strong><br />
                      3. AI จะดึงคอมเมนต์ real-time และช่วยตอบอัตโนมัติ<br />
                      <span style={{ color: "#22c55e" }}>✅ ไม่ต้องการ Stream Key หรือ followers ขั้นต่ำ</span>
                    </div>
                  )}
                </div>
              )}

              {/* Non-TikTok: Auto-Live หรือ Manual RTMP */}
              {selectedPlatform !== "tiktok" && (
                platformConnections[selectedPlatform] ? (
                  // ── เชื่อมต่อแล้ว: Auto-create Live ──────────────
                  <div style={{
                    padding: "14px 16px", borderRadius: 12,
                    background: selectedPlatform === "facebook" ? "rgba(24,119,242,0.08)" : "rgba(255,0,0,0.06)",
                    border: `1px solid ${selectedPlatform === "facebook" ? "rgba(24,119,242,0.25)" : "rgba(255,0,0,0.2)"}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 20 }}>{selectedPlatform === "facebook" ? "📘" : "📺"}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {platformConnections[selectedPlatform].page_name || platformConnections[selectedPlatform].channel_title}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>เชื่อมต่อแล้ว — กด เริ่ม Live ได้เลย ไม่ต้องใส่ Stream Key</div>
                      </div>
                      <span style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>✅ พร้อม</span>
                    </div>
                  </div>
                ) : (
                  // ── ยังไม่ได้เชื่อมต่อ: Manual RTMP + คำแนะนำ ──
                  <div>
                    <div style={{
                      padding: "12px 14px", borderRadius: 10, marginBottom: 12,
                      background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                      fontSize: 13, color: "var(--text-secondary)",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    }}>
                      <span>⚡ เชื่อมต่อ {selectedPlatform === "facebook" ? "Facebook" : "YouTube"} เพื่อ Live อัตโนมัติ ไม่ต้องใส่ Stream Key</span>
                      <a href="/dashboard/settings" style={{ fontSize: 12, color: "var(--brand-primary-light)", whiteSpace: "nowrap" }}>ตั้งค่า →</a>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="input-label">RTMP Server URL</label>
                        <input className="input" value={rtmpUrl} onChange={(e) => setRtmpUrl(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="input-label">Stream Key</label>
                        <input className="input" type="password" placeholder="Stream Key จาก Creator Studio"
                          value={rtmpKey} onChange={(e) => setRtmpKey(e.target.value)} />
                      </div>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", gridColumn: "1/-1" }}>
                        💡 Creator Studio → Live → Copy Stream Key
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* ── TikTok Live Video Player ─────────────────────────── */}
          {isLive && selectedPlatform === "tiktok" && tiktokStreamUrl && tiktokStatus === "connected" && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 15 }}>🎥 TikTok Live Preview</h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    สตรีมสด @{tiktokUsername}
                    {tiktokStreamIsDemo && <span style={{ color: "#f59e0b", marginLeft: 6 }}>· Demo mode</span>}
                  </p>
                </div>
                {tiktokStreamQuality && tiktokStreamQuality !== "origin" && (
                  <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700,
                    background: "rgba(0,242,234,0.1)", border: "1px solid rgba(0,242,234,0.25)", color: "#00c9c1" }}>
                    {tiktokStreamQuality}
                  </span>
                )}
              </div>
              <TikTokVideoPlayer
                streamUrl={tiktokStreamUrl}
                username={tiktokUsername}
                quality={tiktokStreamQuality}
                isDemo={tiktokStreamIsDemo}
              />
            </div>
          )}

          {/* ── HeyGen Avatar Panel ──────────────────────────────── */}
          {isLive && (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 15 }}>🤖 AI Avatar</h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {heygenEnabled ? "Avatar พูดตอบ comment อัตโนมัติ" : "เปิดให้ Avatar พูดตอบ comment"}
                  </p>
                </div>
                <button
                  onClick={() => setHeygenEnabled((v) => !v)}
                  style={{
                    padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    background: heygenEnabled ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "var(--bg-surface)",
                    border: `2px solid ${heygenEnabled ? "#6366f1" : "var(--border-subtle)"}`,
                    color: heygenEnabled ? "white" : "var(--text-secondary)",
                    transition: "all 0.2s",
                  }}>
                  {heygenEnabled ? "🟢 เปิดอยู่" : "⚫ ปิดอยู่"}
                </button>
              </div>

              {/* Avatar selector */}
              {heygenAvatars.length > 0 && !heygenEnabled && (
                <div style={{ marginBottom: 12 }}>
                  <label className="input-label">เลือก Avatar</label>
                  <select className="input" value={heygenAvatarId}
                    onChange={(e) => setHeygenAvatarId(e.target.value)}>
                    {heygenAvatars.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Avatar player */}
              {heygenEnabled && heygenAvatarId && (
                <HeyGenAvatar
                  ref={heygenRef}
                  avatarId={heygenAvatarId}
                  onReady={() => addToast("🤖 Avatar พร้อมแล้ว!", "success")}
                  onError={(msg) => addToast(`HeyGen: ${msg}`, "error")}
                />
              )}

              {heygenEnabled && !heygenAvatarId && (
                <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  ⚠️ กรุณาตั้งค่า HEYGEN_API_KEY และ HEYGEN_AVATAR_ID ใน .env ก่อน
                </div>
              )}

              {heygenEnabled && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(99,102,241,0.08)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                  💡 แชร์หน้าจอนี้ไปยัง TikTok Live เพื่อให้ผู้ชมเห็น Avatar พูดตอบ comment
                </div>
              )}
            </div>
          )}

          {/* Script when live */}
          {isLive && selectedCampaign?.script && (
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 12 }}>📜 Script</h3>
              <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: 16, fontSize: 14, lineHeight: 1.9, maxHeight: 200, overflow: "auto", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                {selectedCampaign.script}
              </div>
            </div>
          )}

          {/* Leads */}
          {leads.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
                <h3 style={{ fontWeight: 700, fontSize: 15 }}>🎯 Leads ({leads.length})</h3>
              </div>
              {leads.map((l, i) => (
                <div key={i} style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: i < leads.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{l.notes?.slice(0, 50)}</div>
                  </div>
                  <span className="badge badge-ended" style={{ marginLeft: "auto" }}>Lead</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — Comments */}
        <div>
          <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontWeight: 700, fontSize: 15 }}>💬 คอมเมนต์</h3>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {isSpeaking && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.4)", color: "#0ea5e9", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    🔊 พูดอยู่
                  </span>
                )}
                {tiktokStatus === "connected" && (
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 100, background: "rgba(0,242,234,0.15)", border: "1px solid rgba(0,242,234,0.3)", color: "#00c9c1", fontWeight: 700 }}>● LIVE</span>
                )}
                <span className="badge badge-draft" style={{ fontSize: 11 }}>{comments.length}</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
              {comments.map((c: any) => (
                <div key={c.id} className="comment-bubble"
                  style={c.from_tiktok ? { borderLeft: "2px solid rgba(0,242,234,0.5)", paddingLeft: 10 } : {}}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%",
                      background: c.from_tiktok ? "linear-gradient(135deg,#00f2ea,#ff0050)" : "var(--gradient-brand)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>
                      {(c.user_name || "?")[0].toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{c.user_name}</span>
                    {c.from_tiktok && <span style={{ fontSize: 9, color: "#00c9c1", fontWeight: 700 }}>TikTok</span>}
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                      {new Date(c.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, marginBottom: 8 }}>{c.message}</p>
                  {/* AI กำลังตอบ... */}
                  {c.auto_replying && !c.ai_reply && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(99,102,241,0.08)", borderRadius: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--brand-primary-light)" }}>🤖 AI กำลังตอบ</span>
                      <span style={{ display: "flex", gap: 3 }}>
                        {[0,1,2].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--brand-primary-light)", opacity: 0.6, animation: `pulse 1.2s ${i * 0.2}s infinite` }} />)}
                      </span>
                    </div>
                  )}
                  {c.ai_reply && (
                    <div className="ai-reply" style={c.auto_replied ? { borderLeft: "2px solid rgba(99,102,241,0.5)" } : {}}>
                      <span style={{ fontSize: 11, fontWeight: 600, marginRight: 4 }}>
                        {c.auto_replied ? "🤖 AI (auto):" : "🤖 AI:"}
                      </span>
                      {c.ai_reply}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {!c.ai_reply && !c.auto_replying && (
                      <button onClick={() => handleAIReply(c)} disabled={replyingTo === c.id}
                        style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "var(--brand-primary-light)", cursor: "pointer" }}>
                        {replyingTo === c.id ? "⏳..." : "🤖 AI ตอบ"}
                      </button>
                    )}
                    {c.ai_reply && (
                      <button onClick={() => speakText(c.ai_reply)}
                        style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, border: "1px solid rgba(14,165,233,0.3)", background: "rgba(14,165,233,0.08)", color: "#0ea5e9", cursor: "pointer" }}>
                        🔊 พูด reply
                      </button>
                    )}
                    {!c.ai_reply && (
                      <button onClick={() => speakText(c.message)}
                        style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, border: "1px solid rgba(100,116,139,0.3)", background: "rgba(100,116,139,0.08)", color: "var(--text-muted)", cursor: "pointer" }}>
                        🔊 อ่าน
                      </button>
                    )}
                    <button onClick={() => handleCaptureLead(c)}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", color: "#22c55e", cursor: "pointer" }}>
                      📌 Lead
                    </button>
                  </div>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>

            <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
              <input className="input" placeholder="จำลองคอมเมนต์..." value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                style={{ flex: 1, fontSize: 13 }} />
              <button onClick={handleAddComment} className="btn btn-primary btn-sm">ส่ง</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
