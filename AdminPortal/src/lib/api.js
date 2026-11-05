// Thin fetch wrapper for /api/v3/admin.
//
// The backend answers errors in three shapes — { message, errors:[{field,message}] },
// { error, message } and { error } — so every failure is normalised here into an ApiError with
// .message and .fieldErrors, which ErrorNote and toasts render without guessing.

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v3').replace(/\/$/, '');
const TOKEN_KEY = 'by_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => (token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(message, { status = 0, fieldErrors = [], body = null } = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.body = body;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

const toQuery = (params) => {
  if (!params) return '';
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};

export async function request(method, path, { params, body, form, raw } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_URL}/admin${path}${toQuery(params)}`, { method, headers, body: payload });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and that the API is running.');
  }

  if (raw && res.ok) return res;

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') onUnauthorized();
    const fieldErrors = Array.isArray(data?.errors) ? data.errors : [];
    const message =
      (data?.message && data.message !== 'Internal server error' ? data.message : null) ||
      data?.error ||
      (res.status === 403 ? 'You do not have permission to do this' : `Request failed (${res.status})`);
    throw new ApiError(message, { status: res.status, fieldErrors, body: data });
  }
  return data;
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  del: (path, body) => request('DELETE', path, { body }),
  upload: (path, form, method = 'POST') => request(method, path, { form }),
  // Downloads a CSV report through the authenticated fetch (a plain link would carry no token).
  download: async (path, params, filename) => {
    const res = await request('GET', path, { params: { ...params, format: 'csv' }, raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
};

// Field errors keyed by field name, for inline <Field error>.
export const fieldMap = (err) =>
  Object.fromEntries((err?.fieldErrors || []).map((e) => [e.field, e.message]));
