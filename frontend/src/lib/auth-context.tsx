"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { TokenPair, User } from "./types";

const TOKEN_KEY = "gj_access_token";
const REFRESH_KEY = "gj_refresh_token";

// Access tokens live 30 min on the backend; refresh a bit ahead of that so a
// tab left open never hits an expired token.
const REFRESH_INTERVAL_MS = 20 * 60 * 1000;

interface AuthContextValue {
  user: User | null;
  token: string | null;
  ready: boolean;
  customerLogin: (identifier: string, password: string) => Promise<void>;
  customerSignup: (input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }) => Promise<void>;
  ownerLogin: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
  }, []);

  const persist = useCallback((pair: TokenPair) => {
    try {
      localStorage.setItem(TOKEN_KEY, pair.access_token);
      localStorage.setItem(REFRESH_KEY, pair.refresh_token);
    } catch {
      /* ignore */
    }
    setToken(pair.access_token);
  }, []);

  const hydrate = useCallback(async (t: string) => {
    const me = await api<User>("/api/auth/me", { token: t });
    setUser(me);
  }, []);

  // Exchange the stored refresh token for a fresh access+refresh pair.
  // Returns the new access token, or null if refresh isn't possible.
  const refreshTokens = useCallback(async (): Promise<string | null> => {
    const refresh = readKey(REFRESH_KEY);
    if (!refresh) return null;
    try {
      const pair = await api<TokenPair>("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refresh }),
      });
      persist(pair);
      return pair.access_token;
    } catch {
      return null;
    }
  }, [persist]);

  // On mount: prefer refreshing (gets a guaranteed-fresh access token) over
  // trusting a possibly-expired stored access token.
  useEffect(() => {
    (async () => {
      const refreshed = await refreshTokens();
      const active = refreshed ?? readKey(TOKEN_KEY);
      if (active) {
        setToken(active);
        try {
          await hydrate(active);
        } catch {
          clear();
        }
      }
      setReady(true);
    })();
  }, [refreshTokens, hydrate, clear]);

  const finish = useCallback(
    async (pair: TokenPair) => {
      persist(pair);
      await hydrate(pair.access_token);
    },
    [persist, hydrate],
  );

  const customerLogin = useCallback(
    async (identifier: string, password: string) => {
      const pair = await api<TokenPair>("/api/auth/customer/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      await finish(pair);
    },
    [finish],
  );

  const customerSignup = useCallback<AuthContextValue["customerSignup"]>(
    async (input) => {
      const pair = await api<TokenPair>("/api/auth/customer/signup", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await finish(pair);
    },
    [finish],
  );

  const ownerLogin = useCallback(
    async (identifier: string, password: string) => {
      const pair = await api<TokenPair>("/api/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      await finish(pair);
    },
    [finish],
  );

  const logout = useCallback(() => {
    clear();
  }, [clear]);

  // Keep the session alive while a tab is open: refresh on a timer, and again
  // whenever the tab regains focus (covers laptop sleep / long idle).
  const userId = user?.id ?? null;
  useEffect(() => {
    if (userId === null) return;

    const id = window.setInterval(() => {
      void refreshTokens();
    }, REFRESH_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshTokens();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, refreshTokens]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        ready,
        customerLogin,
        customerSignup,
        ownerLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
