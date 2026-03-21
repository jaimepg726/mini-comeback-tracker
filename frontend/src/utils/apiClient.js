import axios from "axios";

// Use REACT_APP_API_URL if provided (set at build time for separate-backend deploys).
// Otherwise default to '' so requests go same-origin and nginx proxies them to the backend.
export const API_BASE = process.env.REACT_APP_API_URL || "";

const isDev = process.env.NODE_ENV === "development";

/** Always read from localStorage so the header is injected even if axios.defaults isn't set yet. */
function getAuthHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function devLog(method, url, status) {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.debug(`[API] ${method} ${url} → ${status}`);
  }
}

function extractError(e) {
  const status = e.response?.status;
  let msg;
  if (status === 401) {
    msg = "Session expired — please log in again.";
  } else {
    msg = e.response?.data?.detail || e.message || "Request failed";
  }
  const err = new Error(msg);
  err.status = status;
  return err;
}

export async function apiGet(path) {
  const url = `${API_BASE}${path}`;
  try {
    const r = await axios.get(url, { headers: getAuthHeader() });
    devLog("GET", url, r.status);
    return r.data;
  } catch (e) {
    devLog("GET", url, e.response?.status ?? "ERR");
    throw extractError(e);
  }
}

export async function apiPost(path, data = {}) {
  const url = `${API_BASE}${path}`;
  try {
    const r = await axios.post(url, data, { headers: getAuthHeader() });
    devLog("POST", url, r.status);
    return r.data;
  } catch (e) {
    devLog("POST", url, e.response?.status ?? "ERR");
    throw extractError(e);
  }
}

export async function apiPut(path, data = {}) {
  const url = `${API_BASE}${path}`;
  try {
    const r = await axios.put(url, data, { headers: getAuthHeader() });
    devLog("PUT", url, r.status);
    return r.data;
  } catch (e) {
    devLog("PUT", url, e.response?.status ?? "ERR");
    throw extractError(e);
  }
}

export async function apiDelete(path) {
  const url = `${API_BASE}${path}`;
  try {
    const r = await axios.delete(url, { headers: getAuthHeader() });
    devLog("DELETE", url, r.status);
    return r.data;
  } catch (e) {
    devLog("DELETE", url, e.response?.status ?? "ERR");
    throw extractError(e);
  }
}
