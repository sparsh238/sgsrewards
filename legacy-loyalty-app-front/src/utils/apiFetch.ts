// Centralized authenticated fetch wrapper.
//
// - Prefixes the configured API base URL for relative paths.
// - Attaches the stored bearer token automatically.
// - On 401 (expired/invalid session) it clears auth state and redirects to
//   login, so any caller gets consistent session-expiry handling for free.
//
// Usage: const res = await apiFetch('/api/user/points');  // relative path
//        const res = await apiFetch('/api/user/cart/add', { method: 'POST', json: body });

const API_BASE = process.env.REACT_APP_API_URL || '';

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  // Convenience: pass a plain object to be JSON-serialized with the correct
  // Content-Type header. Use `body` directly for FormData / raw payloads.
  json?: unknown;
  body?: BodyInit;
}

const forceLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('userType');
  localStorage.removeItem('partyName');
  // Hard redirect resets all in-memory state to a clean logged-out app.
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  }
};

export const apiFetch = async (path: string, options: ApiFetchOptions = {}): Promise<Response> => {
  const { json, headers, ...rest } = options;
  const token = localStorage.getItem('token');

  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string>) };
  if (token) {
    finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  let body = rest.body;
  if (json !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const response = await fetch(url, { ...rest, headers: finalHeaders, body });

  if (response.status === 401) {
    forceLogout();
    throw new Error('Session expired. Please log in again.');
  }

  return response;
};

export default apiFetch;
