// ── Token storage ─────────────────────────────────────────────────────────
const TOKEN_KEY = 'auth_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string): void => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth?action=refresh', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.ok && data.token) {
      setToken(data.token);
      return data.token;
    }
  } catch (error) {
    console.error('Refresh token failed:', error);
  }
  return null;
}

export async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(opts.headers as HeadersInit | undefined);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // ensure credentials are included so the backend can read/set HttpOnly cookies if cross-origin
  const fetchOpts: RequestInit = { ...opts, headers, credentials: 'include' };
  let res = await fetch(url, fetchOpts);

  if (res.status === 401) {
    // Attempt silent refresh
    if (!refreshPromise) {
      refreshPromise = performRefresh().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;
    if (newToken) {
      // Replay original request
      headers.set('Authorization', `Bearer ${newToken}`);
      fetchOpts.headers = headers;
      res = await fetch(url, fetchOpts);
    } else {
      // Hard fail
      clearToken();
      setTimeout(() => window.location.reload(), 50);
    }
  }
  return res;
}
