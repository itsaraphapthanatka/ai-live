"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { campaignApi, aiApi } from "@/lib/api";
import { useUIStore } from "@/lib/store";

const TONES = [
  { key: "friendly", icon: "😊", label: "เป็นกันเอง", desc: "สนุก น่าเชื่อถือ" },
  { key: "luxury", icon: "💎", label: "หรูหรา", desc: "สง่างาม มีระดับ" },
  { key: "energetic", icon: "⚡", label: "มีพลัง", desc: "กระตุ้น โน้มน้าว" },
  { key: "professional", icon: "👔", label: "มืออาชีพ", desc: "ตรงประเด็น" },
];

const VOICES = [
  { key: "nova", label: "Nova", desc: "หญิง — มีพลัง" },
  { key: "shimmer", label: "Shimmer", desc: "หญิง — นุ่มนวล" },
  { key: "alloy", label: "Alloy", desc: "กลาง — เป็นธรรมชาติ" },
  { key: "onyx", label: "Onyx", desc: "ชาย — มั่นคง" },
  { key: "echo", label: "Echo", desc: "ชาย — ลึก" },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [form, setForm] = useState({
    name: "",
    product_name: "",
    product_price: "",
    product_highlights: "",
    promotion: "",
    language: "th",
    tone: "friendly",
    business_type: "",
  });
  const [script, setScript] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("nova");
  const [audioSrc, setAudioSrc] = useState("");
  const [step, setStep] = useState(1); // 1=info, 2=script, 3=preview
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingTTS, setGeneratingTTS] = useState(false);
  const [saving, setSaving] = useState(false);

  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleGenerateScript() {
    if (!form.product_name) { addToast("กรุณาใส่ชื่อสินค้าก่อน", "error"); return; }
    setGeneratingScript(true);
    try {
      const res = await aiApi.generateScript({ ...form });
      setScript(res.script);
      setStep(2);
      addToast("สร้าง Script สำเร็จ! 🎉", "success");
    } catch {
      addToast("AI ไม่สามารถสร้าง Script ได้ (ตรวจสอบ API Key)", "error");
      // Show demo script
      setScript(`🎙️ สวัสดีครับ/ค่ะ ทุกคนที่กำลังรับชม Live อยู่! วันนี้มีของดีมาฝากกันค่ะ...

✨ ${form.product_name || "สินค้าเด็ด"} ราคาพิเศษ ${form.product_price || "ราคาสุดคุ้ม"}!

📌 จุดเด่น:
${form.product_highlights || "• คุณภาพดีเยี่ยม\n• ราคาสุดคุ้ม\n• ส่งไวทั่วประเทศ"}

🔥 โปรโมชัน: ${form.promotion || "สั่งวันนี้รับส่วนลดพิเศษ!"}

💬 มีคำถามอะไรก็พิมพ์ถามได้เลยนะคะ AI จะตอบทุกคำถาม!

🛒 สั่งผ่าน Link ด้านล่างได้เลยค่ะ ของมีจำนวนจำกัด!`);
      setStep(2);
    } finally {
      setGeneratingScript(false);
    }
  }

  async function handleTTSPreview() {
    if (!script) return;
    setGeneratingTTS(true);
    try {
      // Use first 500 chars for preview
      const preview = script.slice(0, 500);
      const res = await aiApi.tts(preview, selectedVoice);
      setAudioSrc(res.audio);
      addToast("TTS พร้อมเล่นแล้ว 🎙️", "success");
    } catch {
      addToast("TTS ไม่พร้อมใช้งาน (ตรวจสอบ OpenAI Key)", "error");
    } finally {
      setGeneratingTTS(false);
    }
  }

  async function handleSave() {
    if (!form.name) { addToast("กรุณาใส่ชื่อแคมเปญ", "error"); return; }
    setSaving(true);
    try {
      await campaignApi.create({ ...form, script });
      addToast("บันทึกแคมเปญสำเร็จ! 🎉", "success");
      router.push("/dashboard/campaigns");
    } catch {
      addToast("บันทึกไม่สำเร็จ (กรุณา login ก่อน)", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "0 0 60px" }}>
      <div className="page-header">
        <h1 className="page-title">🆕 สร้างแคมเปญ Live</h1>
        <p className="page-subtitle">ตั้งค่าสินค้า เลือกน้ำเสียง แล้วให้ AI สร้าง Script ให้อัตโนมัติ</p>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 24 }}>
          {[
            { n: 1, label: "ข้อมูลสินค้า" },
            { n: 2, label: "AI Script" },
            { n: 3, label: "Preview & บันทึก" },
          ].map((s, i) => (
            <div key={s.n} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                  background: step >= s.n ? "var(--gradient-brand)" : "var(--bg-elevated)",
                  color: step >= s.n ? "white" : "var(--text-muted)",
                  transition: "all 0.3s ease"
                }}>{s.n}</div>
                <span style={{ fontSize: 13, fontWeight: step === s.n ? 600 : 400, color: step === s.n ? "var(--text-primary)" : "var(--text-muted)" }}>{s.label}</span>
              </div>
              {i < 2 && <div style={{ width: 40, height: 1, background: step > s.n ? "var(--brand-primary)" : "var(--border-subtle)", margin: "0 12px", transition: "all 0.3s" }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: step === 2 ? "1fr 1fr" : "1fr", gap: 20 }}>

          {/* Step 1: Product Info */}
          {step >= 1 && (
            <div className="card animate-fade-up">
              <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 20 }}>📦 ข้อมูลสินค้า & แคมเปญ</h2>

              <div className="form-group">
                <label className="input-label">ชื่อแคมเปญ *</label>
                <input id="campaign-name" className="input" placeholder="เช่น เช่ารถภูเก็ต - Summer 2026" value={form.name} onChange={(e) => setF("name", e.target.value)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="form-group">
                  <label className="input-label">ชื่อสินค้า / บริการ *</label>
                  <input id="product-name" className="input" placeholder="บริการเช่ารถ ภูเก็ต" value={form.product_name} onChange={(e) => setF("product_name", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="input-label">ราคา</label>
                  <input id="product-price" className="input" placeholder="800฿/วัน" value={form.product_price} onChange={(e) => setF("product_price", e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="input-label">จุดขายหลัก (จุดเด่น)</label>
                <textarea id="product-highlights" className="input" placeholder={"รับ-ส่งสนามบิน\nประกันชั้น 1\nราคาถูกที่สุดในภูเก็ต"} value={form.product_highlights} onChange={(e) => setF("product_highlights", e.target.value)} style={{ minHeight: 80 }} />
              </div>

              <div className="form-group">
                <label className="input-label">โปรโมชัน / ข้อเสนอพิเศษ</label>
                <input id="promotion" className="input" placeholder="สั่งวันนี้รับ GPS ฟรี! จำนวนจำกัด" value={form.promotion} onChange={(e) => setF("promotion", e.target.value)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="form-group">
                  <label className="input-label">ประเภทธุรกิจ</label>
                  <input id="business-type" className="input" placeholder="ท่องเที่ยว / เสื้อผ้า / อาหาร..." value={form.business_type} onChange={(e) => setF("business_type", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="input-label">ภาษา</label>
                  <select id="language-select" className="input" value={form.language} onChange={(e) => setF("language", e.target.value)}>
                    <option value="th">🇹🇭 ภาษาไทย</option>
                    <option value="en">🇺🇸 English</option>
                    <option value="zh">🇨🇳 中文</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="input-label" style={{ marginBottom: 10 }}>น้ำเสียง (Tone)</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  {TONES.map((t) => (
                    <div key={t.key} id={`tone-${t.key}`} className={`tone-option ${form.tone === t.key ? "selected" : ""}`} onClick={() => setF("tone", t.key)}>
                      <span style={{ fontSize: 22 }}>{t.icon}</span>
                      <span style={{ fontWeight: 600 }}>{t.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {step === 1 && (
                <button id="generate-script-btn" onClick={handleGenerateScript} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 16, padding: "14px" }} disabled={generatingScript}>
                  {generatingScript ? "🤖 กำลังสร้าง Script..." : "🤖 สร้าง AI Script อัตโนมัติ"}
                </button>
              )}
            </div>
          )}

          {/* Step 2: Script editor */}
          {step >= 2 && (
            <div className="card animate-fade-up">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ fontWeight: 700, fontSize: 17 }}>📝 AI Script</h2>
                <button id="regenerate-btn" onClick={handleGenerateScript} className="btn btn-ghost btn-sm" disabled={generatingScript}>
                  {generatingScript ? "กำลังสร้าง..." : "🔄 สร้างใหม่"}
                </button>
              </div>

              <textarea
                id="script-editor"
                className="input"
                value={script}
                onChange={(e) => setScript(e.target.value)}
                style={{ minHeight: 320, fontFamily: "inherit", lineHeight: 1.7, fontSize: 14 }}
                placeholder="Script จะปรากฏที่นี่..."
              />

              <div style={{ marginTop: 16 }}>
                <label className="input-label" style={{ marginBottom: 10 }}>🎙️ เสียง TTS</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  {VOICES.map((v) => (
                    <button key={v.key} id={`voice-${v.key}`} onClick={() => setSelectedVoice(v.key)}
                      style={{
                        padding: "7px 14px", borderRadius: 100, fontSize: 13, cursor: "pointer",
                        background: selectedVoice === v.key ? "rgba(99,102,241,0.15)" : "var(--bg-surface)",
                        border: `1px solid ${selectedVoice === v.key ? "var(--brand-primary)" : "var(--border-subtle)"}`,
                        color: selectedVoice === v.key ? "var(--brand-primary-light)" : "var(--text-secondary)",
                        fontWeight: selectedVoice === v.key ? 600 : 400, transition: "all 0.15s"
                      }}
                    >{v.label} <span style={{ opacity: 0.7, fontSize: 11 }}>{v.desc}</span></button>
                  ))}
                </div>

                <button id="tts-preview-btn" onClick={handleTTSPreview} className="btn btn-secondary" disabled={generatingTTS} style={{ marginBottom: 12 }}>
                  {generatingTTS ? "⏳ กำลังสร้างเสียง..." : "▶️ ทดสอบเสียง TTS"}
                </button>

                {audioSrc && (
                  <audio ref={audioRef} src={audioSrc} controls style={{ width: "100%", borderRadius: 8 }} autoPlay />
                )}
              </div>

              <div className="divider" />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep(1)} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }}>← กลับ</button>
                <button id="save-campaign-btn" onClick={handleSave} className="btn btn-primary" style={{ flex: 2, justifyContent: "center" }} disabled={saving}>
                  {saving ? "กำลังบันทึก..." : "💾 บันทึกแคมเปญ"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
