"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { campaignApi, aiApi } from "@/lib/api";
import { useUIStore } from "@/lib/store";

const TONES = [
  { key: "friendly", icon: "😊", label: "เป็นกันเอง" },
  { key: "luxury", icon: "💎", label: "หรูหรา" },
  { key: "energetic", icon: "⚡", label: "มีพลัง" },
  { key: "professional", icon: "👔", label: "มืออาชีพ" },
];

const VOICES = [
  { key: "nova", label: "Nova", desc: "หญิง — มีพลัง" },
  { key: "shimmer", label: "Shimmer", desc: "หญิง — นุ่มนวล" },
  { key: "alloy", label: "Alloy", desc: "กลาง — เป็นธรรมชาติ" },
  { key: "onyx", label: "Onyx", desc: "ชาย — มั่นคง" },
  { key: "echo", label: "Echo", desc: "ชาย — ลึก" },
];

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"info" | "avatar">("info");

  // Info form
  const [form, setForm] = useState<any>({});
  const [script, setScript] = useState("");
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingTTS, setGeneratingTTS] = useState(false);
  const [audioSrc, setAudioSrc] = useState("");

  // Avatar
  const [avatars, setAvatars] = useState<any[]>([]);
  const [heygenVoices, setHeygenVoices] = useState<any[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [selectedHeygenVoice, setSelectedHeygenVoice] = useState("");
  const [avatarSearch, setAvatarSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<string>("");
  const [avatarError, setAvatarError] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const numId = parseInt(id);

  useEffect(() => {
    campaignApi.get(numId)
      .then((c) => {
        setCampaign(c);
        setForm({
          name: c.name,
          product_name: c.product_name || "",
          product_price: c.product_price || "",
          product_highlights: c.product_highlights || "",
          promotion: c.promotion || "",
          language: c.language || "th",
          tone: c.tone || "friendly",
          tts_voice: c.tts_voice || "nova",
        });
        setScript(c.script || "");
        if (c.heygen_video_id && !c.avatar_url) {
          // check current status once on load
          campaignApi.avatarStatus(parseInt(id)).then((info) => {
            setAvatarStatus(info.status);
            if (info.status === "processing") startPolling();
            if (info.status === "failed") setAvatarError(info.error || "HeyGen สร้างวิดีโอไม่สำเร็จ");
            if (info.status === "completed") setCampaign((prev: any) => ({ ...prev, avatar_url: info.avatar_url }));
          }).catch(() => {
            setAvatarStatus("processing");
            startPolling();
          });
        } else if (c.avatar_url) {
          setAvatarStatus("completed");
        }
      })
      .catch(() => { addToast("ไม่พบแคมเปญ", "error"); router.push("/dashboard/campaigns"); })
      .finally(() => setLoading(false));

    campaignApi.heygenAvatars()
      .then((d) => setAvatars(d.avatars || []))
      .catch(() => {});

    campaignApi.heygenVoices()
      .then((d) => {
        const thai = (d.voices || []).filter((v: any) =>
          v.language?.toLowerCase().includes("thai") || v.locale?.toLowerCase().includes("th")
        );
        setHeygenVoices(thai.length > 0 ? thai : (d.voices || []).slice(0, 20));
      })
      .catch(() => {});

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [numId]);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const info = await campaignApi.avatarStatus(numId);
        setAvatarStatus(info.status);
        if (info.status === "completed") {
          clearInterval(pollRef.current!);
          setCampaign((c: any) => ({ ...c, avatar_url: info.avatar_url }));
          addToast("สร้าง Avatar Video สำเร็จ! 🎉", "success");
        } else if (info.status === "failed") {
          clearInterval(pollRef.current!);
          setAvatarError(info.error || "HeyGen สร้างวิดีโอไม่สำเร็จ");
          addToast(info.error || "HeyGen สร้างวิดีโอไม่สำเร็จ", "error");
        }
      } catch {}
    }, 15000);
  }

  async function handleSave() {
    if (!form.name) { addToast("กรุณาใส่ชื่อแคมเปญ", "error"); return; }
    setSaving(true);
    try {
      const updated = await campaignApi.update(numId, { ...form, script });
      setCampaign(updated);
      addToast("บันทึกสำเร็จ ✅", "success");
    } catch {
      addToast("บันทึกไม่สำเร็จ", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateScript() {
    setGeneratingScript(true);
    try {
      const res = await aiApi.generateScript({
        product_name: form.product_name,
        product_price: form.product_price,
        product_highlights: form.product_highlights,
        promotion: form.promotion,
        language: form.language,
        tone: form.tone,
      });
      setScript(res.script);
      addToast("สร้าง Script ใหม่สำเร็จ 🎉", "success");
    } catch {
      addToast("สร้าง Script ไม่สำเร็จ", "error");
    } finally {
      setGeneratingScript(false);
    }
  }

  async function handleTTSPreview() {
    if (!script) return;
    setGeneratingTTS(true);
    try {
      const res = await aiApi.tts(script.slice(0, 500), form.tts_voice || "nova");
      setAudioSrc(res.audio);
    } catch {
      addToast("TTS ไม่พร้อมใช้งาน", "error");
    } finally {
      setGeneratingTTS(false);
    }
  }

  async function handleUploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await campaignApi.uploadAvatar(numId, file);
      setCampaign((c: any) => ({ ...c, avatar_url: res.avatar_url }));
      setAvatarStatus("completed");
      addToast("อัปโหลด Avatar Video สำเร็จ ✅", "success");
    } catch {
      addToast("อัปโหลดไม่สำเร็จ", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerateAvatar() {
    if (!selectedAvatar) { addToast("กรุณาเลือก Avatar ก่อน", "error"); return; }
    if (!selectedHeygenVoice) { addToast("กรุณาเลือก Voice ก่อน", "error"); return; }
    if (!script) { addToast("กรุณาใส่ Script ก่อนสร้าง Avatar", "error"); return; }
    setGenerating(true);
    try {
      await campaignApi.generateAvatar(numId, selectedAvatar, selectedHeygenVoice);
      setAvatarStatus("processing");
      addToast("ส่งคำขอไปยัง HeyGen แล้ว ใช้เวลาประมาณ 2-5 นาที ⏳", "info");
      startPolling();
    } catch (e: any) {
      addToast(e.response?.data?.detail || "สร้าง Avatar ไม่สำเร็จ", "error");
    } finally {
      setGenerating(false);
    }
  }

  const filteredAvatars = avatars.filter((a) =>
    !avatarSearch || a.avatar_name?.toLowerCase().includes(avatarSearch.toLowerCase())
  );

  if (loading) return (
    <div style={{ padding: "40px 32px" }}>
      <div className="skeleton" style={{ height: 40, width: 300, marginBottom: 16 }} />
      <div className="skeleton card" style={{ height: 400 }} />
    </div>
  );

  return (
    <div style={{ padding: "0 0 60px" }}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Link href="/dashboard/campaigns" style={{ color: "var(--text-muted)", fontSize: 14 }}>← แคมเปญ</Link>
            </div>
            <h1 className="page-title">{campaign?.name}</h1>
            <p className="page-subtitle">{campaign?.product_name} {campaign?.product_price && `· ${campaign.product_price}`}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/dashboard/live?campaign=${numId}`} className="btn btn-primary">🔴 Go Live</Link>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 20 }}>
          {[
            { key: "info", label: "📝 Script & Info" },
            { key: "avatar", label: "🎭 Avatar Video" },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              style={{
                padding: "8px 18px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: tab === t.key ? "var(--brand-primary)" : "transparent",
                color: tab === t.key ? "white" : "var(--text-secondary)",
                border: `1px solid ${tab === t.key ? "transparent" : "var(--border-subtle)"}`,
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 32px" }}>

        {/* ── TAB: INFO ── */}
        {tab === "info" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Left: form */}
            <div className="card">
              <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>📦 ข้อมูลสินค้า</h2>

              <div className="form-group">
                <label className="input-label">ชื่อแคมเปญ</label>
                <input className="input" value={form.name || ""} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="input-label">ชื่อสินค้า</label>
                  <input className="input" value={form.product_name || ""} onChange={(e) => setForm((f: any) => ({ ...f, product_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="input-label">ราคา</label>
                  <input className="input" value={form.product_price || ""} onChange={(e) => setForm((f: any) => ({ ...f, product_price: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="input-label">จุดขายหลัก</label>
                <textarea className="input" value={form.product_highlights || ""} onChange={(e) => setForm((f: any) => ({ ...f, product_highlights: e.target.value }))} style={{ minHeight: 72 }} />
              </div>
              <div className="form-group">
                <label className="input-label">โปรโมชัน</label>
                <input className="input" value={form.promotion || ""} onChange={(e) => setForm((f: any) => ({ ...f, promotion: e.target.value }))} />
              </div>

              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="input-label" style={{ marginBottom: 8 }}>น้ำเสียง</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {TONES.map((t) => (
                    <div key={t.key} className={`tone-option ${form.tone === t.key ? "selected" : ""}`}
                      onClick={() => setForm((f: any) => ({ ...f, tone: t.key }))}
                      style={{ padding: "10px 6px" }}>
                      <span style={{ fontSize: 18 }}>{t.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={handleSave} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} disabled={saving}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>

            {/* Right: script + TTS */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontWeight: 700, fontSize: 16 }}>📝 Script</h2>
                <button onClick={handleGenerateScript} className="btn btn-ghost btn-sm" disabled={generatingScript}>
                  {generatingScript ? "กำลังสร้าง..." : "🤖 AI สร้างใหม่"}
                </button>
              </div>
              <textarea className="input" value={script} onChange={(e) => setScript(e.target.value)}
                style={{ minHeight: 280, fontFamily: "inherit", lineHeight: 1.7, fontSize: 13 }} />

              <div style={{ marginTop: 14 }}>
                <label className="input-label" style={{ marginBottom: 8 }}>🎙️ เสียง TTS</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {VOICES.map((v) => (
                    <button key={v.key} onClick={() => setForm((f: any) => ({ ...f, tts_voice: v.key }))}
                      style={{
                        padding: "6px 12px", borderRadius: 100, fontSize: 12, cursor: "pointer",
                        background: form.tts_voice === v.key ? "rgba(99,102,241,0.15)" : "var(--bg-surface)",
                        border: `1px solid ${form.tts_voice === v.key ? "var(--brand-primary)" : "var(--border-subtle)"}`,
                        color: form.tts_voice === v.key ? "var(--brand-primary-light)" : "var(--text-secondary)",
                        fontWeight: form.tts_voice === v.key ? 600 : 400,
                      }}>{v.label}</button>
                  ))}
                </div>
                <button onClick={handleTTSPreview} className="btn btn-secondary btn-sm" disabled={generatingTTS}>
                  {generatingTTS ? "⏳ กำลังสร้างเสียง..." : "▶️ ทดสอบเสียง"}
                </button>
                {audioSrc && <audio src={audioSrc} controls style={{ width: "100%", marginTop: 10, borderRadius: 8 }} autoPlay />}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: AVATAR ── */}
        {tab === "avatar" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Left: status + upload */}
            <div className="card">
              <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🎭 Avatar Video</h2>

              {/* Status */}
              {avatarStatus === "processing" && (
                <div style={{ padding: "14px 16px", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                  ⏳ HeyGen กำลังสร้างวิดีโอ... ใช้เวลาประมาณ 2-5 นาที ระบบจะอัปเดตอัตโนมัติ
                </div>
              )}
              {avatarStatus === "failed" && (
                <div style={{ padding: "14px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>❌ สร้าง Avatar Video ไม่สำเร็จ</div>
                  <div style={{ color: "var(--text-secondary)" }}>{avatarError}</div>
                  {avatarError?.toLowerCase().includes("credit") && (
                    <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, fontSize: 12 }}>
                      💳 HeyGen API ต้องการ <strong>API Credits</strong> แยกจาก subscription ปกติ
                      — ซื้อ credits ได้ที่ app.heygen.com → Billing
                    </div>
                  )}
                </div>
              )}
              {avatarStatus === "completed" && campaign?.avatar_url && (
                <div style={{ padding: "14px 16px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                  ✅ Avatar Video พร้อมใช้งานแล้ว
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all" }}>{campaign.avatar_url}</div>
                </div>
              )}
              {!campaign?.avatar_url && !["processing","completed","failed"].includes(avatarStatus) && (
                <div style={{ padding: "14px 16px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                  ℹ️ ยังไม่มี Avatar Video — สร้างด้วย HeyGen หรืออัปโหลดเองด้านล่าง
                </div>
              )}

              {/* Upload option */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>อัปโหลดวิดีโอเอง</p>
                <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={handleUploadAvatar} />
                <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }} disabled={uploading}>
                  {uploading ? "⏳ กำลังอัปโหลด..." : "📁 เลือกไฟล์วิดีโอ (.mp4)"}
                </button>
              </div>

              <div className="divider" />

              {/* HeyGen generate */}
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>สร้างด้วย HeyGen AI</p>

              <div className="form-group">
                <label className="input-label">เสียง HeyGen Voice</label>
                <select className="input" value={selectedHeygenVoice} onChange={(e) => setSelectedHeygenVoice(e.target.value)}>
                  <option value="">— เลือกเสียง —</option>
                  {heygenVoices.map((v) => (
                    <option key={v.voice_id} value={v.voice_id}>
                      {v.display_name || v.voice_id} ({v.gender})
                    </option>
                  ))}
                </select>
              </div>

              <button onClick={handleGenerateAvatar} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}
                disabled={generating || avatarStatus === "processing" || !selectedAvatar || !selectedHeygenVoice}>
                {generating ? "⏳ กำลังส่งคำขอ..." : avatarStatus === "processing" ? "⏳ กำลังสร้าง..." : "🎬 สร้าง Avatar Video"}
              </button>
            </div>

            {/* Right: avatar picker */}
            <div className="card" style={{ overflow: "hidden" }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>เลือก Avatar ({avatars.length})</h2>
              <input className="input" placeholder="🔍 ค้นหา avatar..." value={avatarSearch}
                onChange={(e) => setAvatarSearch(e.target.value)} style={{ marginBottom: 12 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, maxHeight: 480, overflowY: "auto" }}>
                {filteredAvatars.slice(0, 60).map((a, i) => (
                  <div key={`${a.avatar_id}-${i}`} onClick={() => setSelectedAvatar(a.avatar_id)}
                    style={{
                      borderRadius: 10, overflow: "hidden", cursor: "pointer",
                      border: `2px solid ${selectedAvatar === a.avatar_id ? "var(--brand-primary)" : "transparent"}`,
                      background: "var(--bg-elevated)", transition: "all 0.15s",
                    }}>
                    {a.preview_image_url
                      ? <img src={a.preview_image_url} alt={a.avatar_name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                      : <div style={{ width: "100%", aspectRatio: "1", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🧑</div>
                    }
                    <div style={{ padding: "6px 8px", fontSize: 11, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.3 }}>
                      {a.avatar_name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
