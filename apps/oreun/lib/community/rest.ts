type QueryValue = string | number | boolean | null | undefined;

export function communityConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url: url.replace(/\/$/, ""), publishableKey };
}

export async function communityRequest<T>({
  path,
  token,
  query,
  init = {},
}: {
  path: string;
  token?: string | null;
  query?: Record<string, QueryValue>;
  init?: RequestInit;
}): Promise<T> {
  const config = communityConfig();
  if (!config) throw new Error("Community database is not configured.");

  const url = new URL(
    path.startsWith("/") ? path : `/rest/v1/${path}`,
    config.url,
  );
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers(init.headers);
  headers.set("apikey", config.publishableKey);
  headers.set("accept", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text.slice(0, 500);
    try {
      const parsed = JSON.parse(text);
      message = parsed?.message || parsed?.hint || message;
    } catch {}
    throw new Error(message || `Community HTTP ${response.status}`);
  }

  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function publicSelect<T>(
  table: string,
  query: Record<string, QueryValue>,
) {
  return communityRequest<T[]>({ path: table, query });
}

export function userSelect<T>(
  table: string,
  token: string,
  query: Record<string, QueryValue>,
) {
  return communityRequest<T[]>({ path: table, token, query });
}

export function userInsert<T>(
  table: string,
  token: string,
  body: unknown,
) {
  return communityRequest<T[]>({
    path: table,
    token,
    init: {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    },
  });
}

export function userPatch<T>(
  table: string,
  token: string,
  query: Record<string, QueryValue>,
  body: unknown,
) {
  return communityRequest<T[]>({
    path: table,
    token,
    query,
    init: {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    },
  });
}

export function userDelete(
  table: string,
  token: string,
  query: Record<string, QueryValue>,
) {
  return communityRequest<void>({
    path: table,
    token,
    query,
    init: { method: "DELETE", headers: { Prefer: "return=minimal" } },
  });
}

export function userRpc<T>(
  functionName: string,
  token: string,
  body: Record<string, unknown> = {},
) {
  return communityRequest<T>({
    path: `/rest/v1/rpc/${functionName}`,
    token,
    init: {
      method: "POST",
      body: JSON.stringify(body),
    },
  });
}
