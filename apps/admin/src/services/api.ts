import type { ApiErrorBody, AuthResponse } from "@recomptrack/shared";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "") + "/api";

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
 * The access token lives in memory only (never localStorage). The refresh token is an
 * httpOnly cookie the browser sends to /api/auth; on reload we call /auth/refresh to
 * get a new access token.
 */
let accessToken: string | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;
let onSessionLost: () => void = () => {};

export function setSessionLostHandler(fn: () => void) {
  onSessionLost = fn;
}
export function setAccessToken(token: string | null) {
  accessToken = token;
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

export async function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-RecompTrack-Client": "web" },
    body: "{}",
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as AuthResponse;
      accessToken = data.accessToken;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query; retry?: boolean } = {},
): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      "X-RecompTrack-Client": "web",
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && options.retry !== false && !path.startsWith("/auth/")) {
    const renewed = await refreshSession();
    if (renewed) return api<T>(path, { ...options, retry: false });
    accessToken = null;
    onSessionLost();
  }
  return parse(res) as Promise<T>;
}
