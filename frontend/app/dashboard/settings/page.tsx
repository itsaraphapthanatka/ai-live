"use client";
import { useState, useEffect } from "react";
import { streamApi, heygenApi, platformApi, platformConfigApi, teamApi } from "@/lib/api";
import PlatformSetupCard from "@/components/PlatformSetupCard";
import { useAuthStore, useUIStore } from "@/lib/store";
import api from "@/lib/api";

const PLATFORMS = [
  { key: "facebook", icon: "📘", label: "Facebook Live", rtmpUrl: "rtmps://live-api-s.facebook.com:443/rtmp/" },
  { key: "youtube", icon: "📺", label: "YouTube Live", rtmpUrl: "rtmp://a.rtmp.youtube.com/live2/" },
  { key: "tiktok", icon: "🎵", label: "TikTok Live (RTMP)", rtmpUrl: "rtmp://push-rtmp-l3.tiktok.com/live/" },
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const addToast = useUIStore((s) => s.addToast);

  // Profile
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Stream accounts
  const [streamAccounts, setStreamAccounts] = useState<any[]>([]);
  const [newAccount, setNewAccount] = useState({ platform: "facebook", stream_key: "", label: "" });
  const [savingAccount, setSavingAccount] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // HeyGen avatars
  const [heygenAvatars, setHeygenAvatars] = useState<any[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(false);

  // Platform connections
  const [platformConnections, setPlatformConnections] = useState<Record<string, any>>({});

  // Team
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  // Load on mount
  useEffect(() => {
    streamApi.accounts().then(setStreamAccounts).catch(() => {});
    teamApi.members().then(setMembers).catch(() => {});
    platformApi.list()
      .then((conns: any[]) => {
        const map: Record<string, any> = {};
        conns.forEach((c) => { map[c.platform] = c; });
        setPlatformConnections(map);
      })
      .catch(() => {});

    // Check for connection success in URL
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) { addToast(`✅ เชื่อมต่อ ${connected} สำเร็จ!`, "success"); window.history.replaceState({}, "", "/dashboard/settings"); }
    if (error) { addToast(`❌ เชื่อมต่อไม่สำเร็จ: ${error}`, "error"); window.history.replaceState({}, "", "/dashboard/settings"); }
  }, []);

  // ── Save profile ──────────────────────────────────────────────────
  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      await (api as any).put("/auth/profile", { full_name: fullName });
      addToast("บันทึกข้อมูลสำเร็จ ✅", "success");
    } catch {
      addToast("เกิดข้อผิดพลาด กรุณาลองใหม่", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  // ── Add stream account ────────────────────────────────────────────
  async function handleAddStreamAccount() {
    if (!newAccount.stream_key.trim()) {
      addToast("กรุณาใส่ Stream Key", "error");
      return;
    }
    const platform = PLATFORMS.find((p) => p.key === newAccount.platform);
    setSavingAccount(true);
    try {
      const res = await streamApi.createAccount({
        platform: newAccount.platform,
        rtmp_url: platform?.rtmpUrl || "",
        stream_key: newAccount.stream_key,
        label: newAccount.label || platform?.label || newAccount.platform,
      });
      setStreamAccounts((prev) => [...prev, res]);
      setNewAccount({ platform: "facebook", stream_key: "", label: "" });
      addToast("เพิ่ม Stream Account สำเร็จ ✅", "success");
    } catch {
      addToast("ไม่สามารถบันทึกได้ กรุณาลองใหม่", "error");
    } finally {
      setSavingAccount(false);
    }
  }

  // ── Delete stream account ─────────────────────────────────────────
  async function handleDeleteAccount(id: number) {
    setDeletingId(id);
    try {
      await streamApi.deleteAccount(id);
      setStreamAccounts((prev) => prev.filter((a) => a.id !== id));
      addToast("ลบ Stream Account แล้ว", "success");
    } catch {
      addToast("ไม่สามารถลบได้", "error");
    } finally {
      setDeletingId(null);
    }
  }

  // ── Load HeyGen avatars ───────────────────────────────────────────
  async function handleLoadAvatars() {
    setLoadingAvatars(true);
    try {
      const res = await heygenApi.avatars();
      setHeygenAvatars(res.avatars || []);
      if (!res.avatars?.length) addToast("ไม่พบ Avatar ใน HeyGen account", "info");
    } catch (e: any) {
      addToast(e?.response?.data?.detail || "ไม่สามารถโหลด Avatar ได้ — ตรวจสอบ HEYGEN_API_KEY", "error");
    } finally {
      setLoadingAvatars(false);
    }
  }

  return (
    <div style={{ padding: "0 0 60px" }}>
      <div className="page-header">
        <h1 className="page-title">⚙️ ตั้งค่า</h1>
        <p className="page-subtitle">จัดการข้อมูลบัญชี, ทีม, และการเชื่อมต่อแพลตฟอร์ม</p>
      </div>

      <div style={{ padding: "0 32px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Profile ─────────────────────────────────────────────── */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 16 }}>👤 ข้อมูลบัญชี</h3>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 20, alignItems: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "var(--gradient-brand)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 800, color: "white",
            }}>
              {fullName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="input-label">ชื่อ-นามสกุล</label>
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ชื่อของคุณ" />
              </div>
              <div>
                <label className="input-label">อีเมล</label>
                <input className="input" value={user?.email || ""} disabled style={{ opacity: 0.6 }} />
              </div>
            </div>
          </div>
          <button onClick={handleSaveProfile} disabled={savingProfile} className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
            {savingProfile ? "⏳ กำลังบันทึก..." : "💾 บันทึกข้อมูล"}
          </button>
        </div>

        {/* ── Team ─────────────────────────────────────────────────── */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 4, fontSize: 16 }}>👥 ทีม</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            จัดการสมาชิกในทีม — ทุกคนใช้ข้อมูล campaigns, leads, และ live sessions ร่วมกัน
          </p>

          {/* Member list */}
          <div style={{ marginBottom: 16 }}>
            {members.map((m) => (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 10, marginBottom: 8,
                background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: m.role === "admin" ? "rgba(245,158,11,0.2)" : "rgba(99,102,241,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, flexShrink: 0,
                }}>
                  {m.full_name?.[0] || m.email?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {m.full_name || "—"} {m.is_me && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>(คุณ)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
                </div>
                <select
                  value={m.role}
                  disabled={m.is_me || user?.role !== "admin"}
                  onChange={async (e) => {
                    await teamApi.updateRole(m.id, e.target.value);
                    setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, role: e.target.value } : x));
                    addToast("เปลี่ยน role แล้ว", "success");
                  }}
                  style={{
                    padding: "4px 8px", borderRadius: 8, fontSize: 12,
                    background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                    color: m.role === "admin" ? "#f59e0b" : "var(--text-secondary)",
                    cursor: m.is_me || user?.role !== "admin" ? "default" : "pointer",
                  }}>
                  <option value="admin">👑 Admin</option>
                  <option value="member">👤 Member</option>
                </select>
                {!m.is_me && user?.role === "admin" && (
                  <button
                    onClick={async () => {
                      if (!confirm(`ลบ ${m.full_name || m.email} ออกจากทีม?`)) return;
                      await teamApi.removeMember(m.id);
                      setMembers((prev) => prev.filter((x) => x.id !== m.id));
                      addToast("ลบสมาชิกแล้ว", "success");
                    }}
                    style={{
                      padding: "4px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444",
                    }}>
                    ลบ
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Invite form (admin only) */}
          {user?.role === "admin" && (
            <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: 16, border: "1px dashed var(--border-default)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>➕ เชิญสมาชิกใหม่</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 10, alignItems: "flex-end" }}>
                <div>
                  <label className="input-label">อีเมล</label>
                  <input className="input" type="email" placeholder="member@company.com"
                    value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Role</label>
                  <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="member">👤 Member</option>
                    <option value="admin">👑 Admin</option>
                  </select>
                </div>
                <button
                  disabled={inviting || !inviteEmail.trim()}
                  onClick={async () => {
                    setInviting(true);
                    setInviteLink("");
                    try {
                      const res = await teamApi.invite(inviteEmail, inviteRole);
                      setInviteLink(res.invite_url);
                      setInviteEmail("");
                      addToast("สร้างลิงก์เชิญแล้ว!", "success");
                    } catch (e: any) {
                      addToast(e?.response?.data?.detail || "เกิดข้อผิดพลาด", "error");
                    } finally {
                      setInviting(false);
                    }
                  }}
                  className="btn btn-primary">
                  {inviting ? "⏳" : "📨 เชิญ"}
                </button>
              </div>

              {/* Invite link */}
              {inviteLink && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(34,197,94,0.08)", borderRadius: 10, border: "1px solid rgba(34,197,94,0.2)" }}>
                  <p style={{ fontSize: 12, color: "#22c55e", marginBottom: 6, fontWeight: 600 }}>✅ ลิงก์เชิญ (มีอายุ 7 วัน)</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input readOnly className="input" value={inviteLink} style={{ fontSize: 12, flex: 1 }} />
                    <button
                      onClick={() => { navigator.clipboard.writeText(inviteLink); addToast("Copy แล้ว!", "success"); }}
                      className="btn btn-secondary btn-sm">
                      📋 Copy
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                    ส่งลิงก์นี้ให้สมาชิกใหม่ — เขาจะตั้งรหัสผ่านและเข้าร่วมทีมได้ทันที
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Platform Connections ─────────────────────────────────── */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 4, fontSize: 16 }}>🔗 เชื่อมต่อแพลตฟอร์ม</h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              ตั้งค่า credentials แล้วกด เชื่อมต่อ — กด "เริ่ม Live" ในระบบแล้ว Facebook/YouTube Live ขึ้นอัตโนมัติ
            </p>
            <button
              onClick={async () => {
                try {
                  const res = await platformConfigApi.importEnvAll();
                  const count = Object.keys(res.imported || {}).length;
                  if (count > 0) addToast(`📥 Import ${count} platform จาก .env แล้ว`, "success");
                  else addToast("ไม่พบค่าใน .env ที่จะ import", "info");
                  window.location.reload();
                } catch { addToast("Import ไม่สำเร็จ", "error"); }
              }}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
              📥 Import ทั้งหมดจาก .env
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            <PlatformSetupCard
              platform="facebook"
              icon="📘" title="Facebook Live" color="#1877f2"
              description="ต้องการ Facebook App เพื่อสร้าง Live บน Page อัตโนมัติ"
            >
              {(() => {
                const conn = platformConnections["facebook"];
                return conn ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: "#22c55e" }}>✅ {conn.page_name || "เชื่อมต่อแล้ว"}</span>
                    <button onClick={async () => {
                      await platformApi.disconnect("facebook");
                      setPlatformConnections((prev) => { const n = { ...prev }; delete n.facebook; return n; });
                      addToast("ยกเลิกการเชื่อมต่อ Facebook แล้ว", "info");
                    }} style={{ padding: "4px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button onClick={async () => {
                    try {
                      const res = await platformApi.connectUrl("facebook");
                      window.location.href = res.oauth_url;
                    } catch (e: any) {
                      addToast(e?.response?.data?.detail || "กรุณาบันทึก App ID และ App Secret ก่อน", "error");
                    }
                  }} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "#1877f2", border: "none", color: "white" }}>
                    🔗 เชื่อมต่อ Facebook Page
                  </button>
                );
              })()}
            </PlatformSetupCard>

            <PlatformSetupCard
              platform="youtube"
              icon="📺" title="YouTube Live" color="#ff0000"
              description="ต้องการ Google OAuth Client เพื่อสร้าง Live บน Channel อัตโนมัติ"
            >
              {(() => {
                const conn = platformConnections["youtube"];
                return conn ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: "#22c55e" }}>✅ {conn.channel_title || "เชื่อมต่อแล้ว"}</span>
                    <button onClick={async () => {
                      await platformApi.disconnect("youtube");
                      setPlatformConnections((prev) => { const n = { ...prev }; delete n.youtube; return n; });
                      addToast("ยกเลิกการเชื่อมต่อ YouTube แล้ว", "info");
                    }} style={{ padding: "4px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button onClick={async () => {
                    try {
                      const res = await platformApi.connectUrl("youtube");
                      window.location.href = res.oauth_url;
                    } catch (e: any) {
                      addToast(e?.response?.data?.detail || "กรุณาบันทึก Client ID และ Client Secret ก่อน", "error");
                    }
                  }} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "#ff0000", border: "none", color: "white" }}>
                    🔗 เชื่อมต่อ YouTube Channel
                  </button>
                );
              })()}
            </PlatformSetupCard>

            <PlatformSetupCard
              platform="heygen"
              icon="🤖" title="HeyGen AI Avatar" color="#6366f1"
              description="API Key สำหรับ AI Avatar พูดตอบ comment บน Live"
              onSaved={() => addToast("บันทึก HeyGen credentials แล้ว ✅", "success")}
            />

            <PlatformSetupCard
              platform="tiktool"
              icon="🎵" title="tik.tools (TikTok Live)" color="#00f2ea"
              description="API Key สำหรับดึง comment จาก TikTok Live แบบ real-time"
              onSaved={() => addToast("บันทึก tik.tools API Key แล้ว ✅", "success")}
            />

          </div>
        </div>

        {/* ── TikTok LIVE Studio (RTMP) ─────────────────────────────── */}
        <PlatformSetupCard
          platform="tiktok_rtmp"
          icon="🎵" title="TikTok LIVE Studio (Stream จาก PC)" color="#00f2ea"
          description="Stream Key สำหรับ push video ไป TikTok โดยตรง — ต้องมี 1,000+ followers"
          onSaved={() => addToast("บันทึก TikTok Stream Key แล้ว ✅", "success")}
        />


        {/* ── OpenAI API Key ────────────────────────────────────────── */}
        <PlatformSetupCard
          platform="openai"
          icon="🤖" title="OpenAI" color="#10a37f"
          description="API Key สำหรับ AI Script Generator, TTS, และ Comment Reply"
          onSaved={() => addToast("บันทึก OpenAI API Key แล้ว ✅", "success")}
        />

        {/* ── Danger Zone ──────────────────────────────────────────── */}
        <div className="card" style={{ border: "1px solid rgba(239,68,68,0.2)" }}>
          <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: 16, color: "#ef4444" }}>⚠️ Danger Zone</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>การกระทำเหล่านี้ไม่สามารถย้อนกลับได้</p>
          <button
            onClick={() => addToast("กรุณาติดต่อ support@ailive.agency เพื่อลบบัญชี", "info")}
            className="btn btn-danger">
            🗑️ ลบบัญชีและข้อมูลทั้งหมด
          </button>
        </div>

      </div>
    </div>
  );
}
