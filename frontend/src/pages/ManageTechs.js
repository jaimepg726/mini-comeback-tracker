import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function ManageTechs() {
  const { API } = useAuth();
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Technician");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const load = () => {
    setLoading(true);
    axios.get(`${API}/technicians/all`)
      .then(r => setTechs(r.data))
      .catch(() => setTechs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [API]);

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) { setError("Name is required."); return; }
    if (techs.filter(t => t.is_active).some(t => t.name.toLowerCase() === name.toLowerCase())) {
      setError("An active technician with that name already exists.");
      return;
    }
    setAdding(true);
    setError("");
    axios.post(`${API}/technicians`, { name, role: newRole })
      .then(() => {
        setNewName("");
        setNewRole("Technician");
        flash(`✓ ${name} added successfully`);
        load();
      })
      .catch(e => setError(e?.response?.data?.detail || "Failed to add technician."))
      .finally(() => setAdding(false));
  };

  const handleDeactivate = (tech) => {
    axios.patch(`${API}/technicians/${tech.id}/deactivate`)
      .then(() => {
        flash(`✓ ${tech.name} deactivated`);
        load();
      })
      .catch(e => setError(e?.response?.data?.detail || "Failed to deactivate technician."));
  };

  const handleReactivate = (tech) => {
    axios.patch(`${API}/technicians/${tech.id}/reactivate`)
      .then(() => {
        flash(`✓ ${tech.name} reactivated`);
        load();
      })
      .catch(e => setError(e?.response?.data?.detail || "Failed to reactivate technician."));
  };

  const ROLES = ["Technician", "Apprentice", "Shop Foreman", "Master Tech"];
  const active = techs.filter(t => t.is_active);
  const inactive = techs.filter(t => !t.is_active);

  return (
    <>
      {success && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#166534", color: "#fff", padding: "12px 24px", borderRadius: 8, fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
          {success}
        </div>
      )}

      <div className="page-header">
        <div className="flex-between">
          <div>
            <div className="page-title">Manage Technicians</div>
            <div className="page-subtitle">Add or deactivate technicians from the roster</div>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Add technician */}
        <div className="card section-gap">
          <div className="card-title">Add Technician</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ margin: 0, flex: "1 1 180px" }}>
              <label>Full Name</label>
              <input type="text" placeholder="e.g. Carlos Rivera" value={newName} onChange={e => { setNewName(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && handleAdd()} style={{ width: "100%" }} />
            </div>
            <div className="form-group" style={{ margin: 0, flex: "1 1 160px" }}>
              <label>Role</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ width: "100%" }}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleAdd} disabled={adding || !newName.trim()} style={{ marginBottom: 2, minWidth: 120 }}>
              {adding ? "Adding…" : "+ Add Tech"}
            </button>
          </div>
          {error && <div style={{ marginTop: 10, color: "#f87171", fontSize: 13, fontWeight: 500 }}>⚠ {error}</div>}
        </div>

        {/* Active roster */}
        <div className="card section-gap">
          <div className="card-title" style={{ marginBottom: 16 }}>
            Active Roster
            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 500, color: "var(--text-muted)", background: "var(--gray-800)", padding: "2px 8px", borderRadius: 12 }}>
              {active.length} tech{active.length !== 1 ? "s" : ""}
            </span>
          </div>

          {loading && <div className="loading-screen" style={{ minHeight: 80 }}><div className="spinner" /></div>}

          {!loading && active.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "16px 0" }}>No active technicians. Add one above.</div>
          )}

          {!loading && active.length > 0 && (
            <div>
              {active.map((tech, i) => (
                <div key={tech.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: i < active.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(199,0,30,0.15)", border: "1px solid rgba(199,0,30,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#C7001E", flexShrink: 0 }}>
                      {tech.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{tech.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{tech.role || "Technician"}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeactivate(tech)}
                    style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(107,114,128,0.4)", background: "rgba(107,114,128,0.08)", color: "#9ca3af", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(107,114,128,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(107,114,128,0.08)"; }}
                  >
                    Deactivate
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inactive roster (collapsible) */}
        {inactive.length > 0 && (
          <div className="card">
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: showInactive ? 16 : 0 }}
              onClick={() => setShowInactive(s => !s)}
            >
              <div className="card-title" style={{ marginBottom: 0 }}>
                Inactive Technicians
                <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 500, color: "var(--text-muted)", background: "var(--gray-800)", padding: "2px 8px", borderRadius: 12 }}>
                  {inactive.length}
                </span>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{showInactive ? "▲" : "▼"}</span>
            </div>

            {showInactive && (
              <div>
                {inactive.map((tech, i) => (
                  <div key={tech.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: i < inactive.length - 1 ? "1px solid var(--border)" : "none", opacity: 0.65 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(107,114,128,0.12)", border: "1px solid rgba(107,114,128,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#6b7280", flexShrink: 0 }}>
                        {tech.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-muted)", textDecoration: "line-through" }}>{tech.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{tech.role || "Technician"} · Inactive</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleReactivate(tech)}
                      style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(74,222,128,0.4)", background: "rgba(74,222,128,0.08)", color: "#4ade80", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(74,222,128,0.2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(74,222,128,0.08)"; }}
                    >
                      Reactivate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
