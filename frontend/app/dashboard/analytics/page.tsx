"use client";
import { useEffect, useState } from "react";
import { analyticsApi } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

const DEMO_LEADS_DATA = [
  { day: "จ", leads: 12, comments: 45 }, { day: "อ", leads: 19, comments: 72 },
  { day: "พ", leads: 8, comments: 31 }, { day: "พฤ", leads: 24, comments: 89 },
  { day: "ศ", leads: 31, comments: 120 }, { day: "ส", leads: 42, comments: 156 },
  { day: "อา", leads: 38, comments: 134 },
];

const DEMO_REVENUE_DATA = [
  { month: "ม.ค.", revenue: 9900 }, { month: "ก.พ.", revenue: 19900 },
  { month: "มี.ค.", revenue: 29800 }, { month: "เม.ย.", revenue: 39900 },
];

const DEMO_TOP_CAMPAIGNS = [
  { name: "เช่ารถภูเก็ต", leads: 89, conversion: 32 },
  { name: "Glow Kit เซตสกิน", leads: 67, conversion: 28 },
  { name: "คอร์ส Digital", leads: 54, conversion: 25 },
  { name: "Fit & Slim", leads: 43, conversion: 19 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value.toLocaleString()}</p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.overview()
      .then(setOverview)
      .catch(() => setOverview({
        total_campaigns: 8, live_campaigns: 2, total_sessions: 45, total_leads: 312
      }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: "0 0 40px" }}>
      <div className="page-header">
        <h1 className="page-title">📈 สถิติ</h1>
        <p className="page-subtitle">ภาพรวมสถิติลูกค้าเป้าหมาย, ความคิดเห็น และรายได้ของ Agency</p>
      </div>

      <div style={{ padding: "0 32px" }}>
        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "ลูกค้าเป้าหมายทั้งหมด", value: "312", change: "+18%", icon: "🎯", positive: true },
            { label: "ครั้งที่ไลฟ์", value: "45", change: "+24%", icon: "📡", positive: true },
            { label: "อัตราการซื้อ", value: "28%", change: "+3%", icon: "📊", positive: true },
            { label: "ชม. Live", value: "186h", change: "+12%", icon: "⏱️", positive: true },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>{s.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: s.positive ? "#22c55e" : "#ef4444", background: s.positive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 100 }}>
                  {s.change}
                </span>
              </div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Leads & Comments over week */}
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>📊 ลูกค้าเป้าหมาย & ความคิดเห็น รายสัปดาห์</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={DEMO_LEADS_DATA} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="leads" name="ลูกค้าเป้าหมาย" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="comments" name="คอมเมนต์" fill="rgba(99,102,241,0.3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue trend */}
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>💰 รายได้รายเดือน (฿)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={DEMO_REVENUE_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="revenue" name="รายได้ (฿)" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top campaigns */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>🏆 แคมเปญที่ได้ผลดีสุด</h3>
          </div>
          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>แคมเปญ</th>
                  <th>ลูกค้าเป้าหมาย</th>
                  <th>Conversion</th>
                  <th>ความคืบหน้า</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_TOP_CAMPAIGNS.map((c, i) => (
                  <tr key={c.name}>
                    <td style={{ color: "var(--text-muted)", fontWeight: 700 }}>#{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: "var(--brand-primary-light)" }}>{c.leads}</span>
                    </td>
                    <td style={{ color: "#22c55e", fontWeight: 600 }}>{c.conversion}%</td>
                    <td style={{ width: 160 }}>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${c.conversion * 3}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
