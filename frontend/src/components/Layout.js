import { Outlet, NavLink, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLE_NAV = {
  manager: [
    { to: "/dashboard",  label: "Dashboard" },
    { to: "/entry",      label: "Log Comeback" },
    { to: "/log",        label: "All Comebacks" },
    { to: "/report",     label: "Weekly Report" },
    { to: "/techs",      label: "Technicians" },
  ],
  foreman: [
    { to: "/dashboard",  label: "Dashboard" },
    { to: "/log",        label: "All Comebacks" },
    { to: "/report",     label: "Weekly Report" },
  ],
  advisor: [
    { to: "/entry",      label: "Log Comeback" },
  ],
};

const ROLE_COLORS = {
  manager: "#C7001E",
  foreman: "#2563eb",
  advisor: "#059669",
};

const ROLE_HOME = {
  manager: "/dashboard",
  foreman: "/dashboard",
  advisor: "/entry",
};

export function getRoleHome(role) {
  return ROLE_HOME[role] || "/dashboard";
}

export function canAccess(role, path) {
  const nav = ROLE_NAV[role] || ROLE_NAV.advisor;
  return nav.some(n => path.startsWith(n.to));
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate("/login"); };

  const role = user?.role || "advisor";
  const navItems = ROLE_NAV[role] || ROLE_NAV.advisor;
  const roleColor = ROLE_COLORS[role] || "#6b7280";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1117", color: "#fff", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <header style={{ backgroundColor: "#111827", borderBottom: "1px solid #1f2937", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #dc2626, #991b1b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff" }}>DS</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>DealerSuite</div>
              <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>Service Quality Tracker</div>
            </div>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                  color: isActive ? "#fff" : "#9ca3af",
                  backgroundColor: isActive ? "#dc2626" : "transparent",
                  textDecoration: "none",
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {user && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: roleColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  {user.name ? user.name[0].toUpperCase() : "U"}
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb", display: "block" }}>{user.name}</span>
                  <span style={{ fontSize: 10, color: roleColor, textTransform: "capitalize", fontWeight: 600 }}>{user.role}</span>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              style={{ padding: "6px 14px", backgroundColor: "transparent", border: "1px solid #374151", borderRadius: 6, color: "#9ca3af", fontSize: 12, cursor: "pointer" }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>
        <Outlet />
      </main>
    </div>
  );
}
