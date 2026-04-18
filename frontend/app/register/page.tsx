"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", company_name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await authApi.register(form);
      setAuth(data.user, data.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: "var(--gradient-brand)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, margin: "0 auto 16px", boxShadow: "0 8px 24px rgba(99,102,241,0.4)"
          }}>🎙️</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: "Plus Jakarta Sans, sans-serif" }}>สร้างบัญชีใหม่</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 6 }}>เริ่มต้น AI Live Agency ของคุณวันนี้</p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="input-label">ชื่อ-นามสกุล</label>
              <input id="reg-name" type="text" className="input" placeholder="สมชาย ใจดี" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="input-label">ชื่อบริษัท / Agency</label>
              <input id="reg-company" type="text" className="input" placeholder="My AI Live Agency" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="input-label">อีเมล</label>
              <input id="reg-email" type="email" className="input" placeholder="you@company.com" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="input-label">รหัสผ่าน</label>
              <input id="reg-password" type="password" className="input" placeholder="อย่างน้อย 8 ตัวอักษร" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
                ⚠️ {error}
              </div>
            )}

            <button id="reg-submit" type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "14px", fontSize: 15 }} disabled={loading}>
              {loading ? "กำลังสร้างบัญชี..." : "🚀 เริ่มใช้งานฟรี"}
            </button>
          </form>

          <div className="divider" />
          <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
            มีบัญชีแล้ว?{" "}
            <Link href="/login" style={{ color: "var(--brand-primary-light)", fontWeight: 600 }}>เข้าสู่ระบบ</Link>
          </p>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 16 }}>
          เริ่มต้น Starter Plan ฟรี 14 วัน — ไม่ต้องใส่บัตรเครดิต
        </p>
      </div>
    </div>
  );
}
