import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = ["All Categories","Diagnosis","Electrical","Engine","Brake","Suspension","Programming/Coding","Oil/Leaks","CBS Light Reset","Tire Pressure Reset / Tire PSI Incorrect","Tire/Brake Measurements Off","Other"];

export default function ComebackLog() {
  const { API, user } = useAuth();
  const [comebacks, setComebacks] = useState([]);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTech, setFilterTech] = useState("All");
  const [filterCat, setFilterCat] = useState("All Categories");
  const [filterRepeat, setFilterRepeat] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const load = () => {
    setLoading(true);
    axios.get(`${API}/comebacks?limit=500`)
      .then(r => setComebacks(r.data))
      .catch(() => setComebacks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    axios.get(`${API}/technicians`).then(r => setTechs(r.data)).catch(() => setTechs([]));
  }, [API]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this comeback record?")) return;
    await axios.delete(`${API}/comebacks/${id}`);
    load();
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (filterTech !== "All") params.append("technician", filterTech);
      if (filterCat !== "All Categories") params.append("category", filterCat);
      if (filterRepeat) params.append("repeat_only", "true");
      const res = await fetch(`${API}/comebacks/export-csv?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const techSuffix = filterTech !== "All" ? `_${filterTech}` : "";
      a.download = `comebacks${techSuffix}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const filtered = comebacks.filter(c => {
    if (filterTech !== "All" && c.technician_name !== filterTech) return false;
    if (filterCat !== "All Categories" && c.repair_category !== filterCat) return false;
    if (filterRepeat && !c.is_repeat_vin) return false;
    return true;
  });

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <>
      {exportSuccess && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#166534", color: "#fff", padding: "12px 24px", borderRadius: 8, fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
          ✓ CSV downloaded successfully
        </div>
      )}
      <div className="page-header">
        <div className="flex-between">
          <div>
            <div className="page-title">Comeback Log</div>
            <div className="page-subtitle">{filtered.length} records shown</div>
          </div>
          <button onClick={handleExportCSV} disabled={exporting || filtered.length === 0}
            style={{ padding: "9px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: filtered.length === 0 ? "not-allowed" : "pointer", border: "1px solid rgba(199,0,30,0.4)", background: exportSuccess ? "#166534" : "rgba(199,0,30,0.12)", color: exportSuccess ? "#fff" : "#f87171", opacity: filtered.length === 0 ? 0.5 : 1, transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
            {exporting ? "Exporting…" : exportSuccess ? "✓ Downloaded" : "⬇ Export CSV"}
          </button>
        </div>
      </div>
      <div className="page-body">
        <div className="card section-gap">
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <div className="form-group">
              <label>Technician</label>
              <select value={filterTech} onChange={e => setFilterTech(e.target.value)}>
                <option value="All">All Technicians</option>
                {techs.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Repeat VINs Only</label>
              <label style={{ flexDirection: "row", alignItems: "center", gap: 8, cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: 14, color: "var(--text)" }}>
                <input type="checkbox" style={{ width: "auto" }} checked={filterRepeat} onChange={e => setFilterRepeat(e.target.checked)} />
                Show only repeat VINs
              </label>
            </div>
          </div>
          {(filterTech !== "All" || filterCat !== "All Categories" || filterRepeat) && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
              ⚠ Active filters — CSV export will match what you see above
            </div>
          )}
        </div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Technician</th><th>RO #</th><th>VIN</th><th>Vehicle</th><th>Category</th><th>Flag</th>{user?.role === "manager" && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (<tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>No records found.</td></tr>)}
                {filtered.map(c => (
                  <>
                    <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                      <td>{fmtDate(c.comeback_date)}</td>
                      <td style={{ fontWeight: 600 }}>{c.technician_name}</td>
                      <td className="text-muted">{c.ro_number || "—"}</td>
                      <td className="text-muted">{c.vin_last7 || "—"}</td>
                      <td>{c.vehicle || "—"}</td>
                      <td>{c.repair_category ? <span className="badge badge-muted">{c.repair_category}</span> : "—"}</td>
                      <td>{c.is_repeat_vin ? <span className="badge badge-danger">REPEAT VIN</span> : <span className="text-muted">—</span>}</td>
                      {user?.role === "manager" && (<td onClick={e => e.stopPropagation()}><button className="btn btn-ghost" onClick={() => handleDelete(c.id)}>Delete</button></td>)}
                    </tr>
                    {expandedId === c.id && (
                      <tr key={`${c.id}-expand`}>
                        <td colSpan={8} style={{ background: "var(--gray-800)", padding: "16px 20px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px 24px" }}>
                            <DetailField label="Original Repair Date" value={fmtDate(c.original_repair_date)} />
                            <DetailField label="Logged By" value={c.logged_by || "—"} />
                            <DetailField label="Original Repair" value={c.original_repair || "—"} />
                            <DetailField label="Comeback Concern" value={c.comeback_concern || "—"} />
                            <DetailField label="Fix Performed" value={c.fix_performed || "—"} />
                            <DetailField label="Root Cause" value={c.root_cause || "—"} />
                            <DetailField label="Notes" value={c.notes || "—"} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--text)" }}>{value}</div>
    </div>
  );
}
