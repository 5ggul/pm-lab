import { describe, expect, it } from "vitest";
import { calculateRadarState } from "./scoring";
import type { DbTrade } from "./types";

const now = new Date("2026-09-06T08:00:00.000Z");

function trade(minAgo: number, trader: string, amount: number): DbTrade {
  return {
    provider_trade_id: `${trader}-${minAgo}`,
    chain: "solana",
    wallet_address: trader,
    trader_key: trader,
    trader_label: trader,
    cluster_key: trader,
    trader_score: 85,
    token_address: "token-x",
    symbol: "TEST",
    side: "BUY",
    amount_usd: amount,
    amount_token: null,
    price: null,
    liquidity_usd: 1_000_000,
    market_cap_usd: 10_000_000,
    tx_hash: null,
    executed_at: new Date(now.getTime() - minAgo * 60_000).toISOString(),
    received_at: now.toISOString()
  };
}

describe("calculateRadarState", () => {
  it("detects independent clustered buyers", () => {
    const state = calculateRadarState([
      trade(1, "a", 5000),
      trade(2, "b", 7000),
      trade(3, "c", 9000),
      trade(4, "d", 6000)
    ], now.toISOString(), 150_000);

    expect(state?.buyers5m).toBe(4);
    expect(state?.buyers15m).toBe(4);
    expect(state?.signalType).toBe("ACCELERATION");
    expect(state?.score).toBeGreaterThanOrEqual(70);
  });

  it("caps score on very low liquidity", () => {
    const rows = [trade(1, "a", 5000), trade(2, "b", 5000), trade(3, "c", 5000)];
    rows.forEach((row) => { row.liquidity_usd = 50_000; });
    const state = calculateRadarState(rows, now.toISOString(), 150_000);
    expect(state?.score).toBeLessThanOrEqual(60);
    expect(state?.flags).toContain("LOW_LIQUIDITY");
  });
});
