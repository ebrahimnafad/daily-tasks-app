// ── Token storage ─────────────────────────────────────────────────────────
const TOKEN_KEY = 'auth_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string): void => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

// ── Authenticated fetch wrapper ───────────────────────────────────────────
/**
 * Drop-in replacement for fetch() that:
 * 1. Injects Authorization: Bearer <token> header automatically
 * 2. On 401 → clears token and reloads the page (sends user to login)
 */
export async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(opts.headers as HeadersInit | undefined);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) {
    clearToken();
    // Give the browser a tick before hard-reload so any in-flight state settles
    setTimeout(() => window.location.reload(), 50);
  }
  return res;
}
