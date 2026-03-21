import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = [
  "Diagnosis", "Electrical", "Engine", "Brake", "Suspension",
  "Programming/Coding", "Oil/Leaks",
  "CBS Light Reset", "Tire Light Reset",
  "Tire Pressure Reset / Tire PSI Incorrect", "Tire/Brake Measurements Off",
  "Other",
];

const FLAGS = [
  { value: "", label: "No Flag" },
  { value: "Safety", label: "Safety" },
  { value: "Customer Satisfaction", label: "Customer Satisfaction" },
  { value: "Repeat VIN", label: "Repeat VIN" },
  { value: "Escalated", label: "Escalated" },
];

const FLAG_COLORS = {
  Safety: "#C7001E",
  "Customer Satisfaction": "#f4a261",
  "Repeat VIN": "#ffbe0b",
  Escalated: "#8338ec",
};

const today = () => new Date().toISOString().split("T")[0];

export default function ComebackEntry() {
  const { API, user, demoMode } = useAuth();
  const [techs, setTechs] = useState([]);
  const [form, setForm] = useState({
    comeback_date: today(),
    original_repair_date: "",
    ro_number: "",
    vin_last7: "",
    vehicle: "",
    technician_name: "",
    original_repair: "",
    comeback_concern: "",
    repair_category: "",
    fix_performed: "",
    root_cause: "",
    notes: "",
    flag: "",
  });
  const [vinError, setVinError] = useState("");
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState(0);

  useEffect(() => {
    axios.get(`${API}/technicians`).then(r => setTechs(r.data));
  }, [API]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleVinChange = (val) => {
    const upper = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
    set("vin_last7", upper);
    if (upper && upper.length !== 7) {
      setVinError("VIN must be exactly 7 alphanumeric characters");
    } else {
      setVinError("");
    }
  };

  const resetForm = () => {
    setVinError("");
    setForm({
      comeback_date: today(), original_repair_date: "",
      ro_number: "", vin_last7: "", vehicle: "",
      technician_name: form.technician_name,
      original_repair: "", comeback_concern: "",
      repair_category: "", fix_performed: "", root_cause: "", notes: "",
      flag: "",
    });
  };

  const handleSubmit = async () => {
    if (!form.vehicle || !form.technician_name || !form.repair_category || !form.comeback_concern) {
      setStatus("error");
      return;
    }
    if (form.vin_last7 && form.vin_last7.length !== 7) {
      setVinError("VIN must be exactly 7 alphanumeric characters");
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      const payload = { ...form };
      if (!payload.original_repair_date) delete payload.original_repair_date;
      if (!payload.flag) delete payload.flag;
      await axios.post(`${API}/comebacks`, payload);
      setStatus("success");
      setSuccessCount(n => n + 1);
      resetForm();
      setTimeout(() => setStatus(null), 4000);
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const isAdvisor = user?.role === "advisor";
  const isManager = user?.role === "manager";

  return (
    <>
      {status === "success" && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          background: "#16a34a", color: "#fff",
          padding: "16px 24px", fontSize: 16, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          animation: "slideDown 0.3s ease"
        }}>
          <span>✓ Comeback #{successCount} logged — repeat VIN check applied</span>
          <button onClick={() => setStatus(null)} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
      )}

      <div className="page-header">
        <div className="page-title">Log Comeback</div>
        <div className="page-subtitle">Required fields marked with *</div>
      </div>

      <div className="page-body">
        {demoMode && (
          <div style={{
            background: "rgba(146,64,14,0.25)", border: "1px solid #b45309",
            borderRadius: 8, padding: "14px 18px", marginBottom: 20,
            color: "#fbbf24", fontWeight: 600, fontSize: 14,
          }}>
            ⚠ Demo Mode is active — new comebacks cannot be submitted. Disable Demo Mode in Settings to resume logging.
          </div>
        )}
        {status === "error" && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            ✗ Fill in all required fields: Vehicle, Technician, Category, and Concern.
          </div>
        )}

        <div className="card section-gap">
          <div className="card-title">Quick Entry</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Technician *</label>
              <select value={form.technician_name} onChange={e => set("technician_name", e.target.value)}>
                <option value="">Select technician...</option>
                {techs.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Vehicle *</label>
              <input type="text" value={form.vehicle} onChange={e => set("vehicle", e.target.value)} placeholder="e.g. 2022 MINI Cooper S" />
            </div>
            <div className="form-group">
              <label>RO #</label>
              <input type="text" value={form.ro_number} onChange={e => set("ro_number", e.target.value)} placeholder="e.g. 123456" />
            </div>
            <div className="form-group">
              <label>VIN Last 7</label>
              <input
                type="text"
                maxLength={7}
                value={form.vin_last7}
                onChange={e => handleVinChange(e.target.value)}
                placeholder="e.g. AB12345"
                style={{ textTransform: "uppercase", borderColor: vinError ? "#f87171" : undefined }}
              />
              {vinError && <div style={{ color: "#f87171", fontSize: 11, marginTop: 4, fontWeight: 500 }}>⚠ {vinError}</div>}
            </div>
            <div className="form-group">
              <label>Comeback Date *</label>
              <input type="date" value={form.comeback_date} onChange={e => set("comeback_date", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Original Repair Date</label>
              <input type="date" value={form.original_repair_date} onChange={e => set("original_repair_date", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card section-gap">
          <div className="card-title">Repair Category * — tap to select</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 8 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => set("repair_category", cat)}
                style={{
                  padding: "14px 10px",
                  borderRadius: 8,
                  border: form.repair_category === cat ? "2px solid #C7001E" : "2px solid var(--border)",
                  background: form.repair_category === cat ? "rgba(199,0,30,0.15)" : "var(--gray-800)",
                  color: form.repair_category === cat ? "#fff" : "var(--text-muted)",
                  fontWeight: form.repair_category === cat ? 700 : 400,
                  fontSize: 13, cursor: "pointer", transition: "all 0.15s",
                  textAlign: "center", lineHeight: 1.3,
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          {form.repair_category && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
              ✓ Selected: {form.repair_category}
            </div>
          )}
        </div>

        {isManager && (
          <div className="card section-gap">
            <div className="card-title">Flag</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {FLAGS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => set("flag", f.value)}
                  style={{
                    padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    border: form.flag === f.value
                      ? `2px solid ${FLAG_COLORS[f.value] || "#6b7280"}`
                      : "2px solid var(--border)",
                    background: form.flag === f.value
                      ? `${FLAG_COLORS[f.value] || "#374151"}22`
                      : "var(--gray-800)",
                    color: form.flag === f.value
                      ? (FLAG_COLORS[f.value] || "#9ca3af")
                      : "var(--text-muted)",
                  }}
                >
                  {f.value ? `⚑ ${f.label}` : f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card section-gap">
          <div className="card-title">Concern Details</div>
          <div className="form-grid">
            <div className="form-group full">
              <label>Comeback Concern * — what is the customer reporting?</label>
              <textarea value={form.comeback_concern} onChange={e => set("comeback_concern", e.target.value)} placeholder="e.g. Same noise returning after brake job performed last week" rows={3} />
            </div>
            <div className="form-group full">
              <label>Original Repair (optional)</label>
              <textarea value={form.original_repair} onChange={e => set("original_repair", e.target.value)} placeholder="What was performed on the original visit?" rows={2} />
            </div>
          </div>
        </div>

        {isManager && (
          <div className="card section-gap">
            <div className="card-title">Resolution (Manager)</div>
            <div className="form-grid">
              <div className="form-group full">
                <label>Fix Performed</label>
                <textarea value={form.fix_performed} onChange={e => set("fix_performed", e.target.value)} placeholder="What resolved the comeback?" rows={2} />
              </div>
              <div className="form-group full">
                <label>Root Cause</label>
                <textarea value={form.root_cause} onChange={e => set("root_cause", e.target.value)} placeholder="Identified root cause" rows={2} />
              </div>
              <div className="form-group full">
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional notes" rows={2} />
              </div>
            </div>
          </div>
        )}

        {isAdvisor && (
          <div className="card section-gap">
            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Notes for manager" rows={2} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 8, paddingBottom: 40 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || demoMode} style={{ minWidth: 180, padding: "14px 24px", fontSize: 16, opacity: demoMode ? 0.45 : 1 }}>
            {submitting ? "Saving..." : "Submit Comeback"}
          </button>
          <button className="btn btn-ghost" onClick={resetForm} type="button">Clear Form</button>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
