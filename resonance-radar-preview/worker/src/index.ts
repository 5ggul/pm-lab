import { alertReason, sendTelegram } from "./alerts";
import {
  finishCollectorRun,
  getActiveRadarTokens,
  getCollectorState,
  getCurrentRadar,
  getTradesForToken,
  insertSignalEvent,
  insertTrades,
  setCollectorState,
  startCollectorRun,
  upsertRadar
} from "./db";
import { fetchProviderBatch, normalizeTrade } from "./provider";
import { calculateRadarState } from "./scoring";
import type { Env, NormalizedTrade } from "./types";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});

async function processTrades(env: Env, trades: NormalizedTrade[], includeActiveRadar = false) {
  const inserted = await insertTrades(env, trades);
  const keys = new Map<string, { chain: string; tokenAddress: string }>();
  for (const trade of trades) keys.set(`${trade.chain}:${trade.tokenAddress}`, { chain: trade.chain, tokenAddress: trade.tokenAddress });

  if (includeActiveRadar) {
    const activeSince = new Date(Date.now() - 60 * 60_000).toISOString();
    for (const row of await getActiveRadarTokens(env, activeSince)) {
      keys.set(`${row.chain}:${row.tokenAddress}`, row);
    }
  }

  const lowLiquidity = Number(env.LOW_LIQUIDITY_USD ?? 150_000);
  const nowIso = new Date().toISOString();
  const since60 = new Date(Date.now() - 60 * 60_000).toISOString();
  let alerts = 0;

  for (const { chain, tokenAddress } of keys.values()) {
    const [history, previous] = await Promise.all([
      getTradesForToken(env, chain, tokenAddress, since60),
      getCurrentRadar(env, chain, tokenAddress)
    ]);
    const state = calculateRadarState(history, nowIso, lowLiquidity, previous?.signal_type as any);
    if (!state) continue;

    const reason = alertReason(previous, state, env);
    await upsertRadar(env, state);
    if (reason) {
      await insertSignalEvent(env, state, reason);
      await sendTelegram(env, state, reason);
      alerts += 1;
    }
  }

  return { inserted, affectedTokens: keys.size, alerts };
}

async function collect(env: Env) {
  const source = env.PROVIDER_NAME ?? "generic";
  const runId = await startCollectorRun(env, source);
  const started = Date.now();

  try {
    if (!env.DATA_PROVIDER_URL) {
      await finishCollectorRun(env, runId, {
        status: "noop",
        events_received: 0,
        events_inserted: 0,
        api_latency_ms: 0,
        error: "DATA_PROVIDER_URL not configured"
      });
      return { ok: true, mode: "noop", inserted: 0 };
    }

    const state = await getCollectorState(env);
    const fallbackSince = new Date(Date.now() - 2 * 60_000).toISOString();
    const lastTimestamp = typeof state.last_timestamp === "string" ? state.last_timestamp : fallbackSince;
    // Deliberate overlap protects against provider clock skew / late-arriving events. UNIQUE(provider_trade_id) dedupes repeats.
    const lastMs = new Date(lastTimestamp).getTime();
    const since = Number.isFinite(lastMs) ? new Date(lastMs - 90_000).toISOString() : fallbackSince;
    const cursor = typeof state.cursor === "string" ? state.cursor : null;

    const providerStarted = Date.now();
    const batch = await fetchProviderBatch(env, since, cursor);
    const apiLatencyMs = Date.now() - providerStarted;
    const processed = await processTrades(env, batch.trades, true);

    const maxExecuted = batch.trades.reduce((latest, trade) => trade.executedAt > latest ? trade.executedAt : latest, lastTimestamp);
    await setCollectorState(env, {
      last_timestamp: maxExecuted,
      cursor: batch.nextCursor ?? cursor,
      source_timestamp: batch.sourceTimestamp ?? null,
      updated_at: new Date().toISOString()
    });

    await finishCollectorRun(env, runId, {
      status: "ok",
      events_received: batch.trades.length,
      events_inserted: processed.inserted,
      affected_tokens: processed.affectedTokens,
      alerts_sent: processed.alerts,
      api_latency_ms: apiLatencyMs,
      duration_ms: Date.now() - started,
      error: null
    });

    return { ok: true, received: batch.trades.length, ...processed, apiLatencyMs };
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    await finishCollectorRun(env, runId, {
      status: "error",
      events_received: 0,
      events_inserted: 0,
      duration_ms: Date.now() - started,
      error: message.slice(0, 2000)
    });
    throw error;
  }
}

async function handleWebhook(request: Request, env: Env) {
  const body = await request.json() as unknown;
  const items = Array.isArray(body) ? body : Array.isArray((body as any)?.trades) ? (body as any).trades : [(body as any)?.trade ?? body];
  const trades = items
    .filter((item: unknown): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item: Record<string, unknown>) => normalizeTrade(item, env))
    .filter((item: NormalizedTrade | null): item is NormalizedTrade => item !== null);
  const result = await processTrades(env, trades);
  return json({ ok: true, received: trades.length, ...result });
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(collect(env));
  },

  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "resonance-radar-collector", cron: "* * * * *", providerConfigured: !!env.DATA_PROVIDER_URL });
    }

    if (url.pathname === "/webhook" && request.method === "POST") {
      const supplied = request.headers.get("x-collector-secret") ?? url.searchParams.get("secret");
      if (!env.COLLECTOR_SECRET || supplied !== env.COLLECTOR_SECRET) return json({ ok: false, error: "unauthorized" }, 401);
      return await handleWebhook(request, env);
    }

    if (url.pathname === "/run" && request.method === "POST") {
      const supplied = request.headers.get("x-collector-secret") ?? url.searchParams.get("secret");
      if (!env.COLLECTOR_SECRET || supplied !== env.COLLECTOR_SECRET) return json({ ok: false, error: "unauthorized" }, 401);
      return json(await collect(env));
    }

    return json({ ok: false, error: "not found" }, 404);
  }
} satisfies ExportedHandler<Env>;
