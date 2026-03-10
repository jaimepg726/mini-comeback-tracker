import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";

const CATEGORY_COLORS = [
  "#C7001E","#e63946","#f4a261","#2a9d8f","#457b9d",
  "#8338ec","#fb5607","#ffbe0b","#3a86ff","#06d6a0","#adb5bd"
];

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function TrendBadge({ current, prev }) {
  if (prev === undefined || prev === null) return null;
  if (current === prev) return (
    <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 6 }}>→ same as last week</span>
  );
  const up = current > prev;
  const diff = Math.abs(current - prev);
  return (
    <span style={{ fontSize: 11, marginLeft: 6, fontWeight: 600, color: up ? "#f87171" : "#4ade80" }}>
      {up ? "▲" : "▼"} {diff} vs last week
    </span>
  );
}

export default function Dashboard() {
  const { API } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/dashboard/summary`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [API]);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!data) return null;

  const categoryData = Object.entries(data.category_counts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  const techData = data.technician_stats.map(t => ({
    name: t.technician,
    comebacks: t.comebacks,
    repeats: t.repeat_vins,
  }));

  const thisWeek = data.this_week_count ?? 0;
  const prevWeek = data.prev_week_count ?? 0;

  return (
    <>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">Real-time overview of technician comebacks and quality trends</div>
      </div>

      <div className="page-body">
        <div className="stat-grid section-gap">
          <div className="stat-card red">
            <div className="stat-value">{data.total_comebacks}</div>
            <div className="stat-label">Total Comebacks</div>
          </div>
          <div className="stat-card danger">
            <div className="stat-value">{data.total_last_30_days}</div>
            <div className="stat-label">Last 30 Days</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{data.repeat_vin_count}</div>
            <div className="stat-label">Repeat VINs</div>
          </div>
          <div className="stat-card" style={{ borderColor: "rgba(199,0,30,0.3)" }}>
            <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
              <div className="stat-value">{thisWeek}</div>
              <TrendBadge current={thisWeek} prev={prevWeek} />
            </div>
            <div className="stat-label">
              This Week
              {prevWeek > 0 && (
                <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 4 }}>({prevWeek} last week)</span>
              )}
            </div>
          </div>
        </div>

        <div className="two-col section-gap">
          <div className="card">
            <div className="card-title">Comebacks by Category</div>
            {categoryData.length === 0 ? (
              <div className="text-muted text-sm">No data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryData} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {categoryData.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <div className="card-title">Comebacks by Technician</div>
            {techData.filter(t => t.comebacks > 0).length === 0 ? (
              <div className="text-muted text-sm">No data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={techData.filter(t => t.comebacks > 0)} margin={{ top: 4, right: 8, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="comebacks" fill="#C7001E" radius={[3, 3, 0, 0]} name="Comebacks" />
                  <Bar dataKey="repeats" fill="#f4a261" radius={[3, 3, 0, 0]} name="Repeat VINs" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card section-gap">
          <div className="card-title">Technician Summary</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>Total Comebacks</th>
                  <th>Repeat VINs</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.technician_stats.sort((a, b) => b.comebacks - a.comebacks).map(t => (
                  <tr key={t.technician}>
                    <td style={{ fontWeight: 600 }}>{t.technician}</td>
                    <td>
                      <span className={`badge ${t.comebacks > 3 ? "badge-danger" : t.comebacks > 0 ? "badge-muted" : "badge-success"}`}>{t.comebacks}</span>
                    </td>
                    <td>
                      {t.repeat_vins > 0 ? <span className="badge badge-danger">{t.repeat_vins}</span> : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {t.comebacks === 0 ? <span className="badge badge-success">Clean</span> : t.repeat_vins > 0 ? <span className="badge badge-danger">Repeat VIN</span> : <span className="badge badge-muted">Monitor</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Recent Comebacks (Last 30 Days)</div>
          {data.recent_comebacks.length === 0 ? (
            <div className="text-muted text-sm">No comebacks in the last 30 days.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Technician</th>
                    <th>Vehicle</th>
                    <th>Category</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_comebacks.map(c => (
                    <tr key={c.id}>
                      <td>{fmtDate(c.comeback_date)}</td>
                      <td style={{ fontWeight: 600 }}>{c.technician_name}</td>
                      <td>{c.vehicle || "—"}</td>
                      <td>{c.repair_category ? <span className="badge badge-muted">{c.repair_category}</span> : "—"}</td>
                      <td>{c.is_repeat_vin ? <span className="badge badge-danger">REPEAT VIN</span> : <span className="text-muted">—</span>}</td>
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
