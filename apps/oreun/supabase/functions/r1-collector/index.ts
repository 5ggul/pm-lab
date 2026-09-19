import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Target = {
  universe_id: number | string;
  failure_count: number;
  cadence_minutes: number;
};

type RobloxGame = {
  id: number;
  rootPlaceId: number;
  name: string;
  description?: string;
  creator?: { name?: string };
  playing?: number;
  visits?: number;
  favoritedCount?: number;
  updated?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ROBLOX_ENDPOINT = "https://games.roblox.com/v1/games";

function adminKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed?.default) return String(parsed.default);
    } catch {
      // Fall through to legacy key.
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Supabase admin key unavailable");
  return legacy;
}

const KEY = adminKey();
const restHeaders = () => {
  const headers: Record<string, string> = {
    apikey: KEY,
    "content-type": "application/json",
    accept: "application/json",
  };
  if (!KEY.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${KEY}`;
  }
  return headers;
};

async function rest<T>(
  path: string,
  init: RequestInit = {},
  query?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(path, SUPABASE_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    ...init,
    headers: { ...restHeaders(), ...(init.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${response.status} ${path}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) as T : undefined as T;
}

function cadence(playing: number | null) {
  if ((playing ?? 0) >= 100000) return 5;
  if ((playing ?? 0) >= 20000) return 15;
  if ((playing ?? 0) >= 2000) return 30;
  return 120;
}

async function fetchRoblox(ids: number[]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `${ROBLOX_ENDPOINT}?universeIds=${ids.join(",")}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Oreun-R1-Supabase-Preview/0.1" },
      signal: controller.signal,
    });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") || 0) || null;
      return { kind: "rate_limited" as const, retryAfter, games: [] as RobloxGame[] };
    }
    if (!response.ok) {
      throw new Error(`Roblox API ${response.status}`);
    }
    const body = await response.json() as { data?: RobloxGame[] };
    return { kind: "ok" as const, retryAfter: null, games: body.data ?? [] };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST required" }, { status: 405 });
  }

  const startedAt = Date.now();
  const leaseToken = crypto.randomUUID();
  let runId: string | null = null;

  try {
    const targets = await rest<Target[]>("/rest/v1/rpc/r1_claim_due_games", {
      method: "POST",
      body: JSON.stringify({
        p_limit: 100,
        p_lease_token: leaseToken,
        p_lease_seconds: 180,
      }),
    });

    if (!targets.length) {
      return Response.json({ status: "idle", requested: 0, success: 0, failed: 0 });
    }

    const sources = await rest<Array<{ id: number }>>("/rest/v1/data_sources", {}, {
      select: "id",
      provider: "eq.roblox_public_games",
      endpoint: "eq.https://games.roblox.com/v1/games",
      limit: 1,
    });
    const sourceId = Number(sources[0]?.id);
    if (!sourceId) throw new Error("roblox_public_games source missing");

    const runs = await rest<Array<{ id: string }>>("/rest/v1/ingestion_runs", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        data_source_id: sourceId,
        started_at: new Date().toISOString(),
        status: "running",
        requested_count: targets.length,
      }),
    });
    runId = runs[0]?.id ?? null;
    if (!runId) throw new Error("failed to create ingestion run");

    let success = 0;
    let failed = 0;
    let rateLimited = 0;
    let retryAfterSeconds: number | null = null;
    const errors: string[] = [];
    const latencies: number[] = [];

    for (let offset = 0; offset < targets.length; offset += 20) {
      const batch = targets.slice(offset, offset + 20);
      const ids = batch.map((target) => Number(target.universe_id));
      const batchStarted = Date.now();

      try {
        const result = await fetchRoblox(ids);
        latencies.push(Date.now() - batchStarted);

        if (result.kind === "rate_limited") {
          failed += ids.length;
          rateLimited += ids.length;
          retryAfterSeconds = Math.max(retryAfterSeconds ?? 0, result.retryAfter ?? 0) || null;
          errors.push(`429 retry-after=${result.retryAfter ?? "unknown"}`);
          await rest("/rest/v1/rpc/r1_mark_targets_failed", {
            method: "POST",
            body: JSON.stringify({
              p_universe_ids: ids,
              p_lease_token: leaseToken,
              p_error: "Roblox provider rate limited",
              p_retry_after_seconds: result.retryAfter,
            }),
          });
          continue;
        }

        const fetchedAt = new Date().toISOString();
        const found = new Set(result.games.map((game) => game.id));
        const observations = result.games.map((game) => ({
          universe_id: game.id,
          root_place_id: game.rootPlaceId,
          name: game.name,
          description: game.description ?? "",
          creator_name: game.creator?.name ?? "알 수 없음",
          playing: Number.isFinite(game.playing) ? game.playing : null,
          visits: Number.isFinite(game.visits) ? game.visits : null,
          favorites: Number.isFinite(game.favoritedCount) ? game.favoritedCount : null,
          source_updated_at: game.updated ?? null,
          fetched_at: fetchedAt,
          freshness_state: "fresh",
          cadence_minutes: cadence(Number.isFinite(game.playing) ? game.playing! : null),
        }));

        await rest("/rest/v1/rpc/r1_persist_game_observations", {
          method: "POST",
          body: JSON.stringify({
            p_ingestion_run_id: runId,
            p_data_source_id: sourceId,
            p_lease_token: leaseToken,
            p_observations: observations,
          }),
        });
        success += observations.length;

        const missing = ids.filter((id) => !found.has(id));
        if (missing.length) {
          failed += missing.length;
          errors.push(`missing ids: ${missing.join(",")}`);
          await rest("/rest/v1/rpc/r1_mark_targets_failed", {
            method: "POST",
            body: JSON.stringify({
              p_universe_ids: missing,
              p_lease_token: leaseToken,
              p_error: "provider response omitted requested universe",
              p_retry_after_seconds: null,
            }),
          });
        }
      } catch (error) {
        latencies.push(Date.now() - batchStarted);
        failed += ids.length;
        const message = error instanceof Error ? error.message : "unknown provider error";
        errors.push(message);
        await rest("/rest/v1/rpc/r1_mark_targets_failed", {
          method: "POST",
          body: JSON.stringify({
            p_universe_ids: ids,
            p_lease_token: leaseToken,
            p_error: message,
            p_retry_after_seconds: null,
          }),
        });
      }
    }

    const sorted = latencies.slice().sort((a, b) => a - b);
    const percentile = (p: number) => sorted.length
      ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))]
      : null;
    const status = success === targets.length
      ? "success"
      : success > 0
        ? "partial"
        : rateLimited > 0
          ? "rate_limited"
          : "failed";

    await rest("/rest/v1/ingestion_runs", {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        finished_at: new Date().toISOString(),
        status,
        requested_count: targets.length,
        success_count: success,
        failure_count: failed,
        rate_limit_count: rateLimited,
        retry_after_seconds: retryAfterSeconds,
        latency_p50_ms: percentile(0.5),
        latency_p95_ms: percentile(0.95),
        error_summary: errors.slice(0, 100),
      }),
    }, { id: `eq.${runId}` });

    let rollup = null;
    if (success > 0) {
      rollup = await rest("/rest/v1/rpc/r1_refresh_rollups", {
        method: "POST",
        body: JSON.stringify({
          p_from: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          p_to: new Date().toISOString(),
        }),
      });
    }

    return Response.json({
      status,
      runId,
      requested: targets.length,
      success,
      failed,
      rateLimited,
      retryAfterSeconds,
      durationMs: Date.now() - startedAt,
      rollup,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    if (runId) {
      try {
        await rest("/rest/v1/ingestion_runs", {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            finished_at: new Date().toISOString(),
            status: "failed",
            error_summary: [error instanceof Error ? error.message : "fatal collector error"],
          }),
        }, { id: `eq.${runId}` });
      } catch {
        // Preserve the original error.
      }
    }
    return Response.json(
      {
        status: "failed",
        error: error instanceof Error ? error.message : "collector failed",
      },
      { status: 500 },
    );
  }
});
