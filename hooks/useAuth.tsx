"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AuthUser,
  Household,
  changePassword as apiChangePassword,
  fetchHouseholds,
  login as apiLogin,
  register as apiRegister,
  refreshToken as apiRefresh,
  serverLogout,
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
  /** Session opened with an admin-issued temporary password — gate on
   *  /change-password until a real one is set. */
  mustChangePassword: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  householdId: string | null;
  households: Household[];
  loading: boolean;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  register: (email: string, password: string, username?: string, inviteCode?: string) => Promise<void>;
  /** `currentPassword` may be omitted right after a temp-password login (the
   *  login form's password is held in memory); after a reload it's required. */
  changePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  hasTempPassword: () => boolean;
  logout: () => void;
  switchHousehold: (householdId: string) => Promise<void>;
  refreshHouseholds: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_AUTH: AuthData = {
  user: null,
  accessToken: null,
  refreshToken: null,
  householdId: null,
  mustChangePassword: false,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthData>(EMPTY_AUTH);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const authRef = useRef(auth);
  authRef.current = auth;

  // Memory-only (never persisted): lets /change-password submit the temp
  // password without the user retyping it. Gone after a reload — the page
  // then asks for the current (temp) password.
  const tempPasswordRef = useRef<string | null>(null);

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
          mustChangePassword: parsed.mustChangePassword ?? false,
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
    // Best-effort server-side revoke (fire-and-forget): ends this session's
    // refresh-token family instead of leaving it valid for 14 more days.
    const rt = authRef.current.refreshToken;
    if (rt) {
      serverLogout(rt).catch(() => {});
    }
    tempPasswordRef.current = null;
    setAuth(EMPTY_AUTH);
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
        const mustChangePassword = !!res.must_change_password;
        tempPasswordRef.current = mustChangePassword ? password : null;
        persistAuth({
          user: res.user,
          accessToken: res.access_token,
          refreshToken: res.refresh_token,
          householdId: hId,
          mustChangePassword,
        });
        return { mustChangePassword };
      } finally {
        setLoading(false);
      }
    },
    [persistAuth],
  );

  const changePassword = useCallback(
    async (newPassword: string, currentPassword?: string) => {
      const current = currentPassword ?? tempPasswordRef.current;
      if (!current) throw new Error("Current password is required.");
      const res = await apiChangePassword(current, newPassword);
      // Adopt the fresh pair — the server revoked every other session.
      setAuthToken(res.access_token);
      tempPasswordRef.current = null;
      persistAuth({
        ...authRef.current,
        user: res.user,
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        mustChangePassword: false,
      });
    },
    [persistAuth],
  );

  const hasTempPassword = useCallback(() => tempPasswordRef.current != null, []);

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
          mustChangePassword: false,
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
        mustChangePassword: auth.mustChangePassword,
        login,
        register: registerUser,
        changePassword,
        hasTempPassword,
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
