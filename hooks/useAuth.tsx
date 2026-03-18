"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  AuthUser,
  fetchHouseholds,
  login as apiLogin,
  refreshToken as apiRefresh,
  setAuthToken,
  setRefreshFunction,
  setLogoutFunction,
} from "@/lib/api";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  householdId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("jarvis_auth");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed.user);
        setAccessToken(parsed.accessToken);
        setRefreshTokenValue(parsed.refreshToken);
        setHouseholdId(parsed.householdId ?? null);
        setAuthToken(parsed.accessToken);
      } catch {
        localStorage.removeItem("jarvis_auth");
      }
    }
    setLoading(false);
  }, []);

  // If authenticated but no householdId (e.g. old localStorage), fetch it
  useEffect(() => {
    if (accessToken && !householdId) {
      fetchHouseholds(accessToken).then((households) => {
        if (households.length > 0) {
          const hId = households[0].id;
          setHouseholdId(hId);
          // Update localStorage
          const stored = localStorage.getItem("jarvis_auth");
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.householdId = hId;
            localStorage.setItem("jarvis_auth", JSON.stringify(parsed));
          }
        }
      }).catch(() => {});
    }
  }, [accessToken, householdId]);

  const persist = useCallback(
    (u: AuthUser, at: string, rt: string, hId: string | null) => {
      setUser(u);
      setAccessToken(at);
      setRefreshTokenValue(rt);
      setHouseholdId(hId);
      setAuthToken(at);
      localStorage.setItem(
        "jarvis_auth",
        JSON.stringify({ user: u, accessToken: at, refreshToken: rt, householdId: hId }),
      );
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshTokenValue(null);
    setHouseholdId(null);
    setAuthToken(null);
    localStorage.removeItem("jarvis_auth");
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiLogin(email, password);
      // Fetch households and auto-select first one
      setAuthToken(res.access_token);
      const households = await fetchHouseholds(res.access_token);
      const hId = households.length > 0 ? households[0].id : null;
      persist(res.user, res.access_token, res.refresh_token, hId);
    },
    [persist],
  );

  // Wire up interceptor refresh
  useEffect(() => {
    setRefreshFunction(async () => {
      if (!refreshTokenValue) return null;
      try {
        const res = await apiRefresh(refreshTokenValue);
        persist(res.user, res.access_token, res.refresh_token, householdId);
        return res.access_token;
      } catch {
        logout();
        return null;
      }
    });
    setLogoutFunction(logout);
  }, [refreshTokenValue, householdId, persist, logout]);

  return (
    <AuthContext.Provider value={{ user, accessToken, householdId, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
