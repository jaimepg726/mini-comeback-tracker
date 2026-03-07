import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const stored = localStorage.getItem("userInfo");
      if (stored) setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, [token]);

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
    return userInfo;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userInfo");
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
