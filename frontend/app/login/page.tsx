"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      setAuth(data.user, data.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--bg-base)" }}>
      {/* Left panel */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", padding: "40px", background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)"
      }}>
        <div style={{ maxWidth: 420, width: "100%" }}>
          {/* Logo */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "var(--gradient-brand)", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 24, marginBottom: 16, boxShadow: "0 8px 24px rgba(99,102,241,0.4)"
            }}>🎙️</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              AI Live Agency
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 14 }}>
              ระบบ AI Live Commerce อัตโนมัติ
            </p>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>เข้าสู่ระบบ</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 28 }}>
            ยินดีต้อนรับกลับมา 👋
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="input-label">อีเมล</label>
              <input
                id="login-email"
                type="email"
                className="input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="input-label">รหัสผ่าน</label>
              <input
                id="login-password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ef4444",
                marginBottom: 16
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "14px 20px", fontSize: 15 }}
              disabled={loading}
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-secondary)" }}>
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" style={{ color: "var(--brand-primary-light)", fontWeight: 600 }}>
              สมัครใช้งาน
            </Link>
          </p>

          {/* Demo credentials */}
          <div style={{
            marginTop: 28, padding: "14px 16px", background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, fontSize: 13
          }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>🧪 Demo Account</p>
            <p style={{ color: "var(--text-muted)" }}>Email: demo@ailive.agency</p>
            <p style={{ color: "var(--text-muted)" }}>Password: demo1234</p>
          </div>
        </div>
      </div>

      {/* Right panel — hero */}
      <div style={{
        flex: 1.2, display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", padding: "60px",
        background: "linear-gradient(135deg, #0f0f12 0%, #17173a 50%, #0f0f12 100%)",
        position: "relative", overflow: "hidden"
      }}>
        {/* Background glow */}
        <div style={{
          position: "absolute", width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
          top: "50%", left: "50%", transform: "translate(-50%,-50%)"
        }} />

        <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 480 }}>
          <div style={{ fontSize: 72, marginBottom: 24 }}>🚀</div>
          <h2 style={{
            fontSize: 36, fontWeight: 800, fontFamily: "Plus Jakarta Sans, sans-serif",
            lineHeight: 1.2, marginBottom: 20
          }}>
            <span className="gradient-text">AI พูดสด</span>
            <br />แทนคุณ 24/7
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 16, lineHeight: 1.7, marginBottom: 36 }}>
            สร้างแคมเปญ Live ได้ในไม่กี่นาที AI สร้าง script,
            พูดด้วยเสียงจริง และถ่ายทอดสดไปยัง TikTok, Facebook, YouTube โดยอัตโนมัติ
          </p>

          {/* Feature pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {["🤖 AI Script Generator", "🎙️ Text-to-Speech", "📡 RTMP Streaming", "📊 Analytics", "💬 AI Comment Reply", "🎯 Lead Capture"].map((f) => (
              <span key={f} style={{
                padding: "8px 14px", borderRadius: 100, fontSize: 13, fontWeight: 500,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--text-secondary)"
              }}>{f}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
