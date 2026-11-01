import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthResponse, MeDTO } from "@recomptrack/shared";
import { api, clearSession, getStoredRefreshToken, refreshSession, setSessionLostHandler, storeSession } from "../services/api";

interface AuthState {
  me: MeDTO | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  reloadMe: () => Promise<void>;
  setMe: (me: MeDTO) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeDTO | null>(null);
  const [ready, setReady] = useState(false);

  const reloadMe = useCallback(async () => {
    setMe(await api<MeDTO>("/users/me"));
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => setMe(null));
    (async () => {
      try {
        if ((await getStoredRefreshToken()) && (await refreshSession())) await reloadMe();
      } catch {
        // stay signed out
      } finally {
        setReady(true);
      }
    })();
  }, [reloadMe]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await storeSession(await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password, clientType: "mobile" } }));
      await reloadMe();
    },
    [reloadMe],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await storeSession(
        await api<AuthResponse>("/auth/register", { method: "POST", body: { name, email, password, clientType: "mobile" } }),
      );
      await reloadMe();
    },
    [reloadMe],
  );

  const signOut = useCallback(async () => {
    const refreshToken = await getStoredRefreshToken();
    await api("/auth/logout", { method: "POST", body: refreshToken ? { refreshToken } : {} }).catch(() => undefined);
    await clearSession();
    setMe(null);
  }, []);

  const value = useMemo(
    () => ({ me, ready, signIn, register, signOut, reloadMe, setMe }),
    [me, ready, signIn, register, signOut, reloadMe],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
