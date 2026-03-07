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

  const techEntries = Object.entries(report.by_technician).sort((a, b) => b[1] - a[1]);
  const catEntries = Object.entries(report.by_category).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="page-header">
        <div className="flex-between">
          <div>
            <div className="page-title">Weekly Report</div>
            <div className="page-subtitle">{report.week_start} → {report.week_end}</div>
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
            <div className="stat-value">{techEntries.length}</div>
            <div className="stat-label">Technicians With Comebacks</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{catEntries[0]?.[0] ?? "—"}</div>
            <div className="stat-label">Top Cause</div>
          </div>
        </div>

        <div className="two-col section-gap">
          <div className="card">
            <div className="card-title">Comebacks by Technician</div>
            {techEntries.length === 0
              ? <div className="text-muted text-sm">No comebacks this week.</div>
              : techEntries.map(([tech, count]) => (
                <div key={tech} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontWeight: 600 }}>{tech}</span>
                  <span className={`badge ${count >= 3 ? "badge-danger" : count >= 1 ? "badge-warning" : "badge-success"}`}>
                    {count} comeback{count !== 1 ? "s" : ""}
                  </span>
                </div>
              ))
            }
          </div>

          <div className="card">
            <div className="card-title">Comebacks by Category</div>
            {catEntries.length === 0
              ? <div className="text-muted text-sm">No data this week.</div>
              : catEntries.map(([cat, count]) => (
                <div key={cat} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13 }}>{cat}</span>
                  <span className="badge badge-muted">{count}</span>
                </div>
              ))
            }
          </div>
        </div>

        {report.repeat_vins_this_week.length > 0 && (
          <div className="card section-gap" style={{ borderColor: "var(--danger)" }}>
            <div className="card-title text-danger">⚠ Repeat VINs This Week</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {report.repeat_vins_this_week.map(vin => (
                <span key={vin} className="badge badge-danger" style={{ fontSize: 13, padding: "6px 12px" }}>{vin}</span>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-title">All Comebacks This Week</div>
          {report.comebacks.length === 0
            ? <div className="text-muted text-sm">No comebacks logged this week.</div>
            : (
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
                        <td>{c.comeback_date}</td>
                        <td style={{ fontWeight: 600 }}>{c.technician_name}</td>
                        <td className="text-muted">{c.ro_number || "—"}</td>
                        <td>{c.vehicle || "—"}</td>
                        <td>{c.repair_category ? <span className="badge badge-muted">{c.repair_category}</span> : "—"}</td>
                        <td style={{ maxWidth: 200, fontSize: 12, color: "var(--text-muted)" }}>{c.comeback_concern || "—"}</td>
                        <td>{c.is_repeat_vin ? <span className="badge badge-danger">REPEAT VIN</span> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      </div>
    </>
  );
}
