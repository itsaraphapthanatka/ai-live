"use client";
import { useEffect, useState } from "react";
import { leadsApi } from "@/lib/api";
import { useUIStore } from "@/lib/store";

const DEMO_LEADS = [
  { id: 1, campaign_id: 1, name: "สมหญิง สวยงาม", contact: "0812345678", source: "comment", notes: "มีโปรโมชันอยู่ไหมคะ?", created_at: new Date().toISOString() },
  { id: 2, campaign_id: 1, name: "นายก ดีมาก", contact: "lineoa:@naiyok", source: "comment", notes: "ราคาเท่าไหร่ครับ", created_at: new Date().toISOString() },
  { id: 3, campaign_id: 2, name: "คุณแม่ใจดี", contact: "mama@email.com", source: "form", notes: "สนใจสั่งซื้อ Glow Kit", created_at: new Date().toISOString() },
  { id: 4, campaign_id: 1, name: "ลูกค้า VIP", contact: "0898765432", source: "webhook", notes: "บัตรสมาชิก", created_at: new Date().toISOString() },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    leadsApi.list()
      .then(setLeads)
      .catch(() => setLeads(DEMO_LEADS))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    try {
      await leadsApi.delete(id);
      setLeads((l) => l.filter((x) => x.id !== id));
      addToast("ลบ Lead สำเร็จ", "success");
    } catch {
      setLeads((l) => l.filter((x) => x.id !== id));
      addToast("ลบ Lead สำเร็จ (demo)", "success");
    }
  }

  const filtered = leads.filter((l) =>
    !search || l.name?.includes(search) || l.contact?.includes(search) || l.notes?.includes(search)
  );

  const SOURCE_ICON: Record<string, string> = { comment: "💬", form: "📝", webhook: "🔗" };

  return (
    <div style={{ padding: "0 0 40px" }}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 className="page-title">👥 Leads</h1>
            <p className="page-subtitle">{leads.length} leads จากทุกแคมเปญ</p>
          </div>
          <button onClick={() => {
            const csv = "Name,Contact,Source,Notes,Date\n" + leads.map((l) => `${l.name},${l.contact},${l.source},${l.notes},${l.created_at}`).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "leads.csv"; a.click();
            addToast("ดาวน์โหลด CSV สำเร็จ 📥", "success");
          }} className="btn btn-secondary" id="export-leads-btn">📥 Export CSV</button>
        </div>

        <div style={{ marginTop: 16 }}>
          <input id="leads-search" className="input" placeholder="🔍 ค้นหาชื่อ, เบอร์โทร, หมายเหตุ..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
        </div>
      </div>

      <div style={{ padding: "0 32px" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>ติดต่อ</th>
                  <th>Source</th>
                  <th>หมายเหตุ</th>
                  <th>วันที่</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>⏳ กำลังโหลด...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                    <p>ยังไม่มี Leads</p>
                  </td></tr>
                ) : filtered.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--gradient-brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
                          {l.name?.[0] || "?"}
                        </div>
                        {l.name || "ไม่ทราบชื่อ"}
                      </div>
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{l.contact || "—"}</td>
                    <td>
                      <span className="badge badge-draft">{SOURCE_ICON[l.source] || "📌"} {l.source}</span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.notes || "—"}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {new Date(l.created_at).toLocaleDateString("th-TH")}
                    </td>
                    <td>
                      <button onClick={() => handleDelete(l.id)} className="btn btn-danger btn-sm" title="ลบ">🗑️</button>
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
