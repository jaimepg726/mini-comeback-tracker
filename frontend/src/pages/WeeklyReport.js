import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function WeeklyReport() {
  const { API } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/dashboard/weekly-report`)
      .then(r => setReport(r.data))
      .finally(() => setLoading(false));
  }, [API]);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!report) return null;

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const techEntries = Object.entries(report.by_technician).sort((a, b) => b[1] - a[1]);
  const catEntries = Object.entries(report.by_category).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="page-header">
        <div className="flex-between">
          <div>
            <div className="page-title">Weekly Report</div>
            <div className="page-subtitle">{fmtDate(report.week_start)} → {fmtDate(report.week_end)}</div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="stat-grid section-gap">
          <div className="stat-card red">
            <div className="stat-value">{report.total_comebacks}</div>
            <div className="stat-label">Comebacks This Week</div>
          </div>
          <div className="stat-card danger">
            <div className="stat-value">{report.repeat_vins_this_week.length}</div>
            <div className="stat-label">Repeat VINs This Week</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{techEntries.filter(([, v]) => v > 0).length}</div>
            <div className="stat-label">Technicians with Comebacks</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value" style={{ fontSize: 18 }}>
              {catEntries.length > 0 ? catEntries[0][0] : "—"}
            </div>
            <div className="stat-label">Top Cause</div>
          </div>
        </div>

        <div className="two-col section-gap">
          <div className="card">
            <div className="card-title">Comebacks by Technician</div>
            {techEntries.length === 0 ? (
              <div className="text-muted text-sm">No comebacks this week.</div>
            ) : (
              techEntries.map(([name, count]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontWeight: 600 }}>{name}</span>
                  <span className={`badge ${count > 0 ? "badge-danger" : "badge-success"}`}>
                    {count} {count === 1 ? "comeback" : "comebacks"}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div className="card-title">Comebacks by Category</div>
            {catEntries.length === 0 ? (
              <div className="text-muted text-sm">No comebacks this week.</div>
            ) : (
              catEntries.map(([cat, count]) => (
                <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{cat}</span>
                  <span className="badge badge-muted">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">All Comebacks This Week</div>
          {report.comebacks.length === 0 ? (
            <div className="text-muted text-sm">No comebacks this week.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Technician</th>
                    <th>RO #</th>
                    <th>Vehicle</th>
                    <th>Category</th>
                    <th>Concern</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {report.comebacks.map(c => (
                    <tr key={c.id}>
                      <td>{fmtDate(c.comeback_date)}</td>
                      <td style={{ fontWeight: 600 }}>{c.technician_name}</td>
                      <td className="text-muted">{c.ro_number || "—"}</td>
                      <td>{c.vehicle || "—"}</td>
                      <td>
                        {c.repair_category
                          ? <span className="badge badge-muted">{c.repair_category}</span>
                          : "—"}
                      </td>
                      <td style={{ maxWidth: 200, fontSize: 12, color: "var(--text-muted)" }}>{c.comeback_concern || "—"}</td>
                      <td>
                        {c.is_repeat_vin
                          ? <span className="badge badge-danger">REPEAT VIN</span>
                          : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
