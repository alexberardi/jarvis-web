"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AuthUser,
  Household,
  fetchHouseholds,
  login as apiLogin,
  register as apiRegister,
  refreshToken as apiRefresh,
  switchHousehold as apiSwitchHousehold,
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
  households: Household[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username?: string, inviteCode?: string) => Promise<void>;
  logout: () => void;
  switchHousehold: (householdId: string) => Promise<void>;
  refreshHouseholds: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_AUTH: AuthData = { user: null, accessToken: null, refreshToken: null, householdId: null };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthData>(EMPTY_AUTH);
  const [households, setHouseholds] = useState<Household[]>([]);
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

  const registerUser = useCallback(
    async (email: string, password: string, username?: string, inviteCode?: string) => {
      setLoading(true);
      try {
        const res = await apiRegister(email, password, username, inviteCode);
        const data: AuthData = {
          user: res.user,
          accessToken: res.access_token,
          refreshToken: res.refresh_token,
          householdId: res.household_id,
        };
        persistAuth(data);
        setAuthToken(res.access_token);
        const hh = await fetchHouseholds(res.access_token);
        setHouseholds(hh);
      } finally {
        setLoading(false);
      }
    },
    [persistAuth],
  );

  const refreshHouseholds = useCallback(async () => {
    const token = authRef.current.accessToken;
    if (!token) return;
    const hh = await fetchHouseholds(token);
    setHouseholds(hh);
  }, []);

  const doSwitchHousehold = useCallback(
    async (targetHouseholdId: string) => {
      const res = await apiSwitchHousehold(targetHouseholdId);
      persistAuth({
        ...authRef.current,
        accessToken: res.access_token,
        householdId: res.household_id,
      });
    },
    [persistAuth],
  );

  // If authenticated but no householdId (e.g. old localStorage), fetch it
  useEffect(() => {
    if (!auth.accessToken) return;
    fetchHouseholds(auth.accessToken).then((hh) => {
      setHouseholds(hh);
      if (!auth.householdId && hh.length > 0) {
        persistAuth({ ...authRef.current, householdId: hh[0].id });
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
        households,
        loading: loading || !hydrated,
        login,
        register: registerUser,
        logout,
        switchHousehold: doSwitchHousehold,
        refreshHouseholds,
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
