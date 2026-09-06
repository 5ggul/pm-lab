export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  DATA_PROVIDER_URL?: string;
  DATA_PROVIDER_KEY?: string;
  HELIUS_API_KEY?: string;
  HELIUS_WEBHOOK_URL?: string;
  HELIUS_WEBHOOK_AUTH?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  COLLECTOR_SECRET?: string;
  PROVIDER_NAME?: string;
  DEFAULT_CHAIN?: string;
  BUY_SIGNAL_THRESHOLD?: string;
  STRONG_SIGNAL_THRESHOLD?: string;
  LOW_LIQUIDITY_USD?: string;
};

export type TradeSide = "BUY" | "SELL";

export type NormalizedTrade = {
  providerTradeId: string;
  chain: string;
  walletAddress: string;
  traderKey: string;
  traderLabel?: string;
  clusterKey: string;
  traderScore: number;
  tokenAddress: string;
  symbol: string;
  side: TradeSide;
  amountUsd: number;
  amountToken?: number | null;
  price?: number | null;
  liquidityUsd?: number | null;
  marketCapUsd?: number | null;
  txHash?: string | null;
  executedAt: string;
};

export type ProviderBatch = {
  trades: NormalizedTrade[];
  nextCursor?: string | null;
  sourceTimestamp?: string | null;
};

export type TrackedWallet = {
  address: string;
  chain: string;
  traderKey: string;
  traderLabel: string;
  clusterKey: string;
  traderScore: number;
};

export type MarketData = {
  tokenAddress: string;
  symbol: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
};

export type DbTrade = {
  provider_trade_id: string;
  chain: string;
  wallet_address: string;
  trader_key: string;
  trader_label: string | null;
  cluster_key: string;
  trader_score: number;
  token_address: string;
  symbol: string;
  side: TradeSide;
  amount_usd: number;
  amount_token: number | null;
  price: number | null;
  liquidity_usd: number | null;
  market_cap_usd: number | null;
  tx_hash: string | null;
  executed_at: string;
  received_at: string;
};

export type RadarState = {
  chain: string;
  tokenAddress: string;
  symbol: string;
  score: number;
  signalType: "BUY_RESONANCE" | "SELL_RESONANCE" | "REVERSAL" | "ACCELERATION" | "WATCH";
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
  lastTradeAt: string;
  flags: string[];
};
