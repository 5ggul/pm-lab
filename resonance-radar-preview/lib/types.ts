export type SignalType = "BUY_RESONANCE" | "SELL_RESONANCE" | "REVERSAL" | "ACCELERATION" | "WATCH";

export type RadarSignal = {
  chain: string;
  tokenAddress: string;
  symbol: string;
  name?: string;
  score: number;
  signalType: SignalType;
  buyers5m: number;
  buyers15m: number;
  buyers60m: number;
  sellers15m: number;
  buyVolume15m: number;
  sellVolume15m: number;
  netFlow15m: number;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  topTraders: number;
  firstSeenAt: string;
  updatedAt: string;
  lastTradeAt: string;
  flags: string[];
};

export type RecentTrade = {
  id: string;
  trader: string;
  side: "BUY" | "SELL";
  symbol: string;
  amountUsd: number;
  executedAt: string;
};

export type CollectorHealth = {
  status: "LIVE" | "DELAYED" | "DEMO";
  lastSyncAt: string;
  apiLatencyMs: number | null;
  eventsLastRun: number;
  source: string;
};

export type RadarSnapshot = {
  mode: "live" | "demo";
  generatedAt: string;
  signals: RadarSignal[];
  recentTrades: RecentTrade[];
  health: CollectorHealth;
};
