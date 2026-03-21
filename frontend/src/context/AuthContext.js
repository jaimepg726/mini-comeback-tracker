import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);

// build: 2026-03-20
const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

// Set auth header immediately on module load so first API calls are authenticated
const storedToken = localStorage.getItem("token");
if (storedToken) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("userInfo");
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(storedToken);
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const refreshDemoMode = async () => {
    try {
      const res = await axios.get(`${API}/settings`);
      setDemoMode(res.data?.demo_mode_enabled === "true");
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("userInfo");
    const info = stored ? JSON.parse(stored) : null;
    if (info?.role === "manager" && storedToken) {
      refreshDemoMode();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username, password) => {
    const form = new FormData();
    form.append("username", username);
    form.append("password", password);
    const res = await axios.post(`${API}/token`, form);
    const { access_token, role, name } = res.data;
    localStorage.setItem("token", access_token);
    const userInfo = { username, role, name };
    localStorage.setItem("userInfo", JSON.stringify(userInfo));
    axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setToken(access_token);
    setUser(userInfo);
    if (role === "manager") {
      try {
        const s = await axios.get(`${API}/settings`, { headers: { Authorization: `Bearer ${access_token}` } });
        setDemoMode(s.data?.demo_mode_enabled === "true");
      } catch { /* non-fatal */ }
    }
    return userInfo;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userInfo");
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
    setDemoMode(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, API, demoMode, refreshDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
