type QueryValue = string | number | boolean | null | undefined;

export interface SupabaseRestConfig {
  url: string;
  secretKey: string;
}

export function getSupabaseRestConfig(env: NodeJS.ProcessEnv = process.env): SupabaseRestConfig | null {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) return null;
  return { url: url.replace(/\/$/, ""), secretKey };
}

export class SupabaseRestClient {
  constructor(private readonly config: SupabaseRestConfig) {}

  private async request<T>(
    path: string,
    init: RequestInit = {},
    query?: Record<string, QueryValue>,
  ): Promise<T> {
    const url = new URL(path, this.config.url);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const headers = new Headers(init.headers);
    headers.set("apikey", this.config.secretKey);
    headers.set("authorization", `Bearer ${this.config.secretKey}`);
    headers.set("accept", "application/json");
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

    const response = await fetch(url, { ...init, headers, cache: "no-store" });
    const body = await response.text();
    if (!response.ok) {
      const safeBody = body.slice(0, 800);
      throw new Error(`Supabase REST ${response.status} ${path}: ${safeBody}`);
    }
    if (!body) return undefined as T;
    return JSON.parse(body) as T;
  }

  select<T>(table: string, query: Record<string, QueryValue>) {
    return this.request<T[]>(`/rest/v1/${table}`, {}, query);
  }

  insert<T>(table: string, rows: unknown, returning = true) {
    return this.request<T[]>(
      `/rest/v1/${table}`,
      {
        method: "POST",
        headers: {
          Prefer: returning ? "return=representation" : "return=minimal",
        },
        body: JSON.stringify(rows),
      },
    );
  }

  patch<T>(
    table: string,
    values: unknown,
    query: Record<string, QueryValue>,
    returning = false,
  ) {
    return this.request<T[]>(
      `/rest/v1/${table}`,
      {
        method: "PATCH",
        headers: {
          Prefer: returning ? "return=representation" : "return=minimal",
        },
        body: JSON.stringify(values),
      },
      query,
    );
  }

  rpc<T>(functionName: string, args: Record<string, unknown> = {}) {
    return this.request<T>(
      `/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        body: JSON.stringify(args),
      },
    );
  }
}
