"use client";
import { useState } from "react";
import { useUIStore } from "@/lib/store";

const PLANS = [
  {
    id: "starter", name: "Starter", price: 9900, tag: null,
    features: ["3 แคมเปญพร้อมกัน", "30 ชม. Live/เดือน", "AI Script Generator", "TTS Voice", "Basic Analytics", "Email Support"],
    color: "#6366f1"
  },
  {
    id: "pro", name: "Pro", price: 19900, tag: "ยอดนิยม",
    features: ["10 แคมเปญพร้อมกัน", "100 ชม. Live/เดือน", "AI Script Generator", "TTS Voice Premium", "AI Comment Reply ✅", "Lead CRM", "Advanced Analytics", "Priority Support"],
    color: "#8b5cf6"
  },
  {
    id: "business", name: "Business", price: 39900, tag: "สำหรับ Agency",
    features: ["แคมเปญไม่จำกัด", "Live ไม่จำกัด", "AI Script Generator", "TTS Voice All", "AI Comment Reply ✅", "Lead CRM + Export", "Custom Avatar", "White-label Dashboard", "Dedicated Support"],
    color: "#ec4899"
  },
];

export default function BillingPage() {
  const [currentPlan] = useState("starter");
  const [billing, setBilling] = useState("monthly");
  const addToast = useUIStore((s) => s.addToast);

  return (
    <div style={{ padding: "0 0 60px" }}>
      <div className="page-header">
        <h1 className="page-title">💳 Billing & แพ็กเกจ</h1>
        <p className="page-subtitle">เลือกแพ็กเกจที่เหมาะกับ Agency ของคุณ</p>
      </div>

      <div style={{ padding: "0 32px" }}>
        {/* Current plan status */}
        <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 14, padding: "18px 22px", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>แพ็กเกจปัจจุบัน</p>
            <p style={{ fontWeight: 800, fontSize: 20 }}>🟣 Starter Plan — ทดลองใช้ฟรี 14 วัน</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>หมดอายุ</p>
            <p style={{ fontWeight: 700 }}>30 เมษายน 2026</p>
          </div>
        </div>

        {/* Billing toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 32 }}>
          <span style={{ fontSize: 14, color: billing === "monthly" ? "var(--text-primary)" : "var(--text-muted)" }}>รายเดือน</span>
          <div onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")} style={{
            width: 52, height: 28, borderRadius: 14, cursor: "pointer", position: "relative",
            background: billing === "yearly" ? "var(--brand-primary)" : "var(--bg-elevated)", transition: "all 0.3s ease"
          }}>
            <div style={{ position: "absolute", top: 3, left: billing === "yearly" ? 26 : 3, width: 22, height: 22, borderRadius: "50%", background: "white", transition: "all 0.3s ease" }} />
          </div>
          <span style={{ fontSize: 14, color: billing === "yearly" ? "var(--text-primary)" : "var(--text-muted)" }}>รายปี</span>
          {billing === "yearly" && <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 100, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>ประหยัด 20%</span>}
        </div>

        {/* Plan cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 36 }}>
          {PLANS.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan;
            const price = billing === "yearly" ? Math.round(plan.price * 12 * 0.8) : plan.price;

            return (
              <div key={plan.id} id={`plan-${plan.id}`} className={`plan-card ${plan.id === "pro" ? "popular" : ""}`}
                style={{ position: "relative" }}>

                {plan.tag && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: plan.id === "pro" ? "var(--gradient-brand)" : "var(--gradient-gold)", color: "white", borderRadius: 100, padding: "4px 14px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                    ⭐ {plan.tag}
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{plan.name}</h3>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: plan.color }}>฿{price.toLocaleString()}</span>
                    <span style={{ fontSize: 14, color: "var(--text-muted)" }}>/{billing === "yearly" ? "ปี" : "เดือน"}</span>
                  </div>
                  {billing === "yearly" && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>฿{Math.round(price / 12).toLocaleString()}/เดือน</p>}
                </div>

                <ul style={{ listStyle: "none", marginBottom: 24 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 14, color: "var(--text-secondary)" }}>
                      <span style={{ color: plan.color, flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  id={`upgrade-${plan.id}`}
                  onClick={() => addToast(`🚀 เชื่อมต่อ Payment Gateway (Omise/Stripe) เพื่อ upgrade plan`, "info")}
                  className={`btn ${isCurrentPlan ? "btn-ghost" : "btn-primary"}`}
                  style={{ width: "100%", justifyContent: "center", padding: "12px", background: isCurrentPlan ? undefined : plan.id === "pro" ? "var(--gradient-brand)" : undefined }}
                >
                  {isCurrentPlan ? "✅ แพ็กเกจปัจจุบัน" : `อัปเกรด ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Invoice history */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>🧾 ประวัติการชำระเงิน</h3>
          </div>
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧾</div>
            <p>ยังไม่มีประวัติการชำระเงิน</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>รายการ invoice จะปรากฏที่นี่หลังจากชำระเงิน</p>
          </div>
        </div>
      </div>
    </div>
  );
}
