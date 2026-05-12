import { useState, useEffect, useCallback } from 'react';
import { getToken, setToken, clearToken, authFetch } from './authFetch';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  username: string | null;
}

interface MeResponse {
  ok: boolean;
  username?: string;
}

interface LoginResponse {
  ok: boolean;
  token?: string;
  error?: string;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    username: null,
  });

  // Verify existing token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      // No token — skip network call, just mark not loading
      // (Use a microtask so React batches this outside the effect body)
      Promise.resolve().then(() =>
        setState({ isAuthenticated: false, isLoading: false, username: null })
      );
      return;
    }
    authFetch('/api/db?resource=auth&action=me')
      .then((r) => r.json())
      .then((data: MeResponse) => {
        if (data.ok && data.username) {
          setState({ isAuthenticated: true, isLoading: false, username: data.username });
        } else {
          clearToken();
          setState({ isAuthenticated: false, isLoading: false, username: null });
        }
      })
      .catch(() => {
        // Network error — keep token, allow offline use
        setState({ isAuthenticated: true, isLoading: false, username: null });
      });
  }, []);

  /** Returns null on success, or an Arabic error message string on failure */
  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/db?resource=auth&action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as LoginResponse;
      if (data.ok && data.token) {
        setToken(data.token);
        setState({ isAuthenticated: true, isLoading: false, username });
        return null;
      }
      return data.error ?? 'خطأ في تسجيل الدخول';
    } catch {
      return 'فشل الاتصال بالخادم';
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setState({ isAuthenticated: false, isLoading: false, username: null });
  }, []);

  return {
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    username: state.username,
    login,
    logout,
  };
}
