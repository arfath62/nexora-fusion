import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  AUTH_TOKEN_KEY,
  getApiBaseUrl,
  isApiConfigured,
  setStoredAccessToken,
  getStoredAccessToken,
} from '../lib/apiEnv';

export type AuthUser = { id: string; email: string; name: string | null };

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  isApiConfigured: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function authJson<T>(
  path: string,
  body: unknown,
  init?: RequestInit
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error('API is not configured');
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers as object) },
    body: JSON.stringify(body),
    ...init,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = (data as { error?: string })?.error ?? (text || res.statusText);
    throw new Error(typeof err === 'string' ? err : 'Request failed');
  }
  return data as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const apiOn = isApiConfigured();
  const [token, setToken] = useState<string | null>(() => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(AUTH_TOKEN_KEY);
  });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(() => {
    if (!isApiConfigured()) return true;
    return !getStoredAccessToken();
  });

  const loadMe = useCallback(async (t: string) => {
    const base = getApiBaseUrl();
    if (!base) return;
    const res = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      setStoredAccessToken(null);
      setToken(null);
      setUser(null);
      if (res.status === 401) window.dispatchEvent(new CustomEvent('nexora:auth-lost'));
      return;
    }
    const data = (await res.json()) as { user: AuthUser };
    setUser(data.user);
  }, []);

  useEffect(() => {
    if (!apiOn) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      if (!token) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        await loadMe(token);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiOn, token, loadMe]);

  useEffect(() => {
    const onLost = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('nexora:auth-lost', onLost);
    return () => window.removeEventListener('nexora:auth-lost', onLost);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authJson<{ token: string; user: AuthUser }>('/api/auth/login', {
      email,
      password,
    });
    setStoredAccessToken(data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const data = await authJson<{ token: string; user: AuthUser }>('/api/auth/register', {
      email,
      password,
      name: name?.trim() || undefined,
    });
    setStoredAccessToken(data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    setStoredAccessToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      ready,
      isApiConfigured: apiOn,
      login,
      register,
      logout,
    }),
    [user, token, ready, apiOn, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
