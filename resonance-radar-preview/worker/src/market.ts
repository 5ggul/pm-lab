import type { MarketData } from "./types";

type DexPair = {
  chainId?: string;
  baseToken?: { address?: string; symbol?: string };
  quoteToken?: { address?: string; symbol?: string };
  priceUsd?: string | null;
  liquidity?: { usd?: number | null } | null;
  marketCap?: number | null;
  fdv?: number | null;
};

const numeric = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const chunks = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * DEX Screener supports up to 30 comma-separated token addresses per call.
 * For each mint we select the pair where the mint is the base token and where
 * reported USD liquidity is highest. This keeps market enrichment to a small
 * number of public, batched requests even when Helius delivers many swaps.
 */
export async function fetchDexScreenerMarket(tokenAddresses: string[]): Promise<Map<string, MarketData>> {
  const unique = [...new Set(tokenAddresses.filter(Boolean))];
  const result = new Map<string, MarketData>();
  if (!unique.length) return result;

  for (const batch of chunks(unique, 30)) {
    const response = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${batch.join(",")}`, {
      headers: { Accept: "application/json", "User-Agent": "resonance-radar/0.2" }
    });
    if (!response.ok) continue;

    const body = await response.json() as unknown;
    const pairs = Array.isArray(body) ? body as DexPair[] : [];

    for (const mint of batch) {
      const candidates = pairs.filter((pair) => pair.baseToken?.address === mint);
      if (!candidates.length) continue;
      const best = candidates.sort((a, b) => (numeric(b.liquidity?.usd) ?? 0) - (numeric(a.liquidity?.usd) ?? 0))[0];
      result.set(mint, {
        tokenAddress: mint,
        symbol: best.baseToken?.symbol || mint.slice(0, 6).toUpperCase(),
        priceUsd: numeric(best.priceUsd),
        liquidityUsd: numeric(best.liquidity?.usd),
        marketCapUsd: numeric(best.marketCap) ?? numeric(best.fdv)
      });
    }
  }

  return result;
}
