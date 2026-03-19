"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AuthUser,
  fetchHouseholds,
  login as apiLogin,
  refreshToken as apiRefresh,
  setAuthToken,
  setRefreshFunction,
  setLogoutFunction,
} from "@/lib/api";

interface AuthData {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  householdId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  householdId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_AUTH: AuthData = { user: null, accessToken: null, refreshToken: null, householdId: null };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthData>(EMPTY_AUTH);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const authRef = useRef(auth);
  authRef.current = auth;

  // Restore auth from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("jarvis_auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        const restored: AuthData = {
          user: parsed.user ?? null,
          accessToken: parsed.accessToken ?? null,
          refreshToken: parsed.refreshToken ?? null,
          householdId: parsed.householdId ?? null,
        };
        setAuth(restored);
        setAuthToken(restored.accessToken);
      }
    } catch {
      localStorage.removeItem("jarvis_auth");
    }
    setHydrated(true);
  }, []);

  const persistAuth = useCallback((data: AuthData) => {
    setAuth(data);
    setAuthToken(data.accessToken);
    localStorage.setItem("jarvis_auth", JSON.stringify(data));
  }, []);

  const logout = useCallback(() => {
    setAuth({ user: null, accessToken: null, refreshToken: null, householdId: null });
    setAuthToken(null);
    localStorage.removeItem("jarvis_auth");
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const res = await apiLogin(email, password);
        setAuthToken(res.access_token);
        const households = await fetchHouseholds(res.access_token);
        const hId = households.length > 0 ? households[0].id : null;
        persistAuth({
          user: res.user,
          accessToken: res.access_token,
          refreshToken: res.refresh_token,
          householdId: hId,
        });
      } finally {
        setLoading(false);
      }
    },
    [persistAuth],
  );

  // If authenticated but no householdId (e.g. old localStorage), fetch it
  useEffect(() => {
    if (!auth.accessToken || auth.householdId) return;
    fetchHouseholds(auth.accessToken).then((households) => {
      if (households.length > 0) {
        persistAuth({ ...authRef.current, householdId: households[0].id });
      }
    }).catch(() => {});
  }, [auth.accessToken, auth.householdId, persistAuth]);

  // Wire up axios interceptor refresh
  useEffect(() => {
    setRefreshFunction(async () => {
      const rt = authRef.current.refreshToken;
      if (!rt) return null;
      try {
        const res = await apiRefresh(rt);
        persistAuth({
          ...authRef.current,
          user: res.user,
          accessToken: res.access_token,
          refreshToken: res.refresh_token,
        });
        return res.access_token;
      } catch {
        logout();
        return null;
      }
    });
    setLogoutFunction(logout);
  }, [persistAuth, logout]);

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        accessToken: auth.accessToken,
        householdId: auth.householdId,
        loading: loading || !hydrated,
        login,
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
