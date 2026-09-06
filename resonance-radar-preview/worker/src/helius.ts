import { fetchDexScreenerMarket } from "./market";
import type { Env, NormalizedTrade, TrackedWallet, TradeSide } from "./types";

const BASE_MINTS = new Set([
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD7Vt2B6x6qS31Yf3ZZ3"
]);

type HeliusTokenChange = {
  userAccount?: string;
  mint?: string;
  rawTokenAmount?: { tokenAmount?: string; decimals?: number };
};

type HeliusAccountData = {
  account?: string;
  nativeBalanceChange?: number;
  tokenBalanceChanges?: HeliusTokenChange[];
};

type HeliusTransfer = {
  fromUserAccount?: string;
  toUserAccount?: string;
  tokenAmount?: number;
  mint?: string;
};

type HeliusTransaction = {
  signature?: string;
  timestamp?: number | string;
  type?: string;
  transactionError?: unknown;
  accountData?: HeliusAccountData[];
  tokenTransfers?: HeliusTransfer[];
};

export type HeliusCandidate = {
  signature: string;
  walletAddress: string;
  tokenAddress: string;
  side: TradeSide;
  amountToken: number;
  executedAt: string;
};

const toIso = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  const parsed = new Date(String(value ?? Date.now()));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
};

const rawUiAmount = (change: HeliusTokenChange): number => {
  const raw = Number(change.rawTokenAmount?.tokenAmount ?? 0);
  const decimals = Number(change.rawTokenAmount?.decimals ?? 0);
  if (!Number.isFinite(raw) || !Number.isFinite(decimals)) return 0;
  return raw / 10 ** Math.max(0, decimals);
};

/**
 * Pure extractor used by tests. Helius balance changes are deltas, so a
 * positive non-base token delta is a buy and a negative one is a sell.
 * Multiple token accounts for the same wallet/mint are aggregated.
 */
export function extractHeliusCandidates(payload: unknown, wallets: TrackedWallet[]): HeliusCandidate[] {
  const tracked = new Set(wallets.filter((w) => w.chain === "solana").map((w) => w.address));
  const txs = Array.isArray(payload) ? payload : [payload];
  const candidates = new Map<string, HeliusCandidate>();

  for (const item of txs) {
    if (!item || typeof item !== "object") continue;
    const tx = item as HeliusTransaction;
    if (!tx.signature || tx.transactionError) continue;
    const executedAt = toIso(tx.timestamp);
    let foundBalanceChange = false;

    for (const account of tx.accountData ?? []) {
      for (const change of account.tokenBalanceChanges ?? []) {
        const walletAddress = change.userAccount;
        const mint = change.mint;
        if (!walletAddress || !mint || !tracked.has(walletAddress) || BASE_MINTS.has(mint)) continue;
        const signedAmount = rawUiAmount(change);
        if (!signedAmount) continue;
        foundBalanceChange = true;
        const key = `${tx.signature}:${walletAddress}:${mint}`;
        const existing = candidates.get(key);
        const combined = (existing ? (existing.side === "BUY" ? existing.amountToken : -existing.amountToken) : 0) + signedAmount;
        if (!combined) {
          candidates.delete(key);
          continue;
        }
        candidates.set(key, {
          signature: tx.signature,
          walletAddress,
          tokenAddress: mint,
          side: combined > 0 ? "BUY" : "SELL",
          amountToken: Math.abs(combined),
          executedAt
        });
      }
    }

    if (!foundBalanceChange) {
      for (const transfer of tx.tokenTransfers ?? []) {
        const mint = transfer.mint;
        const amount = Number(transfer.tokenAmount ?? 0);
        if (!mint || !Number.isFinite(amount) || amount <= 0 || BASE_MINTS.has(mint)) continue;
        const walletAddress = tracked.has(transfer.toUserAccount ?? "")
          ? transfer.toUserAccount!
          : tracked.has(transfer.fromUserAccount ?? "")
            ? transfer.fromUserAccount!
            : null;
        if (!walletAddress) continue;
        const side: TradeSide = transfer.toUserAccount === walletAddress ? "BUY" : "SELL";
        const key = `${tx.signature}:${walletAddress}:${mint}`;
        candidates.set(key, { signature: tx.signature, walletAddress, tokenAddress: mint, side, amountToken: amount, executedAt });
      }
    }
  }

  return [...candidates.values()];
}

export async function normalizeHeliusWebhook(payload: unknown, wallets: TrackedWallet[]): Promise<NormalizedTrade[]> {
  const candidates = extractHeliusCandidates(payload, wallets);
  if (!candidates.length) return [];

  const walletMap = new Map(wallets.map((wallet) => [wallet.address, wallet]));
  const market = await fetchDexScreenerMarket(candidates.map((item) => item.tokenAddress));

  return candidates.flatMap((candidate) => {
    const wallet = walletMap.get(candidate.walletAddress);
    if (!wallet) return [];
    const info = market.get(candidate.tokenAddress);
    const price = info?.priceUsd ?? null;
    const amountUsd = price == null ? 0 : candidate.amountToken * price;

    return [{
      providerTradeId: `helius:${candidate.signature}:${candidate.walletAddress}:${candidate.tokenAddress}`,
      chain: "solana",
      walletAddress: candidate.walletAddress,
      traderKey: wallet.traderKey,
      traderLabel: wallet.traderLabel,
      clusterKey: wallet.clusterKey,
      traderScore: wallet.traderScore,
      tokenAddress: candidate.tokenAddress,
      symbol: info?.symbol ?? candidate.tokenAddress.slice(0, 6).toUpperCase(),
      side: candidate.side,
      amountUsd: Math.round(amountUsd * 100) / 100,
      amountToken: candidate.amountToken,
      price,
      liquidityUsd: info?.liquidityUsd ?? null,
      marketCapUsd: info?.marketCapUsd ?? null,
      txHash: candidate.signature,
      executedAt: candidate.executedAt
    } satisfies NormalizedTrade];
  });
}

export async function syncHeliusWebhook(env: Env, wallets: TrackedWallet[], previousWebhookId?: string | null) {
  if (!env.HELIUS_API_KEY) throw new Error("HELIUS_API_KEY is not configured");
  if (!env.HELIUS_WEBHOOK_URL) throw new Error("HELIUS_WEBHOOK_URL is not configured");
  if (!env.HELIUS_WEBHOOK_AUTH) throw new Error("HELIUS_WEBHOOK_AUTH is not configured");

  const addresses = [...new Set(wallets.filter((wallet) => wallet.chain === "solana").map((wallet) => wallet.address))];
  if (!addresses.length) throw new Error("No active Solana wallets are configured");

  const body = {
    webhookURL: env.HELIUS_WEBHOOK_URL,
    transactionTypes: ["ANY"],
    accountAddresses: addresses,
    webhookType: "enhanced",
    authHeader: env.HELIUS_WEBHOOK_AUTH,
    txnStatus: "success"
  };

  const endpoint = previousWebhookId
    ? `https://api-mainnet.helius-rpc.com/v0/webhooks/${encodeURIComponent(previousWebhookId)}?api-key=${encodeURIComponent(env.HELIUS_API_KEY)}`
    : `https://api-mainnet.helius-rpc.com/v0/webhooks?api-key=${encodeURIComponent(env.HELIUS_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: previousWebhookId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Helius ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const data = await response.json() as Record<string, unknown>;
  return { webhookId: String(data.webhookID ?? previousWebhookId ?? ""), addresses: addresses.length, data };
}
