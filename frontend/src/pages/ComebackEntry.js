import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = [
  "Diagnosis", "Electrical", "Engine", "Brake", "Suspension",
  "Programming/Coding", "Oil/Leaks", "CBS Light Reset",
  "Tire Pressure Reset / Tire PSI Incorrect",
  "Tire/Brake Measurements Off", "Other"
];

const today = () => new Date().toISOString().split("T")[0];

export default function ComebackEntry() {
  const { API, user } = useAuth();
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
  });
  const [status, setStatus] = useState(null); // "success" | "error"
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/technicians`).then(r => setTechs(r.data));
  }, [API]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setStatus(null);
    try {
      const payload = { ...form };
      if (!payload.original_repair_date) delete payload.original_repair_date;
      await axios.post(`${API}/comebacks`, payload);
      setStatus("success");
      setForm({
        comeback_date: today(), original_repair_date: "",
        ro_number: "", vin_last7: "", vehicle: "",
        technician_name: "", original_repair: "",
        comeback_concern: "", repair_category: "",
        fix_performed: "", root_cause: "", notes: "",
      });
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const isAdvisor = user?.role === "advisor";

  return (
    <>
      <div className="page-header">
        <div className="page-title">Log Comeback</div>
        <div className="page-subtitle">Record a customer comeback — fill in as much detail as available</div>
      </div>
      <div className="page-body">
        {status === "success" && (
          <div className="alert alert-success">✓ Comeback logged successfully. Repeat VIN detection applied automatically.</div>
        )}
        {status === "error" && (
          <div className="alert alert-error">✗ Failed to save. Check all required fields and try again.</div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="card section-gap">
            <div className="card-title">Intake Information</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Comeback Date *</label>
                <input type="date" value={form.comeback_date} onChange={e => set("comeback_date", e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Original Repair Date</label>
                <input type="date" value={form.original_repair_date} onChange={e => set("original_repair_date", e.target.value)} />
              </div>
              <div className="form-group">
                <label>RO Number</label>
                <input type="text" value={form.ro_number} onChange={e => set("ro_number", e.target.value)} placeholder="e.g. 123456" />
              </div>
              <div className="form-group">
                <label>VIN Last 7</label>
                <input
                  type="text" maxLength={7} value={form.vin_last7}
                  onChange={e => set("vin_last7", e.target.value.toUpperCase())}
                  placeholder="e.g. AB12345"
                />
              </div>
              <div className="form-group">
                <label>Vehicle (Year / Model) *</label>
                <input type="text" value={form.vehicle} onChange={e => set("vehicle", e.target.value)} placeholder="e.g. 2022 MINI Cooper S" required />
              </div>
              <div className="form-group">
                <label>Technician *</label>
                <select value={form.technician_name} onChange={e => set("technician_name", e.target.value)} required>
                  <option value="">Select technician...</option>
                  {techs.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card section-gap">
            <div className="card-title">Repair Details</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Repair Category *</label>
                <select value={form.repair_category} onChange={e => set("repair_category", e.target.value)} required>
                  <option value="">Select category...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group full">
                <label>Original Repair Description</label>
                <textarea value={form.original_repair} onChange={e => set("original_repair", e.target.value)} placeholder="What was performed on the original visit?" />
              </div>
              <div className="form-group full">
                <label>Comeback Concern *</label>
                <textarea value={form.comeback_concern} onChange={e => set("comeback_concern", e.target.value)} placeholder="What is the customer's concern on this visit?" required />
              </div>
            </div>
          </div>

          {!isAdvisor && (
            <div className="card section-gap">
              <div className="card-title">Manager — Resolution Details</div>
              <div className="form-grid">
                <div className="form-group full">
                  <label>Fix Performed</label>
                  <textarea value={form.fix_performed} onChange={e => set("fix_performed", e.target.value)} placeholder="What was performed to resolve the comeback?" />
                </div>
                <div className="form-group full">
                  <label>Root Cause</label>
                  <textarea value={form.root_cause} onChange={e => set("root_cause", e.target.value)} placeholder="Identified root cause of the comeback" />
                </div>
                <div className="form-group full">
                  <label>Notes</label>
                  <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional notes" />
                </div>
              </div>
            </div>
          )}

          {isAdvisor && (
            <div className="card section-gap">
              <div className="card-title">Notes</div>
              <div className="form-group">
                <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional notes for the manager" />
              </div>
            </div>
          )}

          <div className="flex-gap mt-4">
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Submit Comeback"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
