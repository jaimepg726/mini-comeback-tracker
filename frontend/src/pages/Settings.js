import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import ManageTechs from "./ManageTechs";
import { apiGet, apiPost, apiPut, apiDelete } from "../utils/apiClient";

const TABS = [
  { id: "technicians", label: "Technicians" },
  { id: "dealer",      label: "Dealer Settings" },
  { id: "demo",        label: "Demo Mode" },
  { id: "data",        label: "Data & Export" },
];

function TabBtn({ id, active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      style={{
        padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600,
        cursor: "pointer", transition: "all 0.15s",
        border: active ? "2px solid #C7001E" : "2px solid var(--border)",
        background: active ? "rgba(199,0,30,0.15)" : "var(--gray-800)",
        color: active ? "#fff" : "var(--text-muted)",
      }}
    >
      {label}
    </button>
  );
}

// ─── Dealer Settings tab ────────────────────────────────────────────────────

const SETTING_META = {
  repeat_vin_window_days: {
    label: "Repeat VIN Window (days)",
    hint: "How many days back to look when flagging a repeat VIN. Set to 0 for all-time.",
    type: "number",
    min: 0,
    max: 365,
  },
  dashboard_week_start: {
    label: "Week Starts On",
    hint: "Which day the week begins on for dashboard statistics.",
    type: "select",
    options: ["Monday", "Sunday"],
  },
};

function DealerSettingsTab() {
  const { API } = useAuth();
  const [settings, setSettings] = useState({});
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`)
      .then(r => {
        setSettings(r.data);
        setDraft(r.data);
      })
      .catch(() => setSettings({}))
      .finally(() => setLoading(false));
  }, [API]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(draft).map(([key, value]) =>
          axios.put(`${API}/settings/${key}`, { value: String(value) })
        )
      );
      setSettings({ ...draft });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const changed = Object.keys(draft).some(k => String(draft[k]) !== String(settings[k]));

  if (loading) return <div className="loading-screen" style={{ minHeight: 120 }}><div className="spinner" /></div>;

  return (
    <div>
      {saved && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#166534", color: "#fff", padding: "12px 24px", borderRadius: 8, fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
          ✓ Settings saved
        </div>
      )}
      <div className="card section-gap">
        <div className="card-title">Dealer Preferences</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {Object.entries(SETTING_META).map(([key, meta]) => (
            <div key={key} className="form-group" style={{ margin: 0 }}>
              <label>{meta.label}</label>
              {meta.type === "select" ? (
                <select
                  value={draft[key] ?? meta.options[0]}
                  onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                >
                  {meta.options.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type="number"
                  min={meta.min}
                  max={meta.max}
                  value={draft[key] ?? ""}
                  onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                  style={{ width: "100%" }}
                />
              )}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{meta.hint}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !changed}
            style={{ minWidth: 140 }}
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {changed && (
            <span style={{ fontSize: 12, color: "#f4a261" }}>Unsaved changes</span>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">About These Settings</div>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
            <strong style={{ color: "var(--text)" }}>Repeat VIN Window</strong> — controls how far back the system looks when determining if a VIN is a repeat. <code style={{ background: "var(--gray-800)", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>0</code> = all-time (original behavior). <code style={{ background: "var(--gray-800)", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>30</code> = only flag repeats within the last 30 days.
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", paddingTop: 4 }}>
            <strong style={{ color: "var(--text)" }}>Week Starts On</strong> — affects which day is counted as the start of the week in dashboard stats and weekly report navigation.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Data & Export tab ───────────────────────────────────────────────────────

function DataTab() {
  const { API } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/comebacks/export-csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comebacks_all_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="card section-gap">
      <div className="card-title">Data & Export</div>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Export All Comebacks (CSV)</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Download a CSV of all comeback records across all technicians and dates.</div>
          </div>
          <button
            onClick={handleExportAll}
            disabled={exporting}
            style={{
              padding: "9px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: "pointer", border: "1px solid rgba(199,0,30,0.4)",
              background: exported ? "#166534" : "rgba(199,0,30,0.12)",
              color: exported ? "#fff" : "#f87171", transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {exporting ? "Exporting…" : exported ? "✓ Downloaded" : "⬇ Export All CSV"}
          </button>
        </div>
        <div style={{ padding: "8px 0" }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Filtered Exports</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            For filtered exports (by technician, category, or date range), use the <strong style={{ color: "var(--text)" }}>⬇ Export CSV</strong> button on the All Comebacks page.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Demo Mode tab ───────────────────────────────────────────────────────────

function DemoModeTab() {
  const { demoMode, refreshDemoMode } = useAuth();
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [msg, setMsg] = useState(null);

  const flash = (text, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const loadStats = () => {
    setLoadingStats(true);
    setStatsError(null);
    apiGet("/demo/stats")
      .then(data => setStats(data))
      .catch(e => {
        setStats(null);
        const isNotFound = e.status === 404;
        setStatsError(
          isNotFound
            ? "Demo endpoint unreachable. Check API base URL / route prefix."
            : e.message || "Stats unavailable"
        );
        console.error("[demo/stats]", e.status, e.message);
      })
      .finally(() => setLoadingStats(false));
  };

  useEffect(() => { loadStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const data = await apiPost("/demo/seed");
      flash(`✓ ${data.seeded} demo records created`);
      loadStats();
    } catch (e) {
      const isNotFound = e.status === 404;
      flash(
        isNotFound
          ? "Demo endpoint unreachable. Check API base URL / route prefix."
          : e.message || "Seed failed",
        false
      );
    } finally { setSeeding(false); }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const data = await apiDelete("/demo/clear");
      flash(`✓ ${data.cleared} demo records removed`);
      loadStats();
    } catch (e) {
      const isNotFound = e.status === 404;
      flash(
        isNotFound
          ? "Demo endpoint unreachable. Check API base URL / route prefix."
          : e.message || "Clear failed",
        false
      );
    } finally { setClearing(false); }
  };

  const handleToggle = async () => {
    setToggling(true);
    const newVal = demoMode ? "false" : "true";
    try {
      await apiPut("/settings/demo_mode_enabled", { value: newVal });
      await refreshDemoMode();
      flash(`Demo mode ${newVal === "true" ? "enabled" : "disabled"}`);
    } catch (e) {
      flash(e.message || "Toggle failed", false);
    } finally { setToggling(false); }
  };

  const btnStyle = (color, disabled) => ({
    padding: "9px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    border: `1px solid ${color}55`, background: `${color}18`, color,
    transition: "all 0.2s", whiteSpace: "nowrap",
  });

  return (
    <div>
      {msg && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          background: msg.ok ? "#166534" : "#7f1d1d", color: "#fff",
          padding: "12px 24px", borderRadius: 8, fontWeight: 600, fontSize: 14,
          zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", whiteSpace: "nowrap",
        }}>{msg.text}</div>
      )}

      <div className="card section-gap">
        <div className="card-title">Demo Mode</div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, padding: "16px 20px", borderRadius: 8, background: demoMode ? "rgba(146,64,14,0.2)" : "var(--gray-800)", border: demoMode ? "1px solid #b45309" : "1px solid var(--border)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: demoMode ? "#fbbf24" : "var(--text)" }}>
              Demo Mode is <strong>{demoMode ? "ON" : "OFF"}</strong>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              When enabled, only seeded demo records are shown. Real comebacks are hidden. New records cannot be submitted.
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            style={{
              ...btnStyle(demoMode ? "#fbbf24" : "#16a34a", toggling),
              minWidth: 120,
            }}
          >
            {toggling ? "Updating…" : demoMode ? "Disable Demo" : "Enable Demo"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <button onClick={handleSeed} disabled={seeding} style={btnStyle("#60a5fa", seeding)}>
            {seeding ? "Seeding…" : "⚡ Seed Demo Data"}
          </button>
          <button onClick={handleClear} disabled={clearing} style={btnStyle("#f87171", clearing)}>
            {clearing ? "Clearing…" : "✕ Clear Demo Data"}
          </button>
        </div>

        {loadingStats ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading stats…</div>
        ) : statsError ? (
          <div style={{ fontSize: 13, color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 8, padding: "10px 14px" }}>
            {statsError}
          </div>
        ) : stats ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {[
              { label: "Demo Records", value: stats.total_demo },
              { label: "Real Records", value: stats.total_real },
              { label: "Technicians", value: stats.demo_technicians },
              { label: "Categories", value: stats.demo_categories },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--gray-800)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#e5e7eb" }}>{s.value ?? "—"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Stats unavailable.</div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">How Demo Mode Works</div>
        <div style={{ display: "grid", gap: 10, fontSize: 13, color: "var(--text-muted)" }}>
          <div><strong style={{ color: "var(--text)" }}>Seed Demo Data</strong> — creates 35 realistic comeback records using sample technicians, VINs, and categories. Safe to run multiple times (clears first).</div>
          <div><strong style={{ color: "var(--text)" }}>Enable Demo</strong> — switches all read views to show only demo records. Real data is hidden but never deleted.</div>
          <div><strong style={{ color: "var(--text)" }}>Disable Demo</strong> — immediately restores real data. Demo records remain until you clear them.</div>
          <div><strong style={{ color: "var(--text)" }}>Clear Demo Data</strong> — permanently removes all demo records. Real records are never affected.</div>
        </div>
      </div>
    </div>
  );
}

// ─── Settings page ───────────────────────────────────────────────────────────

export default function Settings() {
  const [tab, setTab] = useState("technicians");

  return (
    <>
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-subtitle">Manage technicians, dealer preferences, and data</div>
      </div>

      <div className="page-body">
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <TabBtn key={t.id} id={t.id} label={t.label} active={tab === t.id} onClick={setTab} />
          ))}
        </div>

        {tab === "technicians" && <ManageTechs asTab />}
        {tab === "dealer"      && <DealerSettingsTab />}
        {tab === "demo"        && <DemoModeTab />}
        {tab === "data"        && <DataTab />}
      </div>
    </>
  );
}
