import type { DbTrade, Env, NormalizedTrade, RadarState } from "./types";

function headers(env: Env, extra: Record<string, string> = {}) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function request(env: Env, path: string, init: RequestInit = {}) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(env), ...(init.headers ?? {}) }
  });
  if (!response.ok) throw new Error(`Supabase ${response.status} ${path}: ${(await response.text()).slice(0, 500)}`);
  const body = await response.text();
  return body ? JSON.parse(body) as unknown : null;
}

export async function getCollectorState(env: Env) {
  const rows = await request(env, "collector_state?key=eq.provider&select=value&limit=1") as Array<{ value: Record<string, unknown> }>;
  return rows?.[0]?.value ?? {};
}

export async function setCollectorState(env: Env, value: Record<string, unknown>) {
  await request(env, "collector_state?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ key: "provider", value, updated_at: new Date().toISOString() }])
  });
}

export async function insertTrades(env: Env, trades: NormalizedTrade[]): Promise<number> {
  if (!trades.length) return 0;
  const receivedAt = new Date().toISOString();
  const rows: DbTrade[] = trades.map((trade) => ({
    provider_trade_id: trade.providerTradeId,
    chain: trade.chain,
    wallet_address: trade.walletAddress,
    trader_key: trade.traderKey,
    trader_label: trade.traderLabel ?? null,
    cluster_key: trade.clusterKey,
    trader_score: trade.traderScore,
    token_address: trade.tokenAddress,
    symbol: trade.symbol,
    side: trade.side,
    amount_usd: trade.amountUsd,
    amount_token: trade.amountToken ?? null,
    price: trade.price ?? null,
    liquidity_usd: trade.liquidityUsd ?? null,
    market_cap_usd: trade.marketCapUsd ?? null,
    tx_hash: trade.txHash ?? null,
    executed_at: trade.executedAt,
    received_at: receivedAt
  }));

  const result = await request(env, "trades?on_conflict=provider_trade_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(rows)
  }) as unknown[];
  return Array.isArray(result) ? result.length : 0;
}

export async function getTradesForToken(env: Env, chain: string, tokenAddress: string, sinceIso: string): Promise<DbTrade[]> {
  const path = `trades?chain=eq.${encodeURIComponent(chain)}&token_address=eq.${encodeURIComponent(tokenAddress)}&executed_at=gte.${encodeURIComponent(sinceIso)}&select=*&order=executed_at.asc&limit=5000`;
  return await request(env, path) as DbTrade[];
}

export async function getActiveRadarTokens(env: Env, sinceIso: string) {
  const path = `radar_current?last_trade_at=gte.${encodeURIComponent(sinceIso)}&select=chain,token_address&limit=1000`;
  const rows = await request(env, path) as Array<{ chain: string; token_address: string }>;
  return rows.map((row) => ({ chain: row.chain, tokenAddress: row.token_address }));
}

export async function getCurrentRadar(env: Env, chain: string, tokenAddress: string) {
  const path = `radar_current?chain=eq.${encodeURIComponent(chain)}&token_address=eq.${encodeURIComponent(tokenAddress)}&select=*&limit=1`;
  const rows = await request(env, path) as Array<Record<string, unknown>>;
  return rows?.[0] ?? null;
}

export async function upsertRadar(env: Env, state: RadarState) {
  await request(env, "radar_current?on_conflict=chain,token_address", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      chain: state.chain,
      token_address: state.tokenAddress,
      symbol: state.symbol,
      score: state.score,
      signal_type: state.signalType,
      buyers_5m: state.buyers5m,
      buyers_15m: state.buyers15m,
      buyers_60m: state.buyers60m,
      sellers_15m: state.sellers15m,
      buy_volume_15m: state.buyVolume15m,
      sell_volume_15m: state.sellVolume15m,
      net_flow_15m: state.netFlow15m,
      liquidity_usd: state.liquidityUsd,
      market_cap_usd: state.marketCapUsd,
      top_traders: state.topTraders,
      first_seen_at: state.firstSeenAt,
      last_trade_at: state.lastTradeAt,
      flags: state.flags,
      updated_at: new Date().toISOString()
    }])
  });
}

export async function insertSignalEvent(env: Env, state: RadarState, reason: string) {
  await request(env, "signals", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([{
      chain: state.chain,
      token_address: state.tokenAddress,
      symbol: state.symbol,
      score: state.score,
      signal_type: state.signalType,
      reason,
      buyers_5m: state.buyers5m,
      buyers_15m: state.buyers15m,
      buyers_60m: state.buyers60m,
      sellers_15m: state.sellers15m,
      net_flow_15m: state.netFlow15m,
      created_at: new Date().toISOString()
    }])
  });
}

export async function startCollectorRun(env: Env, source: string) {
  const rows = await request(env, "collector_runs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([{ source, status: "running", started_at: new Date().toISOString() }])
  }) as Array<{ id: string }>;
  return rows[0]?.id;
}

export async function finishCollectorRun(env: Env, id: string | undefined, patch: Record<string, unknown>) {
  if (!id) return;
  await request(env, `collector_runs?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...patch, finished_at: new Date().toISOString() })
  });
}
