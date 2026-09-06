import { getMockSnapshot } from "./mock";
import type { RadarSignal, RadarSnapshot, RecentTrade } from "./types";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

function authHeaders(): Record<string, string> {
  if (!supabaseAnonKey) return {};
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`
  };
}

const camelSignal = (row: Record<string, unknown>): RadarSignal => ({
  chain: String(row.chain ?? "unknown"),
  tokenAddress: String(row.token_address ?? ""),
  symbol: String(row.symbol ?? "UNKNOWN"),
  name: row.name ? String(row.name) : undefined,
  score: Number(row.score ?? 0),
  signalType: String(row.signal_type ?? "WATCH") as RadarSignal["signalType"],
  buyers5m: Number(row.buyers_5m ?? 0),
  buyers15m: Number(row.buyers_15m ?? 0),
  buyers60m: Number(row.buyers_60m ?? 0),
  sellers15m: Number(row.sellers_15m ?? 0),
  buyVolume15m: Number(row.buy_volume_15m ?? 0),
  sellVolume15m: Number(row.sell_volume_15m ?? 0),
  netFlow15m: Number(row.net_flow_15m ?? 0),
  liquidityUsd: row.liquidity_usd == null ? null : Number(row.liquidity_usd),
  marketCapUsd: row.market_cap_usd == null ? null : Number(row.market_cap_usd),
  topTraders: Number(row.top_traders ?? 0),
  firstSeenAt: String(row.first_seen_at ?? new Date().toISOString()),
  updatedAt: String(row.updated_at ?? new Date().toISOString()),
  lastTradeAt: String(row.last_trade_at ?? row.updated_at ?? new Date().toISOString()),
  flags: Array.isArray(row.flags) ? row.flags.map(String) : []
});

const camelTrade = (row: Record<string, unknown>): RecentTrade => ({
  id: String(row.id ?? row.provider_trade_id ?? crypto.randomUUID()),
  trader: String(row.trader_label ?? row.trader_key ?? "Tracked trader"),
  side: String(row.side ?? "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY",
  symbol: String(row.symbol ?? "UNKNOWN"),
  amountUsd: Number(row.amount_usd ?? 0),
  executedAt: String(row.executed_at ?? new Date().toISOString())
});

async function supabaseGet(path: string) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase is not configured");
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: authHeaders(),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return (await response.json()) as Record<string, unknown>[];
}

export async function getRadarSnapshot(): Promise<RadarSnapshot> {
  if (!supabaseUrl || !supabaseAnonKey) return getMockSnapshot();

  try {
    const [signalRows, tradeRows, runRows] = await Promise.all([
      supabaseGet(`radar_current?select=*&last_trade_at=gte.${encodeURIComponent(new Date(Date.now() - 60 * 60_000).toISOString())}&order=score.desc&limit=50`),
      supabaseGet("radar_recent_trades?select=id,trader_label,side,symbol,amount_usd,executed_at&order=executed_at.desc&limit=12"),
      supabaseGet("collector_runs?select=*&order=started_at.desc&limit=1")
    ]);

    const latestRun = runRows[0];
    const lastSyncAt = latestRun?.finished_at ? String(latestRun.finished_at) : new Date(0).toISOString();
    const ageMs = Date.now() - new Date(lastSyncAt).getTime();

    return {
      mode: "live",
      generatedAt: new Date().toISOString(),
      signals: signalRows.map(camelSignal),
      recentTrades: tradeRows.map(camelTrade),
      health: {
        status: ageMs > 150_000 ? "DELAYED" : "LIVE",
        lastSyncAt,
        apiLatencyMs: latestRun?.api_latency_ms == null ? null : Number(latestRun.api_latency_ms),
        eventsLastRun: Number(latestRun?.events_inserted ?? 0),
        source: String(latestRun?.source ?? "provider")
      }
    };
  } catch (error) {
    const snapshot = getMockSnapshot();
    snapshot.health.source = `fallback:${error instanceof Error ? error.message.slice(0, 70) : "unknown"}`;
    return snapshot;
  }
}
