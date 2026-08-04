// Centralized authenticated fetch.
// - Prefixes VITE_API_URL for relative paths.
// - Attaches the stored bearer token.
// - On 401, clears auth state and redirects to login.
//
// NOTE: the backend currently validates the *refresh* token as the session
// bearer (see loyalty-app-token-redesign). Login therefore stores
// data.refreshToken as `token`, matching the old app until the backend
// token model is redesigned.

const API_BASE: string = import.meta.env.VITE_API_URL || '';

export const IMAGE_BASE = API_BASE;

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** Convenience: JSON-serialize this value and set Content-Type. */
  json?: unknown;
  body?: BodyInit;
}

export const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('userType');
  localStorage.removeItem('partyName');
};

const forceLogout = () => {
  clearSession();
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  }
};

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { json, headers, ...rest } = options;
  const token = localStorage.getItem('token');

  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string>) };
  if (token) finalHeaders['Authorization'] = `Bearer ${token}`;

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
}

/** apiFetch + JSON parse + error surfacing in one call. */
export async function apiJson<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const response = await apiFetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      (data as { message?: string; error?: string }).message ||
      (data as { message?: string; error?: string }).error ||
      `Request failed (${response.status})`;
    throw new Error(msg);
  }
  return data as T;
}
