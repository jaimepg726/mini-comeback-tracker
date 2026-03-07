import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ComebackEntry from "./pages/ComebackEntry";
import ComebackLog from "./pages/ComebackLog";
import WeeklyReport from "./pages/WeeklyReport";
import Layout from "./components/Layout";
import "./App.css";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="entry" element={<ComebackEntry />} />
            <Route path="log" element={<ComebackLog />} />
            <Route path="report" element={<WeeklyReport />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
