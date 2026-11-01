import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ROLES, type AuthResponse, type UserDTO } from "@recomptrack/shared";
import { api, refreshSession, setAccessToken, setSessionLostHandler } from "../services/api";

interface AuthState {
  user: UserDTO | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    refreshSession()
      .then((s) => setUser(s && s.user.role === ROLES.ADMIN ? s.user : null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password, clientType: "web" } });
      if (res.user.role !== ROLES.ADMIN) {
        setAccessToken(res.accessToken);
        await logout();
        throw new Error("This panel is for administrators only. Use the RecompTrack mobile app.");
      }
      setAccessToken(res.accessToken);
      setUser(res.user);
    },
    [logout],
  );

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
