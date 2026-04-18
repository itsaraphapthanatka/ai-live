"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { campaignApi } from "@/lib/api";
import { useUIStore } from "@/lib/store";

const STATUS_BADGE: Record<string, string> = { live: "badge-live", draft: "badge-draft", scheduled: "badge-scheduled", ended: "badge-ended" };
const STATUS_LABEL: Record<string, string> = { live: "🔴 Live", draft: "✏️ Draft", scheduled: "📅 กำหนดการ", ended: "✅ เสร็จ" };

const DEMO_CAMPAIGNS = [
  { id: 1, name: "เช่ารถภูเก็ต - Summer 2026", product_name: "บริการเช่ารถ", product_price: "800฿/วัน", language: "th", tone: "friendly", status: "live", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, name: "Glow Kit เซตสกิน", product_name: "Glow Kit", product_price: "890฿", language: "th", tone: "luxury", status: "scheduled", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, name: "คอร์ส Digital Marketing", product_name: "คอร์สออนไลน์", product_price: "2,990฿", language: "th", tone: "energetic", status: "ended", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 4, name: "Fit & Slim อาหารเสริม", product_name: "Fit & Slim", product_price: "690฿", language: "th", tone: "friendly", status: "draft", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    campaignApi.list()
      .then(setCampaigns)
      .catch(() => setCampaigns(DEMO_CAMPAIGNS))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("ลบแคมเปญนี้?")) return;
    setDeleting(id);
    try {
      await campaignApi.delete(id);
      setCampaigns((c) => c.filter((x) => x.id !== id));
      addToast("ลบแคมเปญสำเร็จ", "success");
    } catch {
      addToast("ไม่สามารถลบได้", "error");
    } finally {
      setDeleting(null);
    }
  }

  const filtered = filter === "all" ? campaigns : campaigns.filter((c) => c.status === filter);

  const TONE_ICONS: Record<string, string> = { friendly: "😊", luxury: "💎", energetic: "⚡", professional: "👔" };
  const LANG_FLAGS: Record<string, string> = { th: "🇹🇭", en: "🇺🇸", zh: "🇨🇳" };

  return (
    <div style={{ padding: "0 0 40px" }}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 className="page-title">แคมเปญทั้งหมด</h1>
            <p className="page-subtitle">{campaigns.length} แคมเปญ · จัดการเนื้อหา script และกำหนดการ Live</p>
          </div>
          <Link href="/dashboard/campaigns/new" id="campaigns-new-btn" className="btn btn-primary">➕ สร้างแคมเปญ</Link>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
          {[
            { key: "all", label: `ทั้งหมด (${campaigns.length})` },
            { key: "live", label: "🔴 Live" },
            { key: "scheduled", label: "📅 กำหนดการ" },
            { key: "draft", label: "✏️ Draft" },
            { key: "ended", label: "✅ เสร็จสิ้น" },
          ].map((f) => (
            <button key={f.key} id={`filter-${f.key}`} onClick={() => setFilter(f.key)}
              style={{
                padding: "6px 14px", borderRadius: 100, fontSize: 13, fontWeight: 500, cursor: "pointer",
                background: filter === f.key ? "var(--brand-primary)" : "var(--bg-card)",
                color: filter === f.key ? "white" : "var(--text-secondary)",
                border: `1px solid ${filter === f.key ? "transparent" : "var(--border-subtle)"}`,
                transition: "all 0.15s ease"
              }}
            >{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 32px" }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
            {[1, 2, 3].map((i) => <div key={i} className="skeleton card" style={{ height: 180 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <p style={{ fontSize: 16 }}>ยังไม่มีแคมเปญ</p>
            <Link href="/dashboard/campaigns/new" className="btn btn-primary" style={{ marginTop: 16, display: "inline-flex" }}>สร้างแคมเปญแรก</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
            {filtered.map((c) => (
              <div key={c.id} className="card animate-fade-up" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {/* Card header */}
                <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-subtle)", background: "var(--gradient-card)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <h3 style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{c.name}</h3>
                    <span className={`badge ${STATUS_BADGE[c.status] || "badge-draft"}`} style={{ flexShrink: 0 }}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </div>
                </div>

                <div style={{ padding: "14px 20px", flex: 1 }}>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                    {c.product_name || "ไม่ระบุสินค้า"}
                    {c.product_price && <span style={{ marginLeft: 6, color: "var(--brand-secondary)", fontWeight: 600 }}>· {c.product_price}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                    <span title="ภาษา" style={{ fontSize: 13, color: "var(--text-muted)" }}>{LANG_FLAGS[c.language] || "🌐"} {c.language?.toUpperCase()}</span>
                    <span style={{ color: "var(--border-subtle)" }}>·</span>
                    <span title="น้ำเสียง" style={{ fontSize: 13, color: "var(--text-muted)" }}>{TONE_ICONS[c.tone] || "🎙️"} {c.tone}</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                    สร้างเมื่อ {new Date(c.created_at).toLocaleDateString("th-TH")}
                  </div>
                </div>

                <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
                  <Link href={`/dashboard/campaigns/${c.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>✏️ จัดการ</Link>
                  <Link href={`/dashboard/live?campaign=${c.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>🔴 Go Live</Link>
                  <button onClick={() => handleDelete(c.id)} className="btn btn-danger btn-sm" disabled={deleting === c.id} title="ลบ">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
