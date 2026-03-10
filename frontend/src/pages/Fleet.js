import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const FUEL = ["Full","3/4","1/2","1/4","Empty"];
const STATUS_STYLE = {
  available: { background:"rgba(22,163,74,0.15)", color:"#4ade80", label:"Available" },
  out:       { background:"rgba(199,0,30,0.15)",  color:"#f87171", label:"Out" },
  maintenance:{ background:"rgba(234,179,8,0.15)",color:"#facc15", label:"Maintenance" },
};
const today = () => new Date().toISOString().split("T")[0];

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"#111827",border:"1px solid #1f2937",borderRadius:12,width:"100%",maxWidth:480,padding:28 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <div style={{ fontSize:16,fontWeight:700,color:"#fff" }}>{title}</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#6b7280",fontSize:20,cursor:"pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="form-group" style={{ marginBottom:14 }}>
      <label style={{ fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#6b7280",display:"block",marginBottom:4 }}>{label}</label>
      {children}
    </div>
  );
}

export default function Fleet() {
  const { API, user } = useAuth();
  const [loaners, setLoaners]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // {type, loaner}
  const [form, setForm]         = useState({});
  const [saving, setSaving]     = useState(false);
  const [addForm, setAddForm]   = useState(null);

  const load = () => {
    setLoading(true);
    axios.get(`${API}/loaners`).then(r => setLoaners(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [API]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setA = k => e => setAddForm(f => ({ ...f, [k]: e.target.value }));

  const openModal = (type, loaner) => {
    setModal({ type, loaner });
    if (type === "checkout") setForm({ checkout_date: today(), checkout_fuel: loaner.current_fuel || "Full" });
    if (type === "checkin")  setForm({ checkin_date: today(), checkin_fuel: "Full", damage_noted: false });
  };

  const save = async () => {
    setSaving(true);
    try {
      const { type, loaner } = modal;
      const payload = type === "checkin" ? { ...form, damage_noted: form.damage_noted === true || form.damage_noted === "true" } : form;
      await axios.post(`${API}/loaners/${loaner.id}/${type}`, payload);
      setModal(null); load();
    } finally { setSaving(false); }
  };

  const addLoaner = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/loaners`, addForm);
      setAddForm(null); load();
    } finally { setSaving(false); }
  };

  const deleteLoaner = async (id) => {
    if (!window.confirm("Remove this loaner from fleet?")) return;
    await axios.delete(`${API}/loaners/${id}`); load();
  };

  const counts = { available: 0, out: 0, maintenance: 0 };
  loaners.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div className="flex-between">
          <div>
            <div className="page-title">Loaner Fleet</div>
            <div className="page-subtitle">{loaners.length} vehicles · {counts.available} available · {counts.out} out</div>
          </div>
          {user?.role === "manager" && (
            <button className="btn btn-primary" onClick={() => setAddForm({ status:"available", current_fuel:"Full" })}>+ Add Vehicle</button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Stat strip */}
        <div className="stat-grid section-gap" style={{ gridTemplateColumns:"repeat(3,1fr)" }}>
          {Object.entries(counts).map(([k,v]) => (
            <div key={k} className="stat-card" style={{ borderColor: STATUS_STYLE[k]?.color+"55" }}>
              <div className="stat-value" style={{ color: STATUS_STYLE[k]?.color }}>{v}</div>
              <div className="stat-label">{STATUS_STYLE[k]?.label}</div>
            </div>
          ))}
        </div>

        {/* Fleet table */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Unit</th><th>Vehicle</th><th>Plate</th><th>Miles</th><th>Fuel</th><th>Status</th><th>Customer / RO</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loaners.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:"center",color:"#6b7280",padding:40 }}>No loaners in fleet. Add one above.</td></tr>
                )}
                {loaners.map(l => {
                  const s = STATUS_STYLE[l.status] || STATUS_STYLE.available;
                  return (
                    <tr key={l.id}>
                      <td style={{ fontWeight:700 }}>{l.unit_number}</td>
                      <td>{[l.year, l.make, l.model].filter(Boolean).join(" ") || "—"}</td>
                      <td className="text-muted">{l.license_plate || "—"}</td>
                      <td className="text-muted">{l.current_miles?.toLocaleString() || "—"}</td>
                      <td className="text-muted">{l.current_fuel || "—"}</td>
                      <td><span style={{ padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,...s }}>{s.label}</span></td>
                      <td style={{ fontSize:12,color:"#9ca3af" }}>
                        {l.status === "out" ? <span><b style={{ color:"#e5e7eb" }}>{l.customer_name}</b>{l.ro_number ? ` · RO ${l.ro_number}` : ""}</span> : "—"}
                      </td>
                      <td>
                        <div style={{ display:"flex",gap:6 }}>
                          {l.status === "available" && <button className="btn btn-primary" style={{ fontSize:12,padding:"5px 12px" }} onClick={() => openModal("checkout",l)}>Check Out</button>}
                          {l.status === "out"       && <button className="btn btn-ghost"   style={{ fontSize:12,padding:"5px 12px",border:"1px solid #16a34a",color:"#4ade80" }} onClick={() => openModal("checkin",l)}>Check In</button>}
                          {user?.role === "manager" && <button className="btn btn-ghost" style={{ fontSize:12,padding:"5px 12px" }} onClick={() => deleteLoaner(l.id)}>✕</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Check-Out Modal */}
      {modal?.type === "checkout" && (
        <Modal title={`Check Out · ${modal.loaner.unit_number}`} onClose={() => setModal(null)}>
          <Field label="Customer Name"><input value={form.customer_name||""} onChange={set("customer_name")} placeholder="Full name" /></Field>
          <Field label="Phone"><input value={form.customer_phone||""} onChange={set("customer_phone")} placeholder="Optional" /></Field>
          <Field label="RO Number"><input value={form.ro_number||""} onChange={set("ro_number")} placeholder="Optional" /></Field>
          <Field label="Advisor"><input value={form.advisor_name||""} onChange={set("advisor_name")} placeholder="Advisor name" /></Field>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Field label="Date"><input type="date" value={form.checkout_date||""} onChange={set("checkout_date")} /></Field>
            <Field label="Miles Out"><input type="number" value={form.checkout_miles||""} onChange={set("checkout_miles")} placeholder={modal.loaner.current_miles} /></Field>
          </div>
          <Field label="Fuel Level">
            <select value={form.checkout_fuel||"Full"} onChange={set("checkout_fuel")}>
              {FUEL.map(f => <option key={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Notes"><input value={form.checkout_notes||""} onChange={set("checkout_notes")} placeholder="Optional" /></Field>
          <button className="btn btn-primary" style={{ width:"100%",marginTop:8 }} onClick={save} disabled={saving||!form.customer_name}>
            {saving ? "Saving…" : "Confirm Check Out"}
          </button>
        </Modal>
      )}

      {/* Check-In Modal */}
      {modal?.type === "checkin" && (
        <Modal title={`Check In · ${modal.loaner.unit_number}`} onClose={() => setModal(null)}>
          <div style={{ background:"rgba(199,0,30,0.08)",border:"1px solid rgba(199,0,30,0.2)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13 }}>
            Out to <b style={{ color:"#fff" }}>{modal.loaner.customer_name}</b>{modal.loaner.ro_number ? ` · RO ${modal.loaner.ro_number}` : ""}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Field label="Date"><input type="date" value={form.checkin_date||""} onChange={set("checkin_date")} /></Field>
            <Field label="Miles In"><input type="number" value={form.checkin_miles||""} onChange={set("checkin_miles")} placeholder="Current miles" /></Field>
          </div>
          <Field label="Fuel Level">
            <select value={form.checkin_fuel||"Full"} onChange={set("checkin_fuel")}>
              {FUEL.map(f => <option key={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Notes"><input value={form.checkin_notes||""} onChange={set("checkin_notes")} placeholder="Optional" /></Field>
          <Field label="Damage?">
            <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:"#e5e7eb",fontSize:14 }}>
              <input type="checkbox" checked={!!form.damage_noted} onChange={e => setForm(f=>({...f,damage_noted:e.target.checked}))} style={{ width:"auto" }} />
              Damage noted on return
            </label>
          </Field>
          {form.damage_noted && <Field label="Damage Description"><input value={form.damage_notes||""} onChange={set("damage_notes")} placeholder="Describe damage…" /></Field>}
          <button className="btn btn-primary" style={{ width:"100%",marginTop:8,background:"#166534",borderColor:"#16a34a" }} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Confirm Check In"}
          </button>
        </Modal>
      )}

      {/* Add Loaner Modal */}
      {addForm && (
        <Modal title="Add Vehicle to Fleet" onClose={() => setAddForm(null)}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <Field label="Unit #"><input value={addForm.unit_number||""} onChange={setA("unit_number")} placeholder="e.g. L-01" /></Field>
            <Field label="Year"><input type="number" value={addForm.year||""} onChange={setA("year")} placeholder="2024" /></Field>
            <Field label="Make"><input value={addForm.make||""} onChange={setA("make")} placeholder="MINI" /></Field>
            <Field label="Model"><input value={addForm.model||""} onChange={setA("model")} placeholder="Cooper" /></Field>
            <Field label="License Plate"><input value={addForm.license_plate||""} onChange={setA("license_plate")} /></Field>
            <Field label="Current Miles"><input type="number" value={addForm.current_miles||""} onChange={setA("current_miles")} /></Field>
            <Field label="VIN"><input value={addForm.vin||""} onChange={setA("vin")} /></Field>
            <Field label="Fuel Level">
              <select value={addForm.current_fuel||"Full"} onChange={setA("current_fuel")}>
                {FUEL.map(f => <option key={f}>{f}</option>)}
              </select>
            </Field>
          </div>
          <button className="btn btn-primary" style={{ width:"100%",marginTop:8 }} onClick={addLoaner} disabled={saving||!addForm.unit_number}>
            {saving ? "Saving…" : "Add to Fleet"}
          </button>
        </Modal>
      )}
    </>
  );
}
