import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ComebackEntry from "./pages/ComebackEntry";
import ComebackLog from "./pages/ComebackLog";
import WeeklyReport from "./pages/WeeklyReport";
import ManageTechs from "./pages/ManageTechs";
import Settings from "./pages/Settings";
import Layout, { getRoleHome, canAccess } from "./components/Layout";
import "./App.css";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  if (!canAccess(user.role, location.pathname)) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  return children;
}

function DefaultRedirect() {
  const { user } = useAuth();
  return <Navigate to={getRoleHome(user?.role)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DefaultRedirect />} />
            <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="entry"     element={<ProtectedRoute><ComebackEntry /></ProtectedRoute>} />
            <Route path="log"       element={<ProtectedRoute><ComebackLog /></ProtectedRoute>} />
            <Route path="report"    element={<ProtectedRoute><WeeklyReport /></ProtectedRoute>} />
            <Route path="settings"  element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="techs"     element={<Navigate to="/settings" replace />} />
          </Route>
          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
