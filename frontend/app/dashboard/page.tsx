"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { analyticsApi, tiktokApi } from "@/lib/api";

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
  draft: "แบบร่าง",
  scheduled: "📅 กำหนดการ",
  ended: "✅ เสร็จสิ้น",
};

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  useEffect(() => {
    // โหลด overview stats
    analyticsApi.overview()
      .then(setOverview)
      .catch(() => {
        setOverview({
          total_campaigns: 0,
          live_campaigns: 0,
          total_sessions: 0,
          total_leads: 0,
          recent_campaigns: [],
        });
      })
      .finally(() => setLoading(false));

        // โหลด active TikTok sessions (live จริงๆ ตอนนี้)
    tiktokApi.active()
      .then((data) => setActiveSessions(Array.isArray(data) ? data : []))
      .catch(() => setActiveSessions([]));
  }, []);

  // จำนวน live จริง = active sessions
  const liveNow = activeSessions.length;

  const stats = [
    { label: "แคมเปญทั้งหมด", value: overview?.total_campaigns ?? "—", icon: "📋", color: "var(--brand-primary)" },
    { label: "กำลัง Live ตอนนี้", value: liveNow, icon: "🔴", color: "#ef4444", highlight: liveNow > 0 },
    { label: "ครั้งที่ไลฟ์ทั้งหมด", value: overview?.total_sessions ?? "—", icon: "📡", color: "#f59e0b" },
    { label: "ลูกค้าเป้าหมายทั้งหมด", value: overview?.total_leads ?? "—", icon: "👥", color: "#22c55e" },
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
          <Link href="/dashboard/campaigns/new" className="btn btn-primary">
            ➕ สร้างแคมเปญใหม่
          </Link>
        </div>
      </div>

      <div style={{ padding: "0 32px" }}>

        {/* ── Active Live Banner ─────────────────────────────────── */}
        {activeSessions.length > 0 && (
          <div style={{
            marginBottom: 20, padding: "16px 20px",
            background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Pulsing red dot */}
              <span style={{ position: "relative", display: "inline-flex" }}>
                <span style={{
                  width: 12, height: 12, borderRadius: "50%", background: "#ef4444",
                  boxShadow: "0 0 0 0 rgba(239,68,68,0.7)",
                  animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                  display: "block",
                }} />
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  🔴 กำลัง Live อยู่ {activeSessions.length} ครั้ง
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                  {activeSessions.map((s) => `@${s.unique_id}`).join(", ")}
                  {" · "}
                  {activeSessions.reduce((sum, s) => sum + (s.viewers || 0), 0).toLocaleString()} ผู้ชม
                  {" · "}
                  {activeSessions.reduce((sum, s) => sum + (s.comments || 0), 0).toLocaleString()} ความคิดเห็น
                </div>
              </div>
            </div>
            <Link href="/dashboard/live" className="btn btn-primary" style={{
              background: "#ef4444", border: "none", whiteSpace: "nowrap",
            }}>
              🔴 กลับไปหน้า Live →
            </Link>
          </div>
        )}

        {/* ── Stats grid ────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
          {stats.map((s) => (
            <div key={s.label} className="stat-card animate-fade-up" style={{
              border: s.highlight ? "1px solid rgba(239,68,68,0.3)" : undefined,
              background: s.highlight ? "rgba(239,68,68,0.05)" : undefined,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 28 }}>{s.icon}</span>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, marginTop: 6 }} />
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: 36, width: 80, marginBottom: 8 }} />
              ) : (
                <div className="stat-value" style={{ color: s.highlight ? "#ef4444" : undefined }}>
                  {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
                </div>
              )}
              <div className="stat-label">{s.label}</div>
              {s.highlight && s.value > 0 && (
                <Link href="/dashboard/live" style={{ fontSize: 11, color: "#ef4444", marginTop: 4, display: "block" }}>
                  → ไปหน้า Live
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* ── Quick actions ──────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { icon: "🤖", title: "สร้าง Script AI", desc: "สร้าง script ขายของอัตโนมัติด้วย GPT-4o", href: "/dashboard/campaigns/new", color: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)" },
            { icon: "🎙️", title: "ทดลองเสียง AI", desc: "ลองฟังเสียง AI จาก script ของคุณ", href: "/dashboard/campaigns", color: "rgba(236,72,153,0.1)", border: "rgba(236,72,153,0.2)" },
            { icon: "📡", title: "เริ่มไลฟ์สด", desc: "ยิงสดไป Facebook, TikTok, YouTube", href: "/dashboard/live", color: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
          ].map((action) => (
            <Link key={action.title} href={action.href} style={{
              display: "block", padding: 20, borderRadius: 14, textDecoration: "none",
              background: action.color, border: `1px solid ${action.border}`,
              transition: "all 0.2s ease",
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

        {/* ── Recent Campaigns ──────────────────────────────────── */}
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
          ) : overview?.recent_campaigns?.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ marginBottom: 16 }}>ยังไม่มีแคมเปญ</div>
              <Link href="/dashboard/campaigns/new" className="btn btn-primary btn-sm">สร้างแคมเปญแรก</Link>
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
                  {overview?.recent_campaigns?.map((c) => (
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
                      <td style={{ display: "flex", gap: 6 }}>
                        <Link href={`/dashboard/campaigns/${c.id}`} className="btn btn-ghost btn-sm">จัดการ</Link>
                        {c.status === "live" && (
                          <Link href="/dashboard/live" className="btn btn-sm" style={{
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                            color: "#ef4444", fontSize: 12,
                          }}>🔴 Live</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
