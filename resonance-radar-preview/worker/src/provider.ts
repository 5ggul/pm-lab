import type { Env, NormalizedTrade, ProviderBatch, TradeSide } from "./types";

const text = (value: unknown, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
const num = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function side(value: unknown): TradeSide {
  return String(value).toUpperCase() === "SELL" ? "SELL" : "BUY";
}

function iso(value: unknown): string {
  const date = value ? new Date(String(value)) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

/**
 * Generic provider adapter.
 * Expected response shape:
 * {
 *   "trades": [{
 *     "id": "...",
 *     "chain": "solana",
 *     "wallet": "...",
 *     "traderId": "...",          // optional
 *     "traderLabel": "...",       // optional
 *     "clusterId": "...",         // optional; same owner wallets share this
 *     "traderScore": 82,           // optional 0..100
 *     "tokenAddress": "...",
 *     "symbol": "...",
 *     "side": "BUY|SELL",
 *     "amountUsd": 1234.5,
 *     "amountToken": 10,
 *     "price": 0.12,
 *     "liquidityUsd": 500000,
 *     "marketCapUsd": 4000000,
 *     "txHash": "...",
 *     "executedAt": "ISO"
 *   }],
 *   "nextCursor": "..."
 * }
 *
 * When the real FOMO provider schema is known, only normalizeTrade / response extraction
 * should need to change.
 */
export function normalizeTrade(raw: Record<string, unknown>, env: Env): NormalizedTrade | null {
  const walletAddress = text(raw.wallet ?? raw.walletAddress ?? raw.address);
  const tokenAddress = text(raw.tokenAddress ?? raw.token_address ?? raw.token);
  if (!walletAddress || !tokenAddress) return null;

  const traderKey = text(raw.traderId ?? raw.trader_id, walletAddress);
  const clusterKey = text(raw.clusterId ?? raw.cluster_id, traderKey);
  const executedAt = iso(raw.executedAt ?? raw.executed_at ?? raw.timestamp);
  const providerTradeId = text(
    raw.id ?? raw.tradeId ?? raw.trade_id,
    `${text(raw.txHash ?? raw.tx_hash, "nohash")}:${walletAddress}:${tokenAddress}:${side(raw.side)}:${executedAt}`
  );

  return {
    providerTradeId,
    chain: text(raw.chain, env.DEFAULT_CHAIN ?? "solana").toLowerCase(),
    walletAddress,
    traderKey,
    traderLabel: text(raw.traderLabel ?? raw.trader_label) || undefined,
    clusterKey,
    traderScore: Math.max(0, Math.min(100, num(raw.traderScore ?? raw.trader_score, 50))),
    tokenAddress,
    symbol: text(raw.symbol, tokenAddress.slice(0, 6).toUpperCase()),
    side: side(raw.side),
    amountUsd: Math.max(0, num(raw.amountUsd ?? raw.amount_usd ?? raw.usdValue, 0)),
    amountToken: raw.amountToken == null && raw.amount_token == null ? null : num(raw.amountToken ?? raw.amount_token),
    price: raw.price == null ? null : num(raw.price),
    liquidityUsd: raw.liquidityUsd == null && raw.liquidity_usd == null ? null : num(raw.liquidityUsd ?? raw.liquidity_usd),
    marketCapUsd: raw.marketCapUsd == null && raw.market_cap_usd == null ? null : num(raw.marketCapUsd ?? raw.market_cap_usd),
    txHash: text(raw.txHash ?? raw.tx_hash) || null,
    executedAt
  };
}

export async function fetchProviderBatch(env: Env, since: string, cursor?: string | null): Promise<ProviderBatch> {
  if (!env.DATA_PROVIDER_URL) return { trades: [], nextCursor: cursor ?? null };

  const url = new URL(env.DATA_PROVIDER_URL);
  url.searchParams.set("since", since);
  if (cursor) url.searchParams.set("cursor", cursor);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (env.DATA_PROVIDER_KEY) headers.Authorization = `Bearer ${env.DATA_PROVIDER_KEY}`;

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) throw new Error(`Provider ${response.status}: ${(await response.text()).slice(0, 400)}`);

  const body = await response.json() as unknown;
  const obj = Array.isArray(body) ? { trades: body } : (body as Record<string, unknown>);
  const rawTrades = Array.isArray(obj.trades) ? obj.trades : Array.isArray(obj.data) ? obj.data : [];
  const trades = rawTrades
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => normalizeTrade(item, env))
    .filter((item): item is NormalizedTrade => item !== null);

  return {
    trades,
    nextCursor: text(obj.nextCursor ?? obj.next_cursor) || cursor || null,
    sourceTimestamp: text(obj.sourceTimestamp ?? obj.source_timestamp) || null
  };
}
