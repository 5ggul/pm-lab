export const EARLY_WALLET_HORIZONS_S = Object.freeze([60, 300, 900, 3600, 21600])

const lower = (v) => String(v ?? '').toLowerCase()
const finite = (v, fallback = null) => Number.isFinite(Number(v)) ? Number(v) : fallback
const isAddress = (v) => /^0x[a-f0-9]{40}$/.test(lower(v))

function median(values) {
  const xs = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!xs.length) return 0
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2
}

/**
 * Robinhood-native early-wallet learner.
 *
 * This deliberately does not mark a wallet smart from a single successful token. We first record
 * the wallet's first meaningful identified buy below $100K, then settle token outcomes at fixed
 * horizons. A separate promotion layer can only use wallets with enough settled six-hour samples.
 *
 * Outcome settlement is trade-driven for V1: the first observed trade after each horizon is used.
 * A dedicated horizon sampler is still required before production calibration.
 */
export class EarlyWalletLearner {
  constructor(db, { minBuyUsd = Number(process.env.EARLY_WALLET_MIN_BUY_USD ?? 20) } = {}) {
    this.db = db
    this.minBuyUsd = Math.max(5, finite(minBuyUsd, 20))

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS early_wallet_entries (
        wallet TEXT NOT NULL,
        token TEXT NOT NULL,
        first_tx_hash TEXT NOT NULL,
        first_buy_at INTEGER NOT NULL,
        entry_mcap_usd REAL NOT NULL,
        entry_usd REAL NOT NULL,
        participant_source TEXT,
        PRIMARY KEY(wallet, token)
      );

      CREATE TABLE IF NOT EXISTS early_wallet_outcomes (
        wallet TEXT NOT NULL,
        token TEXT NOT NULL,
        horizon_s INTEGER NOT NULL,
        measured_at INTEGER NOT NULL,
        market_cap_usd REAL NOT NULL,
        multiple REAL NOT NULL,
        PRIMARY KEY(wallet, token, horizon_s),
        FOREIGN KEY(wallet, token) REFERENCES early_wallet_entries(wallet, token) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_early_wallet_entries_token_time
        ON early_wallet_entries(token, first_buy_at);
      CREATE INDEX IF NOT EXISTS idx_early_wallet_outcomes_wallet
        ON early_wallet_outcomes(wallet, horizon_s);
    `)

    this.insertEntry = this.db.prepare(`
      INSERT OR IGNORE INTO early_wallet_entries
      (wallet, token, first_tx_hash, first_buy_at, entry_mcap_usd, entry_usd, participant_source)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    this.insertOutcome = this.db.prepare(`
      INSERT OR IGNORE INTO early_wallet_outcomes
      (wallet, token, horizon_s, measured_at, market_cap_usd, multiple)
      SELECT wallet, token, ?, ?, ?, (? / entry_mcap_usd)
      FROM early_wallet_entries
      WHERE token=? AND first_buy_at <= ? AND entry_mcap_usd > 0
    `)
  }

  recordTrade(trade) {
    const token = lower(trade?.token)
    const wallet = lower(trade?.participant)
    const txHash = lower(trade?.txHash)
    const at = Number(trade?.observedAt ?? Date.now())
    const marketCapUsd = finite(trade?.marketCapUsd, 0)
    const usdValue = finite(trade?.usdValue, 0)

    if (trade?.isBuy === true && isAddress(wallet) && isAddress(token) && marketCapUsd > 0 && marketCapUsd < 100_000 && usdValue >= this.minBuyUsd) {
      this.insertEntry.run(
        wallet,
        token,
        txHash,
        at,
        marketCapUsd,
        usdValue,
        trade?.participantSource ? String(trade.participantSource) : null
      )
    }

    if (isAddress(token) && marketCapUsd > 0) this.settleToken(token, marketCapUsd, at)
  }

  settleToken(tokenAddress, marketCapUsd, measuredAt = Date.now()) {
    const token = lower(tokenAddress)
    const mcap = finite(marketCapUsd, 0)
    if (!isAddress(token) || !(mcap > 0)) return
    for (const horizon of EARLY_WALLET_HORIZONS_S) {
      this.insertOutcome.run(horizon, measuredAt, mcap, mcap, token, measuredAt - horizon * 1000)
    }
  }

  walletStats(walletAddress) {
    const wallet = lower(walletAddress)
    if (!isAddress(wallet)) return this.emptyStats(wallet)

    const rows = this.db.prepare(`
      SELECT e.token, e.entry_mcap_usd, e.entry_usd,
             MAX(o.multiple) AS max_multiple,
             MAX(CASE WHEN o.horizon_s=21600 THEN o.multiple END) AS six_hour_multiple
      FROM early_wallet_entries e
      LEFT JOIN early_wallet_outcomes o
        ON o.wallet=e.wallet AND o.token=e.token
      WHERE e.wallet=?
      GROUP BY e.token, e.entry_mcap_usd, e.entry_usd
    `).all(wallet)

    if (!rows.length) return this.emptyStats(wallet)
    const settled = rows.filter((r) => Number.isFinite(Number(r.six_hour_multiple)))
    const rate = (fn) => settled.length ? settled.filter(fn).length / settled.length : 0
    return {
      wallet,
      observedEarlyTokens: rows.length,
      settledEarlyTrades: settled.length,
      totalEntryUsd: rows.reduce((sum, r) => sum + finite(r.entry_usd, 0), 0),
      avgEntryBuyUsd: rows.reduce((sum, r) => sum + finite(r.entry_usd, 0), 0) / rows.length,
      medianEntryMcapUsd: median(rows.map((r) => r.entry_mcap_usd)),
      minEntryMcapUsd: Math.min(...rows.map((r) => finite(r.entry_mcap_usd, Infinity))),
      winRate: rate((r) => Number(r.six_hour_multiple) > 1),
      hit2xRate: rate((r) => Number(r.max_multiple) >= 2),
      hit5xRate: rate((r) => Number(r.max_multiple) >= 5),
      rugRate: rate((r) => Number(r.six_hour_multiple) <= 0.25)
    }
  }

  listWalletStats({ minObservedTokens = 1, minSettled = 0, limit = 500 } = {}) {
    const wallets = this.db.prepare(`
      SELECT wallet, COUNT(DISTINCT token) observed_tokens, SUM(entry_usd) total_entry_usd
      FROM early_wallet_entries
      GROUP BY wallet
      HAVING COUNT(DISTINCT token) >= ?
      ORDER BY observed_tokens DESC, total_entry_usd DESC
      LIMIT ?
    `).all(Math.max(1, Math.trunc(minObservedTokens)), Math.max(1, Math.trunc(limit)))

    return wallets
      .map((r) => this.walletStats(r.wallet))
      .filter((stats) => stats.settledEarlyTrades >= minSettled)
      .sort((a, b) =>
        b.settledEarlyTrades - a.settledEarlyTrades ||
        b.observedEarlyTokens - a.observedEarlyTokens ||
        b.totalEntryUsd - a.totalEntryUsd
      )
  }

  emptyStats(wallet = null) {
    return {
      wallet,
      observedEarlyTokens: 0,
      settledEarlyTrades: 0,
      totalEntryUsd: 0,
      avgEntryBuyUsd: 0,
      medianEntryMcapUsd: 0,
      minEntryMcapUsd: 0,
      winRate: 0,
      hit2xRate: 0,
      hit5xRate: 0,
      rugRate: 0
    }
  }

  summary() {
    const entries = Number(this.db.prepare('SELECT COUNT(*) n FROM early_wallet_entries').get()?.n ?? 0)
    const wallets = Number(this.db.prepare('SELECT COUNT(DISTINCT wallet) n FROM early_wallet_entries').get()?.n ?? 0)
    const tokens = Number(this.db.prepare('SELECT COUNT(DISTINCT token) n FROM early_wallet_entries').get()?.n ?? 0)
    const settled6h = Number(this.db.prepare('SELECT COUNT(*) n FROM early_wallet_outcomes WHERE horizon_s=21600').get()?.n ?? 0)
    return { entries, wallets, tokens, settled6h, minBuyUsd: this.minBuyUsd, outcomeMode: 'trade_driven' }
  }
}
