"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore, useUIStore } from "@/lib/store";

const navItems = [
  { href: "/dashboard", icon: "📊", label: "ภาพรวม", id: "nav-dashboard" },
  { href: "/dashboard/campaigns", icon: "📋", label: "แคมเปญ", id: "nav-campaigns" },
  { href: "/dashboard/live", icon: "🔴", label: "ห้อง Live", id: "nav-live" },
  { href: "/dashboard/analytics", icon: "📈", label: "Analytics", id: "nav-analytics" },
  { href: "/dashboard/leads", icon: "👥", label: "Leads", id: "nav-leads" },
  { href: "/dashboard/settings", icon: "⚙️", label: "ตั้งค่า", id: "nav-settings" },
  { href: "/dashboard/billing", icon: "💳", label: "Billing", id: "nav-billing" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, isLoading, loadFromStorage, logout } = useAuthStore();
  const { toasts, removeToast } = useUIStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && !token) {
      router.replace("/login");
    }
  }, [mounted, isLoading, token]);

  if (!mounted || isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-base)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎙️</div>
          <div style={{ width: 32, height: 32, border: "3px solid var(--brand-primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!token) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ padding: "20px 16px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "var(--gradient-brand)", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 18,
              boxShadow: "0 4px 12px rgba(99,102,241,0.35)", flexShrink: 0
            }}>🎙️</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "Plus Jakarta Sans, sans-serif" }}>AI Live</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Agency Platform</div>
            </div>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} id={item.id} className={`sidebar-item ${isActive ? "active" : ""}`}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.href === "/dashboard/live" && (
                    <span style={{ marginLeft: "auto" }}>
                      <span className="live-dot" style={{ display: "inline-block" }} />
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom user */}
        <div style={{ marginTop: "auto", padding: "16px", borderTop: "1px solid var(--border-subtle)" }}>
          <Link href="/dashboard/campaigns/new" id="sidebar-new-campaign" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: 14, fontSize: 13 }}>
            ➕ สร้างแคมเปญ
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--gradient-brand)", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0
            }}>
              {user?.full_name?.[0] || user?.email?.[0] || "U"}
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.full_name || user?.email}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{user?.role}</div>
            </div>
            <button onClick={logout} title="Logout" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16, padding: 4 }}>
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {children}
      </main>

      {/* Toasts */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 200, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} className="toast" style={{
            borderColor: t.type === "success" ? "rgba(34,197,94,0.3)" : t.type === "error" ? "rgba(239,68,68,0.3)" : "var(--border-default)"
          }}>
            <span>{t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button onClick={() => removeToast(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
