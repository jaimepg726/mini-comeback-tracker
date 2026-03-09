import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const toISO = (date) => date.toISOString().split("T")[0];

const getWeekBounds = (offsetWeeks = 0) => {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toISO(monday), end: toISO(sunday) };
};

export default function WeeklyReport() {
  const { API } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [mode, setMode] = useState("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { start, end } = getWeekBounds(weekOffset);

  const load = (startDate, endDate) => {
    setLoading(true);
    axios.get(`${API}/dashboard/weekly-report`, {
      params: { start_date: startDate, end_date: endDate }
    })
      .then(r => setReport(r.data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (mode === "week") load(start, end);
  }, [weekOffset, mode, API]);

  const handleCustomLoad = () => {
    if (customStart && customEnd) load(customStart, customEnd);
  };

  const weekLabel = () => {
    if (weekOffset === 0) return "This Week";
    if (weekOffset === -1) return "Last Week";
    if (weekOffset < -1) return `${Math.abs(weekOffset)} Weeks Ago`;
    return `${weekOffset} Week(s) Ahead`;
  };

  const techEntries = report ? Object.entries(report.by_technician).sort((a, b) => b[1] - a[1]) : [];
  const catEntries = report ? Object.entries(report.by_category).sort((a, b) => b[1] - a[1]) : [];
  const displayStart = mode === "custom" ? customStart : start;
  const displayEnd = mode === "custom" ? customEnd : end;

  return (
    <>
      <div className="page-header">
        <div className="flex-between">
          <div>
            <div className="page-title">Weekly Report</div>
            <div className="page-subtitle">{fmtDate(displayStart)} → {fmtDate(displayEnd)}</div>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="card section-gap">
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button type="button" onClick={() => setMode("week")} style={{ padding: "8px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", border: mode === "week" ? "2px solid #C7001E" : "2px solid var(--border)", background: mode === "week" ? "rgba(199,0,30,0.15)" : "var(--gray-800)", color: mode === "week" ? "#fff" : "var(--text-muted)" }}>Weekly Nav</button>
            <button type="button" onClick={() => setMode("custom")} style={{ padding: "8px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", border: mode === "custom" ? "2px solid #C7001E" : "2px solid var(--border)", background: mode === "custom" ? "rgba(199,0,30,0.15)" : "var(--gray-800)", color: mode === "custom" ? "#fff" : "var(--text-muted)" }}>Custom Range</button>
          </div>

          {mode === "week" && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setWeekOffset(w => w - 1)} style={{ fontSize: 18, padding: "6px 16px" }}>‹</button>
              <div style={{ minWidth: 140, textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{weekLabel()}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{fmtDate(start)} – {fmtDate(end)}</div>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0} style={{ fontSize: 18, padding: "6px 16px", opacity: weekOffset >= 0 ? 0.3 : 1 }}>›</button>
              {weekOffset !== 0 && (
                <button type="button" className="btn btn-ghost" onClick={() => setWeekOffset(0)} style={{ fontSize: 12 }}>↩ This Week</button>
              )}
            </div>
          )}

          {mode === "custom" && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Start Date</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ width: 160 }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>End Date</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ width: 160 }} />
              </div>
              <button type="button" className="btn btn-primary" onClick={handleCustomLoad} disabled={!customStart || !customEnd} style={{ marginBottom: 2 }}>Load Report</button>
            </div>
          )}
        </div>

        {loading && <div className="loading-screen"><div className="spinner" /></div>}
        {!loading && !report && <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>No data found for this period.</div>}

        {!loading && report && (
          <>
            <div className="stat-grid section-gap">
              <div className="stat-card red"><div className="stat-value">{report.total_comebacks}</div><div className="stat-label">Comebacks</div></div>
              <div className="stat-card danger"><div className="stat-value">{report.repeat_vins_this_week?.length ?? 0}</div><div className="stat-label">Repeat VINs</div></div>
              <div className="stat-card warning"><div className="stat-value">{techEntries.filter(([, v]) => v > 0).length}</div><div className="stat-label">Techs with Comebacks</div></div>
              <div className="stat-card success"><div className="stat-value" style={{ fontSize: catEntries.length > 0 ? 16 : 28 }}>{catEntries.length > 0 ? catEntries[0][0] : "—"}</div><div className="stat-label">Top Cause</div></div>
            </div>
            <div className="two-col section-gap">
              <div className="card">
                <div className="card-title">By Technician</div>
                {techEntries.length === 0 ? <div className="text-muted text-sm">No comebacks this period.</div> : techEntries.map(([name, count]) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontWeight: 600 }}>{name}</span>
                    <span className={`badge ${count > 0 ? "badge-danger" : "badge-success"}`}>{count} {count === 1 ? "comeback" : "comebacks"}</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-title">By Category</div>
                {catEntries.length === 0 ? <div className="text-muted text-sm">No comebacks this period.</div> : catEntries.map(([cat, count]) => (
                  <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <span>{cat}</span><span className="badge badge-muted">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title">All Comebacks — {fmtDate(displayStart)} to {fmtDate(displayEnd)}</div>
              {report.comebacks.length === 0 ? <div className="text-muted text-sm">No comebacks this period.</div> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Date</th><th>Technician</th><th>RO #</th><th>Vehicle</th><th>Category</th><th>Concern</th><th>Flag</th></tr></thead>
                    <tbody>{report.comebacks.map(c => (
                      <tr key={c.id}>
                        <td>{fmtDate(c.comeback_date)}</td>
                        <td style={{ fontWeight: 600 }}>{c.technician_name}</td>
                        <td className="text-muted">{c.ro_number || "—"}</td>
                        <td>{c.vehicle || "—"}</td>
                        <td>{c.repair_category ? <span className="badge badge-muted">{c.repair_category}</span> : "—"}</td>
                        <td style={{ maxWidth: 200, fontSize: 12, color: "var(--text-muted)" }}>{c.comeback_concern || "—"}</td>
                        <td>{c.is_repeat_vin ? <span className="badge badge-danger">REPEAT VIN</span> : <span className="text-muted">—</span>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
