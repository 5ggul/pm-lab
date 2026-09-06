import type { DbTrade, RadarState } from "./types";

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

function uniqueClusters(trades: DbTrade[], side?: "BUY" | "SELL") {
  return new Set(trades.filter((t) => !side || t.side === side).map((t) => t.cluster_key)).size;
}

function uniqueTraderScore(count: number) {
  if (count >= 10) return 100;
  const map = [0, 10, 25, 45, 60, 72, 82, 87, 92, 96, 100];
  return map[Math.max(0, Math.min(count, 10))] ?? 0;
}

function timeDensityScore(buys15: DbTrade[]) {
  if (buys15.length < 2) return buys15.length ? 25 : 0;
  const times = buys15.map((t) => new Date(t.executed_at).getTime()).filter(Number.isFinite).sort((a, b) => a - b);
  if (times.length < 2) return 20;
  const spreadMinutes = Math.max(0.25, (times[times.length - 1] - times[0]) / 60_000);
  // 3+ independent traders inside ~3 minutes should score very highly.
  return clamp(100 - spreadMinutes * 4.8 + Math.min(25, uniqueClusters(buys15, "BUY") * 4));
}

function volumeScore(buyVolume15m: number, liquidityUsd: number | null) {
  if (buyVolume15m <= 0) return 0;
  if (liquidityUsd && liquidityUsd > 0) {
    const pct = buyVolume15m / liquidityUsd;
    return clamp(pct * 700); // ~14% of liquidity saturates.
  }
  return clamp(Math.log10(buyVolume15m + 1) * 20);
}

function liquidityScore(liquidityUsd: number | null) {
  if (liquidityUsd == null) return 45;
  if (liquidityUsd >= 2_000_000) return 100;
  if (liquidityUsd >= 1_000_000) return 90;
  if (liquidityUsd >= 500_000) return 78;
  if (liquidityUsd >= 250_000) return 62;
  if (liquidityUsd >= 150_000) return 48;
  return 20;
}

function netFlowScore(buy: number, sell: number) {
  const gross = buy + sell;
  if (gross <= 0) return 0;
  return clamp(((buy - sell) / gross + 1) * 50);
}

export function calculateRadarState(
  trades: DbTrade[],
  nowIso: string,
  lowLiquidityUsd = 150_000,
  previousSignalType?: RadarState["signalType"]
): RadarState | null {
  if (!trades.length) return null;

  const now = new Date(nowIso).getTime();
  const within = (minutes: number) => trades.filter((t) => now - new Date(t.executed_at).getTime() <= minutes * 60_000);
  const t5 = within(5);
  const t15 = within(15);
  const t60 = within(60);
  const buys15 = t15.filter((t) => t.side === "BUY");
  const sells15 = t15.filter((t) => t.side === "SELL");

  const buyers5m = uniqueClusters(t5, "BUY");
  const buyers15m = uniqueClusters(t15, "BUY");
  const buyers60m = uniqueClusters(t60, "BUY");
  const sellers15m = uniqueClusters(t15, "SELL");
  const buyVolume15m = buys15.reduce((sum, t) => sum + Number(t.amount_usd || 0), 0);
  const sellVolume15m = sells15.reduce((sum, t) => sum + Number(t.amount_usd || 0), 0);
  const netFlow15m = buyVolume15m - sellVolume15m;
  const latest = [...trades].sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime())[0];
  const liquidityUsd = [...trades].reverse().find((t) => t.liquidity_usd != null)?.liquidity_usd ?? null;
  const marketCapUsd = [...trades].reverse().find((t) => t.market_cap_usd != null)?.market_cap_usd ?? null;
  const qualityInputs = t15.filter((t) => t.side === "BUY").map((t) => Number(t.trader_score || 50));
  const traderQuality = qualityInputs.length ? average(qualityInputs) : 0;
  const topTraders = new Set(t15.filter((t) => t.trader_score >= 75).map((t) => t.cluster_key)).size;

  const weighted =
    traderQuality * 0.25 +
    uniqueTraderScore(buyers15m) * 0.25 +
    timeDensityScore(buys15) * 0.15 +
    netFlowScore(buyVolume15m, sellVolume15m) * 0.15 +
    volumeScore(buyVolume15m, liquidityUsd) * 0.10 +
    liquidityScore(liquidityUsd) * 0.10;

  let score = clamp(Math.round(weighted));
  const flags: string[] = [];
  if (liquidityUsd != null && liquidityUsd < lowLiquidityUsd) {
    flags.push("LOW_LIQUIDITY");
    score = Math.min(score, 60);
  }

  const sellerPressure = sellers15m >= 3 && sellVolume15m > buyVolume15m;
  const buyPressure = buyers15m >= 3 && netFlow15m > 0;
  const accelerating = buyers5m >= 3 && buyers5m >= Math.max(3, Math.ceil(buyers15m * 0.55));

  let signalType: RadarState["signalType"] = "WATCH";
  if (sellerPressure && (previousSignalType === "BUY_RESONANCE" || previousSignalType === "ACCELERATION")) {
    signalType = "REVERSAL";
    flags.push("EXITING");
  } else if (sellerPressure) {
    signalType = "SELL_RESONANCE";
  } else if (accelerating && buyPressure) {
    signalType = "ACCELERATION";
  } else if (buyPressure) {
    signalType = "BUY_RESONANCE";
  }

  return {
    chain: latest.chain,
    tokenAddress: latest.token_address,
    symbol: latest.symbol,
    score,
    signalType,
    buyers5m,
    buyers15m,
    buyers60m,
    sellers15m,
    buyVolume15m: Math.round(buyVolume15m * 100) / 100,
    sellVolume15m: Math.round(sellVolume15m * 100) / 100,
    netFlow15m: Math.round(netFlow15m * 100) / 100,
    liquidityUsd,
    marketCapUsd,
    topTraders,
    firstSeenAt: [...trades].sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime())[0].executed_at,
    lastTradeAt: latest.executed_at,
    flags
  };
}
