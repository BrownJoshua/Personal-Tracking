import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { ApiErrorBody, AuthResponse } from "@recomptrack/shared";

const BASE = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "") + "/api";
const REFRESH_KEY = "recomptrack.refreshToken";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.details ?? []).map((d) => [d.path, d.message]));
  }
}

/**
 * Access token: memory only. Refresh token: iOS Keychain / Android Keystore via SecureStore.
 * The user id is never sent by the app — the server derives it from the token.
 */
let accessToken: string | null = null;
/** Web preview only: SecureStore isn't available in browsers, and localStorage is not safe for tokens. */
let webRefreshToken: string | null = null;
const isWeb = Platform.OS === "web";
let refreshing: Promise<AuthResponse | null> | null = null;
let onSessionLost: () => void = () => {};

export const setSessionLostHandler = (fn: () => void) => {
  onSessionLost = fn;
};

export async function storeSession(res: AuthResponse) {
  accessToken = res.accessToken;
  if (!res.refreshToken) return;
  if (isWeb) webRefreshToken = res.refreshToken;
  else await SecureStore.setItemAsync(REFRESH_KEY, res.refreshToken);
}

export async function clearSession() {
  accessToken = null;
  if (isWeb) webRefreshToken = null;
  else await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getStoredRefreshToken() {
  return isWeb ? webRefreshToken : SecureStore.getItemAsync(REFRESH_KEY);
}

async function parse(res: Response) {
  if (res.status === 204) return undefined;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? "HTTP_ERROR", err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return body;
}

/** Exchange the stored refresh token for a new pair. Concurrent callers share one request. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.status === 401 || res.status === 403) {
        await clearSession();
        return null;
      }
      if (!res.ok) return null; // server trouble: keep the token and try again later
      const data = (await res.json()) as AuthResponse;
      await storeSession(data);
      return data;
    } catch {
      return null; // offline
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query; retry?: boolean } = {},
): Promise<T> {
  const qs = Object.entries(options.query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401 && options.retry !== false && !path.startsWith("/auth/")) {
    if (await refreshSession()) return api<T>(path, { ...options, retry: false });
    await clearSession();
    onSessionLost();
  }
  return parse(res) as Promise<T>;
}
