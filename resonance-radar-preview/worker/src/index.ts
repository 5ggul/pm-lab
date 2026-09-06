import { alertReason, sendTelegram } from "./alerts";
import {
  finishCollectorRun,
  getActiveRadarTokens,
  getCollectorState,
  getCurrentRadar,
  getState,
  getTrackedWallets,
  getTradesForToken,
  insertSignalEvent,
  insertTrades,
  setCollectorState,
  setState,
  startCollectorRun,
  upsertRadar,
  upsertTrackedWallet
} from "./db";
import { normalizeHeliusWebhook, syncHeliusWebhook } from "./helius";
import { fetchProviderBatch, normalizeTrade } from "./provider";
import { calculateRadarState } from "./scoring";
import type { Env, NormalizedTrade } from "./types";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});

const authorized = (request: Request, env: Env, url: URL) => {
  const supplied = request.headers.get("x-collector-secret") ?? url.searchParams.get("secret");
  return !!env.COLLECTOR_SECRET && supplied === env.COLLECTOR_SECRET;
};

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
  const source = env.DATA_PROVIDER_URL ? (env.PROVIDER_NAME ?? "generic") : "window-decay";
  const runId = await startCollectorRun(env, source);
  const started = Date.now();

  try {
    if (!env.DATA_PROVIDER_URL) {
      const processed = await processTrades(env, [], true);
      await finishCollectorRun(env, runId, {
        status: "ok",
        events_received: 0,
        events_inserted: 0,
        affected_tokens: processed.affectedTokens,
        alerts_sent: processed.alerts,
        api_latency_ms: 0,
        duration_ms: Date.now() - started,
        error: null
      });
      return { ok: true, mode: "window-decay", ...processed };
    }

    const state = await getCollectorState(env);
    const fallbackSince = new Date(Date.now() - 2 * 60_000).toISOString();
    const lastTimestamp = typeof state.last_timestamp === "string" ? state.last_timestamp : fallbackSince;
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

async function parseGenericWebhookBody(body: unknown, env: Env) {
  const objectBody = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const items = Array.isArray(body)
    ? body
    : Array.isArray(objectBody.trades)
      ? objectBody.trades
      : [objectBody.trade ?? body];
  return items
    .filter((item: unknown): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item: Record<string, unknown>) => normalizeTrade(item, env))
    .filter((item: NormalizedTrade | null): item is NormalizedTrade => item !== null);
}

async function processHeliusPayload(payload: unknown, env: Env) {
  const wallets = await getTrackedWallets(env, "solana");
  const trades = await normalizeHeliusWebhook(payload, wallets);
  return await processTrades(env, trades);
}

async function syncHelius(env: Env) {
  const wallets = await getTrackedWallets(env, "solana");
  const state = await getState(env, "helius");
  const previousId = typeof state.webhook_id === "string" ? state.webhook_id : null;
  const result = await syncHeliusWebhook(env, wallets, previousId);
  await setState(env, "helius", {
    webhook_id: result.webhookId,
    address_count: result.addresses,
    synced_at: new Date().toISOString()
  });
  return { ok: true, webhookId: result.webhookId, addresses: result.addresses };
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(collect(env));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      const wallets = await getTrackedWallets(env, "solana").catch(() => []);
      return json({
        ok: true,
        service: "resonance-radar-collector",
        cron: "* * * * *",
        providerConfigured: !!env.DATA_PROVIDER_URL,
        heliusConfigured: !!env.HELIUS_API_KEY && !!env.HELIUS_WEBHOOK_URL && !!env.HELIUS_WEBHOOK_AUTH,
        trackedSolanaWallets: wallets.length
      });
    }

    if (url.pathname === "/webhook/helius" && request.method === "POST") {
      const supplied = request.headers.get("authorization");
      if (!env.HELIUS_WEBHOOK_AUTH || supplied !== env.HELIUS_WEBHOOK_AUTH) return json({ ok: false, error: "unauthorized" }, 401);
      const payload = await request.json() as unknown;
      ctx.waitUntil(processHeliusPayload(payload, env));
      return json({ ok: true, accepted: true });
    }

    if (url.pathname === "/webhook" && request.method === "POST") {
      if (!authorized(request, env, url)) return json({ ok: false, error: "unauthorized" }, 401);
      const payload = await request.json() as unknown;
      const trades = await parseGenericWebhookBody(payload, env);
      ctx.waitUntil(processTrades(env, trades));
      return json({ ok: true, accepted: true, received: trades.length });
    }

    if (url.pathname === "/watchlist" && request.method === "GET") {
      if (!authorized(request, env, url)) return json({ ok: false, error: "unauthorized" }, 401);
      return json({ ok: true, wallets: await getTrackedWallets(env) });
    }

    if (url.pathname === "/watchlist" && request.method === "POST") {
      if (!authorized(request, env, url)) return json({ ok: false, error: "unauthorized" }, 401);
      const body = await request.json() as Record<string, unknown>;
      const result = await upsertTrackedWallet(env, {
        address: String(body.address ?? ""),
        chain: body.chain ? String(body.chain) : "solana",
        traderKey: body.traderKey ? String(body.traderKey) : undefined,
        traderLabel: body.traderLabel ? String(body.traderLabel) : undefined,
        traderScore: body.traderScore == null ? undefined : Number(body.traderScore),
        clusterKey: body.clusterKey ? String(body.clusterKey) : undefined
      });
      return json({ ok: true, wallet: result }, 201);
    }

    if (url.pathname === "/helius/sync" && request.method === "POST") {
      if (!authorized(request, env, url)) return json({ ok: false, error: "unauthorized" }, 401);
      return json(await syncHelius(env));
    }

    if (url.pathname === "/run" && request.method === "POST") {
      if (!authorized(request, env, url)) return json({ ok: false, error: "unauthorized" }, 401);
      return json(await collect(env));
    }

    return json({ ok: false, error: "not found" }, 404);
  }
} satisfies ExportedHandler<Env>;
