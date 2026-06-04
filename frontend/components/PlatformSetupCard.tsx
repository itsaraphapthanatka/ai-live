"use client";
import { useState, useEffect, useCallback } from "react";
import { platformConfigApi } from "@/lib/api";

interface Field {
  key: string;
  label: string;
  type: "text" | "password";
  help: string;
  configured: boolean;
  masked_value: string;
}

interface Props {
  platform: string;
  icon: string;
  title: string;
  color: string;
  description: string;
  onSaved?: () => void;
  children?: React.ReactNode; // OAuth connect button slot
}

export default function PlatformSetupCard({ platform, icon, title, color, description, onSaved, children }: Props) {
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [hasEnv, setHasEnv] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const loadConfig = useCallback(() => {
    platformConfigApi.get(platform)
      .then((data) => {
        setFields(data.fields || []);
        setConfigured(data.configured || false);
        setHasEnv(data.has_env || false);
        const init: Record<string, string> = {};
        (data.fields || []).forEach((f: Field) => { init[f.key] = ""; });
        setValues(init);
      })
      .catch(() => {});
  }, [platform]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function handleImportEnv() {
    setImporting(true);
    try {
      await platformConfigApi.importEnv(platform);
      loadConfig();
      onSaved?.();
    } catch {
      /* ignore */
    } finally {
      setImporting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await platformConfigApi.save(platform, values);
      setSaved(true);
      setConfigured(true);
      setOpen(false);
      onSaved?.();
      setTimeout(() => setSaved(false), 3000);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!confirm(`ลบ credentials ของ ${title} ออก?`)) return;
    await platformConfigApi.delete(platform);
    setConfigured(false);
    const init: Record<string, string> = {};
    fields.forEach((f) => { init[f.key] = ""; });
    setValues(init);
    onSaved?.();
  }

  return (
    <div style={{
      borderRadius: 14, border: `1px solid ${configured ? `${color}33` : "var(--border-subtle)"}`,
      background: configured ? `${color}06` : "var(--bg-surface)",
      overflow: "hidden", transition: "all 0.2s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px" }}>
        <span style={{ fontSize: 26 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {configured
              ? <span style={{ color: "#22c55e" }}>✅ ตั้งค่าแล้ว</span>
              : description}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {configured && (
            <button onClick={handleClear} style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer",
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444",
            }}>ลบ</button>
          )}
          <button onClick={() => setOpen((v) => !v)} style={{
            padding: "5px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 600,
            background: open ? "var(--bg-elevated)" : `${color}22`,
            border: `1px solid ${color}44`, color: color,
          }}>
            {open ? "ปิด" : configured ? "✏️ แก้ไข" : "⚙️ ตั้งค่า"}
          </button>
        </div>
      </div>

      {/* .env banner — พบค่าแต่ยังไม่ได้ import */}
      {!configured && hasEnv && !open && (
        <div style={{
          margin: "0 18px 14px",
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <span style={{ fontSize: 12, color: "#f59e0b" }}>
            ⚡ พบค่าใน <code style={{ background: "rgba(0,0,0,0.2)", padding: "1px 5px", borderRadius: 4 }}>.env</code> — กด Import เพื่อใช้งานทันที
          </span>
          <button onClick={handleImportEnv} disabled={importing}
            style={{
              padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: "#f59e0b", border: "none", color: "white",
              cursor: importing ? "not-allowed" : "pointer", whiteSpace: "nowrap",
            }}>
            {importing ? "⏳" : "📥 Import"}
          </button>
        </div>
      )}

      {/* Expand form */}
      {open && (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {fields.map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>
                  {f.label}
                  {f.configured && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#22c55e" }}>✅ ตั้งค่าแล้ว</span>
                  )}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={f.type === "password" && !showValues[f.key] ? "password" : "text"}
                    className="input"
                    placeholder={f.configured ? "ปล่อยว่างเพื่อ keep ค่าเดิม" : `ใส่ ${f.label}`}
                    value={values[f.key] || ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ paddingRight: f.type === "password" ? 40 : undefined }}
                  />
                  {f.type === "password" && (
                    <button
                      type="button"
                      onClick={() => setShowValues((prev) => ({ ...prev, [f.key]: !prev[f.key] }))}
                      style={{
                        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-muted)",
                      }}>
                      {showValues[f.key] ? "🙈" : "👁️"}
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>💡 {f.help}</p>
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
                {saving ? "⏳ กำลังบันทึก..." : saved ? "✅ บันทึกแล้ว" : "💾 บันทึก"}
              </button>
              {/* OAuth connect slot */}
              {configured && children && (
                <div>{children}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OAuth slot (when configured + not editing) */}
      {!open && configured && children && (
        <div style={{ padding: "0 18px 14px" }}>
          {children}
        </div>
      )}
    </div>
  );
}
