"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { streamApi, campaignApi, aiApi, leadsApi } from "@/lib/api";
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
  const [selectedPlatform, setSelectedPlatform] = useState("facebook");
  const [session, setSession] = useState<any>(null);
  const [isLive, setIsLive] = useState(false);
  const [comments, setComments] = useState(DEMO_COMMENTS);
  const [leads, setLeads] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [stats, setStats] = useState({ viewers: 0, comments: 0, leads: 0, duration: 0 });
  const [starting, setStarting] = useState(false);
  const [rtmpKey, setRtmpKey] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    campaignApi.list()
      .then((data) => {
        setCampaigns(data);
        const pre = data.find((c: any) => c.id === Number(campaignId));
        if (pre) setSelectedCampaign(pre);
        else if (data.length > 0) setSelectedCampaign(data[0]);
      })
      .catch(() => {
        const demo = [
          { id: 1, name: "เช่ารถภูเก็ต", product_name: "บริการเช่ารถ", status: "live" },
          { id: 2, name: "Glow Kit เซตสกิน", product_name: "Glow Kit", status: "draft" },
        ];
        setCampaigns(demo);
        setSelectedCampaign(demo[0]);
      });
  }, [campaignId]);

  // Simulate live stats
  useEffect(() => {
    if (isLive) {
      timerRef.current = setInterval(() => {
        setStats((s) => ({
          ...s,
          viewers: s.viewers + Math.floor(Math.random() * 5),
          duration: s.duration + 1,
        }));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isLive]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function handleStartLive() {
    if (!selectedCampaign) return;
    setStarting(true);
    try {
      const res = await streamApi.startStream(selectedCampaign.id, selectedPlatform);
      setSession(res);
      setIsLive(true);
      setStats({ viewers: 0, comments: 0, leads: 0, duration: 0 });
      addToast(`🔴 เริ่ม Live บน ${selectedPlatform} สำเร็จ!`, "success");
    } catch {
      // Demo mode
      setIsLive(true);
      setSession({ id: 999, status: "live" });
      addToast("🟡 Demo mode — Stream engine ต้องการ FFmpeg + VPS", "info");
    } finally {
      setStarting(false);
    }
  }

  async function handleStopLive() {
    if (session) {
      try { await streamApi.stopStream(session.id); } catch { }
    }
    setIsLive(false);
    setSession(null);
    if (timerRef.current) clearInterval(timerRef.current);
    addToast("⏹️ หยุด Live แล้ว", "info");
  }

  async function handleAIReply(comment: any) {
    setReplyingTo(comment.id);
    try {
      const res = await aiApi.replyComment(comment.message, selectedCampaign?.product_name, "th");
      setComments((c) => c.map((x) => x.id === comment.id ? { ...x, ai_reply: res.reply } : x));
    } catch {
      setComments((c) => c.map((x) => x.id === comment.id ? { ...x, ai_reply: "ขอบคุณที่ถามนะคะ! ติดต่อเราได้เลยค่ะ 💌" } : x));
    } finally {
      setReplyingTo(null);
    }
  }

  function handleAddComment() {
    if (!newComment.trim()) return;
    const c = { id: Date.now(), user_name: "ผู้ชม", message: newComment, ai_reply: null, created_at: new Date().toISOString() };
    setComments((prev) => [...prev, c]);
    setStats((s) => ({ ...s, comments: s.comments + 1 }));
    setNewComment("");
  }

  async function handleCaptureLead(comment: any) {
    const lead = { campaign_id: selectedCampaign?.id || 1, name: comment.user_name, contact: "", source: "comment", notes: comment.message };
    try {
      await leadsApi.create(lead);
    } catch { }
    setLeads((l) => [...l, { ...lead, id: Date.now() }]);
    setStats((s) => ({ ...s, leads: s.leads + 1 }));
    addToast(`✅ เพิ่ม Lead: ${comment.user_name}`, "success");
  }

  function formatDuration(s: number) {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  }

  return (
    <div style={{ padding: "0 0 40px" }}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {isLive && <div className="live-dot" />}
            <div>
              <h1 className="page-title">{isLive ? "🔴 กำลัง LIVE" : "ห้อง Live"}</h1>
              <p className="page-subtitle">{isLive ? `กำลังถ่ายทอดสดบน ${selectedPlatform} · ${formatDuration(stats.duration)}` : "ตั้งค่าและเริ่มถ่ายทอดสด AI"}</p>
            </div>
          </div>
          {isLive ? (
            <button id="stop-live-btn" onClick={handleStopLive} className="btn btn-danger" style={{ padding: "10px 24px" }}>⏹️ หยุด Live</button>
          ) : (
            <button id="start-live-btn" onClick={handleStartLive} className="btn btn-primary" style={{ padding: "10px 24px", fontSize: 15 }} disabled={starting || !selectedCampaign}>
              {starting ? "⏳ กำลังเชื่อมต่อ..." : "🔴 เริ่ม Live"}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "0 32px", display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Live Stats */}
          {isLive && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {[
                { label: "ผู้ชม", value: stats.viewers.toLocaleString(), icon: "👀", color: "#3b82f6" },
                { label: "คอมเมนต์", value: (comments.length + stats.comments).toString(), icon: "💬", color: "#f59e0b" },
                { label: "Leads", value: stats.leads.toString(), icon: "🎯", color: "#22c55e" },
                { label: "เวลา", value: formatDuration(stats.duration), icon: "⏱️", color: "#8b5cf6" },
              ].map((s) => (
                <div key={s.label} className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Campaign & Platform selector */}
          {!isLive && (
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 16 }}>📋 ตั้งค่า Live</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="input-label">เลือกแคมเปญ</label>
                  <select id="campaign-select" className="input" value={selectedCampaign?.id || ""} onChange={(e) => setSelectedCampaign(campaigns.find((c) => c.id === Number(e.target.value)))}>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">แพลตฟอร์ม</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {PLATFORMS.map((p) => (
                      <button key={p.key} id={`platform-${p.key}`} onClick={() => setSelectedPlatform(p.key)}
                        style={{
                          flex: 1, padding: "10px 4px", borderRadius: 10, fontSize: 20, cursor: "pointer",
                          background: selectedPlatform === p.key ? `${p.color}22` : "var(--bg-surface)",
                          border: `2px solid ${selectedPlatform === p.key ? p.color : "var(--border-subtle)"}`,
                          transition: "all 0.15s"
                        }} title={p.label}
                      >{p.icon}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <label className="input-label">Stream Key (RTMP)</label>
                <input id="rtmp-key" type="password" className="input" placeholder="ใส่ Stream Key จาก Facebook / YouTube / TikTok" value={rtmpKey} onChange={(e) => setRtmpKey(e.target.value)} />
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                  💡 ไปที่ Creator Studio → Live → Copy Stream Key
                </p>
              </div>
            </div>
          )}

          {/* Script display when live */}
          {isLive && selectedCampaign && (
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 12 }}>📜 Script ที่กำลังใช้</h3>
              <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: 16, fontSize: 14, lineHeight: 1.9, maxHeight: 200, overflow: "auto", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                {selectedCampaign.script || "Script จะแสดงที่นี่ขณะ Live..."}
              </div>
            </div>
          )}

          {/* Leads captured */}
          {leads.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
                <h3 style={{ fontWeight: 700, fontSize: 15 }}>🎯 Leads ที่จับได้ ({leads.length})</h3>
              </div>
              <div style={{ padding: "8px 0" }}>
                {leads.map((l, i) => (
                  <div key={i} style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: i < leads.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{l.notes?.slice(0, 50)}</div>
                    </div>
                    <span className="badge badge-ended" style={{ marginLeft: "auto" }}>Lead</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — Comments */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 200px)" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontWeight: 700, fontSize: 15 }}>💬 คอมเมนต์ Live</h3>
              <span className="badge badge-draft" style={{ fontSize: 11 }}>{comments.length} ข้อความ</span>
            </div>

            {/* Comments list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
              {comments.map((c) => (
                <div key={c.id} className="comment-bubble">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--gradient-brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {c.user_name[0]}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{c.user_name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                      {new Date(c.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, marginBottom: 8 }}>{c.message}</p>

                  {c.ai_reply && (
                    <div className="ai-reply">
                      <span style={{ fontSize: 11, fontWeight: 600, marginRight: 4 }}>🤖 AI:</span>
                      {c.ai_reply}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {!c.ai_reply && (
                      <button onClick={() => handleAIReply(c)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "var(--brand-primary-light)", cursor: "pointer" }} disabled={replyingTo === c.id}>
                        {replyingTo === c.id ? "⏳..." : "🤖 AI ตอบ"}
                      </button>
                    )}
                    <button onClick={() => handleCaptureLead(c)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 100, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", color: "#22c55e", cursor: "pointer" }}>
                      📌 Lead
                    </button>
                  </div>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>

            {/* Add comment (simulate) */}
            <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
              <input id="comment-input" className="input" placeholder="จำลองคอมเมนต์..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddComment()} style={{ flex: 1, fontSize: 13 }} />
              <button id="send-comment-btn" onClick={handleAddComment} className="btn btn-primary btn-sm">ส่ง</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
