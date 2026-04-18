"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { analyticsApi } from "@/lib/api";
import { useUIStore } from "@/lib/store";

interface Overview {
  total_campaigns: number;
  live_campaigns: number;
  total_sessions: number;
  total_leads: number;
  recent_campaigns: any[];
}

const STATUS_BADGE: Record<string, string> = {
  live: "badge-live",
  draft: "badge-draft",
  scheduled: "badge-scheduled",
  ended: "badge-ended",
};

const STATUS_LABEL: Record<string, string> = {
  live: "🔴 กำลัง Live",
  draft: "Draft",
  scheduled: "📅 กำหนดการ",
  ended: "✅ เสร็จสิ้น",
};

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    analyticsApi.overview()
      .then(setOverview)
      .catch(() => {
        // Show demo data when backend not connected
        setOverview({
          total_campaigns: 8,
          live_campaigns: 2,
          total_sessions: 45,
          total_leads: 312,
          recent_campaigns: [
            { id: 1, name: "เช่ารถภูเก็ต - Summer", status: "live", product_name: "บริการเช่ารถ", created_at: new Date().toISOString() },
            { id: 2, name: "เครื่องสำอาง Glow Set", status: "scheduled", product_name: "Glow Kit ราคา 890฿", created_at: new Date().toISOString() },
            { id: 3, name: "คอร์สออนไลน์ Digital", status: "ended", product_name: "คอร์ส 2,990฿", created_at: new Date().toISOString() },
            { id: 4, name: "อาหารเสริม Fit & Slim", status: "draft", product_name: "Fit & Slim 30 เม็ด", created_at: new Date().toISOString() },
          ],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: "แคมเปญทั้งหมด", value: overview?.total_campaigns ?? "—", icon: "📋", color: "var(--brand-primary)" },
    { label: "กำลัง Live", value: overview?.live_campaigns ?? "—", icon: "🔴", color: "#ef4444" },
    { label: "Session ไลฟ์", value: overview?.total_sessions ?? "—", icon: "📡", color: "#f59e0b" },
    { label: "Leads ทั้งหมด", value: overview?.total_leads ?? "—", icon: "👥", color: "#22c55e" },
  ];

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 className="page-title">ภาพรวม</h1>
            <p className="page-subtitle">สรุปสถิติและกิจกรรมล่าสุดของ Agency คุณ</p>
          </div>
          <Link href="/dashboard/campaigns/new" id="dashboard-new-campaign" className="btn btn-primary">
            ➕ สร้างแคมเปญใหม่
          </Link>
        </div>
      </div>

      <div style={{ padding: "0 32px" }}>
        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
          {stats.map((s) => (
            <div key={s.label} className="stat-card animate-fade-up">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 28 }}>{s.icon}</span>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, marginTop: 6 }} />
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: 36, width: 80, marginBottom: 8 }} />
              ) : (
                <div className="stat-value">{s.value.toLocaleString()}</div>
              )}
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { icon: "🤖", title: "AI Script Generator", desc: "สร้าง script ขายของอัตโนมัติด้วย GPT-4o", href: "/dashboard/campaigns/new", color: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)" },
            { icon: "🎙️", title: "TTS Preview", desc: "ลองฟังเสียง AI จาก script ของคุณ", href: "/dashboard/campaigns", color: "rgba(236,72,153,0.1)", border: "rgba(236,72,153,0.2)" },
            { icon: "📡", title: "เริ่ม Live Stream", desc: "ยิงสดไป Facebook, TikTok, YouTube", href: "/dashboard/live", color: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
          ].map((action) => (
            <Link key={action.title} href={action.href} style={{
              display: "block", padding: 20, borderRadius: 14, textDecoration: "none",
              background: action.color, border: `1px solid ${action.border}`,
              transition: "all 0.2s ease"
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{action.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{action.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{action.desc}</div>
            </Link>
          ))}
        </div>

        {/* Recent Campaigns */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>แคมเปญล่าสุด</h3>
            <Link href="/dashboard/campaigns" className="btn btn-ghost btn-sm">ดูทั้งหมด →</Link>
          </div>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 14, width: "60%", marginBottom: 6 }} />
                    <div className="skeleton" style={{ height: 12, width: "40%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>ชื่อแคมเปญ</th>
                    <th>สินค้า</th>
                    <th>สถานะ</th>
                    <th>วันที่สร้าง</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {overview?.recent_campaigns.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{c.product_name || "—"}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[c.status] || "badge-draft"}`}>
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
                        {new Date(c.created_at).toLocaleDateString("th-TH")}
                      </td>
                      <td>
                        <Link href={`/dashboard/campaigns/${c.id}`} className="btn btn-ghost btn-sm">จัดการ</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
