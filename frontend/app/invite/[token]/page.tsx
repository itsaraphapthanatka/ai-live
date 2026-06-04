"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function InvitePage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get(`/auth/invite/${token}`)
      .then((r) => setInvite(r.data))
      .catch(() => setError("ลิงก์เชิญหมดอายุหรือไม่ถูกต้อง"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    if (!fullName.trim()) { setError("กรุณาใส่ชื่อ"); return; }
    if (password.length < 6) { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (password !== confirm) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/auth/invite/accept", { token, full_name: fullName, password });
      setAuth(res.data.user, res.data.access_token);
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-base, #0f1117)", padding: 20,
    }}>
      <div style={{
        background: "#1a1d27", borderRadius: 20, padding: 40,
        width: "100%", maxWidth: 420, border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎙️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "white", marginBottom: 6 }}>AI Live Agency</h1>
          <p style={{ fontSize: 14, color: "#9ca3af" }}>คุณได้รับเชิญให้เข้าร่วมทีม</p>
        </div>

        {loading && <p style={{ textAlign: "center", color: "#9ca3af" }}>⏳ กำลังโหลด...</p>}

        {!loading && error && !invite && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
            <p style={{ color: "#ef4444", marginBottom: 20 }}>{error}</p>
            <a href="/login" style={{ color: "#6366f1", fontSize: 14 }}>← กลับหน้าเข้าสู่ระบบ</a>
          </div>
        )}

        {done && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 50, marginBottom: 12 }}>🎉</div>
            <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 16 }}>เข้าร่วมทีมสำเร็จ!</p>
            <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 8 }}>กำลังพาไปหน้า Dashboard...</p>
          </div>
        )}

        {invite && !done && (
          <>
            {/* Invite info */}
            <div style={{
              padding: "14px 16px", borderRadius: 12, marginBottom: 24,
              background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
            }}>
              <div style={{ fontSize: 13, color: "#a5b4fc", marginBottom: 4 }}>
                <strong>{invite.invited_by}</strong> เชิญคุณเข้าร่วมในฐานะ
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "white", fontWeight: 600 }}>{invite.email}</span>
                <span style={{
                  padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700,
                  background: invite.role === "admin" ? "rgba(245,158,11,0.15)" : "rgba(99,102,241,0.15)",
                  color: invite.role === "admin" ? "#f59e0b" : "#818cf8",
                  border: `1px solid ${invite.role === "admin" ? "rgba(245,158,11,0.3)" : "rgba(99,102,241,0.3)"}`,
                }}>
                  {invite.role === "admin" ? "👑 Admin" : "👤 Member"}
                </span>
              </div>
            </div>

            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: "#9ca3af", marginBottom: 6, display: "block" }}>ชื่อ-นามสกุล</label>
                <input
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
                    background: "#252836", border: "1px solid rgba(255,255,255,0.1)",
                    color: "white", outline: "none", boxSizing: "border-box",
                  }}
                  placeholder="ชื่อของคุณ" value={fullName} onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#9ca3af", marginBottom: 6, display: "block" }}>รหัสผ่าน</label>
                <input
                  type="password"
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
                    background: "#252836", border: "1px solid rgba(255,255,255,0.1)",
                    color: "white", outline: "none", boxSizing: "border-box",
                  }}
                  placeholder="อย่างน้อย 6 ตัวอักษร" value={password} onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#9ca3af", marginBottom: 6, display: "block" }}>ยืนยันรหัสผ่าน</label>
                <input
                  type="password"
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
                    background: "#252836", border: "1px solid rgba(255,255,255,0.1)",
                    color: "white", outline: "none", boxSizing: "border-box",
                  }}
                  placeholder="พิมพ์รหัสผ่านอีกครั้ง" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              {error && <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p>}

              <button
                onClick={handleAccept} disabled={submitting}
                style={{
                  padding: "12px", borderRadius: 12, fontSize: 15, fontWeight: 700,
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  border: "none", color: "white", cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.7 : 1, marginTop: 4,
                }}>
                {submitting ? "⏳ กำลังสร้างบัญชี..." : "✅ เข้าร่วมทีม"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
