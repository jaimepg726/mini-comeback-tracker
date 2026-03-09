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

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const categoryData = Object.entries(data.category_counts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  const techData = data.technician_stats.map(t => ({
    name: t.technician,
    comebacks: t.comebacks,
    repeats: t.repeat_vins,
  }));

  return (
    <>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">Real-time overview of technician comebacks and quality trends</div>
      </div>
      <div className="page-body">
        {/* Stat Cards */}
        <div className="stat-grid section-gap">
          <div className="stat-card red">
            <div className="stat-value">{data.total_comebacks}</div>
            <div className="stat-label">Total Comebacks</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{data.total_last_30_days}</div>
            <div className="stat-label">Last 30 Days</div>
          </div>
          <div className="stat-card danger">
            <div className="stat-value">{data.repeat_vin_count}</div>
            <div className="stat-label">Repeat VINs</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{data.technician_stats.length}</div>
            <div className="stat-label">Technicians Tracked</div>
          </div>
        </div>

        <div className="two-col section-gap">
          {/* Comebacks by Tech */}
          <div className="card">
            <div className="card-title">Comebacks by Technician</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={techData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 4 }}
                  labelStyle={{ color: "#f0f0f0" }}
                />
                <Bar dataKey="comebacks" fill="#C7001E" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Categories */}
          <div className="card">
            <div className="card-title">Top Comeback Causes</div>
            {categoryData.length === 0 ? (
              <div className="text-muted text-sm">No data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 10, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 4 }}
                    labelStyle={{ color: "#f0f0f0" }}
                  />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Tech Comeback % Table */}
        <div className="card section-gap">
          <div className="card-title">Technician Breakdown</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>Comebacks</th>
                  <th>Repeat VINs</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.technician_stats.map(t => (
                  <tr key={t.technician}>
                    <td style={{ fontWeight: 600 }}>{t.technician}</td>
                    <td>{t.comebacks}</td>
                    <td>
                      {t.repeat_vins > 0
                        ? <span className="badge badge-danger">{t.repeat_vins} repeat</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {t.comebacks === 0
                        ? <span className="badge badge-success">Clean</span>
                        : t.comebacks <= 2
                          ? <span className="badge badge-warning">Monitor</span>
                          : <span className="badge badge-danger">Review</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Comebacks */}
        <div className="card">
          <div className="card-title">Recent Comebacks (Last 30 Days)</div>
          {data.recent_comebacks.length === 0 ? (
            <div className="text-muted text-sm">No recent comebacks.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Technician</th>
                    <th>Vehicle</th>
                    <th>Category</th>
                    <th>VIN</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_comebacks.map(c => (
                    <tr key={c.id}>
                      <td>{fmtDate(c.comeback_date)}</td>
                      <td style={{ fontWeight: 600 }}>{c.technician_name}</td>
                      <td>{c.vehicle || "—"}</td>
                      <td>
                        {c.repair_category
                          ? <span className="badge badge-muted">{c.repair_category}</span>
                          : "—"}
                      </td>
                      <td className="text-muted">{c.vin_last7 || "—"}</td>
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
