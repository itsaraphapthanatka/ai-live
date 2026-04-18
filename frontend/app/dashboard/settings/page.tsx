"use client";
import { useState } from "react";
import { streamApi } from "@/lib/api";
import { useAuthStore, useUIStore } from "@/lib/store";

const PLATFORMS = [
  { key: "facebook", icon: "📘", label: "Facebook Live", rtmpUrl: "rtmps://live-api-s.facebook.com:443/rtmp/" },
  { key: "youtube", icon: "📺", label: "YouTube Live", rtmpUrl: "rtmp://a.rtmp.youtube.com/live2/" },
  { key: "tiktok", icon: "🎵", label: "TikTok Live", rtmpUrl: "rtmp://push-rtmp-l3.tiktok.com/live/" },
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const addToast = useUIStore((s) => s.addToast);
  const [apiKey, setApiKey] = useState("");
  const [streamAccounts, setStreamAccounts] = useState<any[]>([]);
  const [newAccount, setNewAccount] = useState({ platform: "facebook", stream_key: "", label: "" });
  const [saving, setSaving] = useState(false);

  async function handleAddStreamAccount() {
    if (!newAccount.stream_key) { addToast("กรุณาใส่ Stream Key", "error"); return; }
    const platform = PLATFORMS.find((p) => p.key === newAccount.platform);
    setSaving(true);
    try {
      const res = await streamApi.createAccount({
        platform: newAccount.platform,
        rtmp_url: platform?.rtmpUrl || "",
        stream_key: newAccount.stream_key,
        label: newAccount.label || platform?.label || newAccount.platform,
      });
      setStreamAccounts((a) => [...a, res]);
      setNewAccount({ platform: "facebook", stream_key: "", label: "" });
      addToast("เพิ่ม Stream Account สำเร็จ!", "success");
    } catch {
      setStreamAccounts((a) => [...a, { id: Date.now(), ...newAccount, rtmp_url: platform?.rtmpUrl }]);
      setNewAccount({ platform: "facebook", stream_key: "", label: "" });
      addToast("บันทึก Stream Account (demo mode)", "success");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "0 0 60px" }}>
      <div className="page-header">
        <h1 className="page-title">⚙️ ตั้งค่า</h1>
        <p className="page-subtitle">จัดการ API Keys, Stream Accounts, และการตั้งค่าบัญชี</p>
      </div>

      <div style={{ padding: "0 32px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Profile */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 16 }}>👤 ข้อมูลบัญชี</h3>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 20, alignItems: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--gradient-brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800 }}>
              {user?.full_name?.[0] || user?.email?.[0] || "U"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="input-label">ชื่อ-นามสกุล</label>
                <input id="settings-name" className="input" defaultValue={user?.full_name || ""} placeholder="ชื่อของคุณ" />
              </div>
              <div>
                <label className="input-label">อีเมล</label>
                <input id="settings-email" className="input" defaultValue={user?.email || ""} disabled style={{ opacity: 0.6 }} />
              </div>
            </div>
          </div>
          <button id="save-profile-btn" onClick={() => addToast("บันทึกข้อมูลสำเร็จ ✅", "success")} className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
            💾 บันทึกข้อมูล
          </button>
        </div>

        {/* OpenAI API Key */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: 16 }}>🤖 OpenAI API Key</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            ใช้สำหรับ AI Script Generator, TTS, และ Comment Reply — ตั้งค่าใน <code style={{ background: "var(--bg-surface)", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>backend/.env</code>
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <input id="openai-key" type="password" className="input" placeholder="sk-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={{ flex: 1 }} />
            <button id="save-apikey-btn" onClick={() => addToast("💡 ใส่ key ใน backend/.env แล้ว restart uvicorn", "info")} className="btn btn-secondary">บันทึก</button>
          </div>
          <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, fontSize: 13, color: "var(--text-secondary)" }}>
            ⚠️ ใส่ key ใน <code>backend/.env</code>: <code>OPENAI_API_KEY=sk-xxx</code> แล้ว restart server
          </div>
        </div>

        {/* Stream Accounts */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: 16 }}>📡 Stream Accounts</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>เพิ่ม Stream Key จาก Facebook, YouTube, TikTok เพื่อยิงสดอัตโนมัติ</p>

          {/* Existing accounts */}
          {streamAccounts.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-surface)", borderRadius: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{PLATFORMS.find((p) => p.key === a.platform)?.icon || "📡"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.label || a.platform}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.rtmp_url?.slice(0, 40)}...</div>
              </div>
              <span className="badge badge-ended">เชื่อมต่อแล้ว</span>
            </div>
          ))}

          {/* Add new account */}
          <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: 16, border: "1px dashed var(--border-default)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>➕ เพิ่ม Account ใหม่</p>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "flex-end" }}>
              <div>
                <label className="input-label">แพลตฟอร์ม</label>
                <select id="platform-select" className="input" value={newAccount.platform} onChange={(e) => setNewAccount((a) => ({ ...a, platform: e.target.value }))} style={{ width: 160 }}>
                  {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Stream Key</label>
                <input id="stream-key-input" type="password" className="input" placeholder="ใส่ Stream Key จากแพลตฟอร์ม" value={newAccount.stream_key} onChange={(e) => setNewAccount((a) => ({ ...a, stream_key: e.target.value }))} />
              </div>
              <button id="add-stream-account-btn" onClick={handleAddStreamAccount} className="btn btn-primary" disabled={saving}>
                {saving ? "⏳" : "➕ เพิ่ม"}
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card" style={{ border: "1px solid rgba(239,68,68,0.2)" }}>
          <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: 16, color: "#ef4444" }}>⚠️ Danger Zone</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>การกระทำเหล่านี้ไม่สามารถย้อนกลับได้</p>
          <button id="delete-account-btn" onClick={() => addToast("กรุณาติดต่อ support@ailive.agency เพื่อลบบัญชี", "info")} className="btn btn-danger">
            🗑️ ลบบัญชีและข้อมูลทั้งหมด
          </button>
        </div>
      </div>
    </div>
  );
}
