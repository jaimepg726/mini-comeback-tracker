import axios from "axios";

export const API_BASE =
  process.env.REACT_APP_API_URL || "http://localhost:8000";

function extractError(e) {
  const msg = e.response?.data?.detail || e.message || "Request failed";
  const err = new Error(msg);
  err.status = e.response?.status;
  return err;
}

export async function apiGet(path) {
  try {
    const r = await axios.get(`${API_BASE}${path}`);
    return r.data;
  } catch (e) {
    throw extractError(e);
  }
}

export async function apiPost(path, data = {}) {
  try {
    const r = await axios.post(`${API_BASE}${path}`, data);
    return r.data;
  } catch (e) {
    throw extractError(e);
  }
}

export async function apiDelete(path) {
  try {
    const r = await axios.delete(`${API_BASE}${path}`);
    return r.data;
  } catch (e) {
    throw extractError(e);
  }
}
