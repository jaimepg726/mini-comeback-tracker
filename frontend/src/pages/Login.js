import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="brand"><span>MINI</span> Service</div>
          <div className="tagline">Fairfield County — Comeback Tracker</div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text" value={username} autoCapitalize="none"
              onChange={e => setUsername(e.target.value)}
              placeholder="manager / advisor"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div style={{ marginTop: 24, padding: "12px", background: "var(--gray-800)", borderRadius: "var(--radius)", fontSize: 11, color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Default Credentials</strong>
          <div style={{ marginTop: 6 }}>Manager: <span style={{ color: "var(--text)" }}>manager / mini1234</span></div>
          <div>Advisor: <span style={{ color: "var(--text)" }}>advisor / advisor1234</span></div>
        </div>
      </div>
    </div>
  );
}
