import { describe, expect, it } from "vitest";
import { extractHeliusCandidates } from "./helius";
import type { TrackedWallet } from "./types";

const wallet: TrackedWallet = {
  address: "tracked-wallet",
  chain: "solana",
  traderKey: "trader-a",
  traderLabel: "Trader A",
  clusterKey: "cluster-a",
  traderScore: 88
};

const mint = "MemeMint1111111111111111111111111111111111";

function event(delta: string) {
  return [{
    signature: `sig-${delta}`,
    timestamp: 1788681600,
    type: "SWAP",
    accountData: [{
      account: "token-account",
      tokenBalanceChanges: [{
        userAccount: wallet.address,
        mint,
        rawTokenAmount: { tokenAmount: delta, decimals: 6 }
      }]
    }]
  }];
}

describe("extractHeliusCandidates", () => {
  it("turns a positive token delta into a BUY", () => {
    const rows = extractHeliusCandidates(event("2500000"), [wallet]);
    expect(rows).toHaveLength(1);
    expect(rows[0].side).toBe("BUY");
    expect(rows[0].amountToken).toBe(2.5);
    expect(rows[0].walletAddress).toBe(wallet.address);
  });

  it("turns a negative token delta into a SELL", () => {
    const rows = extractHeliusCandidates(event("-1250000"), [wallet]);
    expect(rows).toHaveLength(1);
    expect(rows[0].side).toBe("SELL");
    expect(rows[0].amountToken).toBe(1.25);
  });

  it("ignores untracked wallets", () => {
    expect(extractHeliusCandidates(event("1000000"), [])).toHaveLength(0);
  });
});
