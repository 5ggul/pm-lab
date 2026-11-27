export const EARLY_WALLET_HORIZONS_S = Object.freeze([60, 300, 900, 3600, 21600])
export const EARLY_WALLET_MAX_SAMPLE_LAG_MS = Object.freeze({
  60: 45_000,
  300: 90_000,
  900: 180_000,
  3600: 600_000,
  21600: 1_800_000
})

const lower = (v) => String(v ?? '').toLowerCase()
const finite = (v, fallback = null) => Number.isFinite(Number(v)) ? Number(v) : fallback
const isAddress = (v) => /^0x[a-f0-9]{40}$/.test(lower(v))
const isPoolId = (v) => /^0x[a-f0-9]{64}$/.test(lower(v)) || isAddress(v)

function median(values) {
  const xs = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!xs.length) return 0
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2
}

function ensureColumn(db, table, column, sqlType) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (columns.some((c) => c.name === column)) return false
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}`)
  return true
}

/**
 * Robinhood-native early-wallet learner.
 *
 * A wallet is never promoted from one lucky token. We record its first meaningful identified buy
 * below $100K and settle fixed horizons. Settlement is horizon-safe: a price observed hours late
 * cannot be mislabeled as a 1m/5m/15m outcome. Trades can settle a horizon when they happen close
 * enough to the target; the V4 StateView sampler supplies unbiased clock-driven checkpoints.
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
        source TEXT,
        sample_lag_ms INTEGER,
        PRIMARY KEY(wallet, token, horizon_s),
        FOREIGN KEY(wallet, token) REFERENCES early_wallet_entries(wallet, token) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS early_wallet_token_pools (
        token TEXT PRIMARY KEY,
        venue TEXT NOT NULL,
        pool_id TEXT NOT NULL,
        token_is0 INTEGER NOT NULL,
        quote_address TEXT,
        quote_symbol TEXT,
        quote_decimals INTEGER NOT NULL,
        quote_usd_kind TEXT NOT NULL,
        last_seen_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_early_wallet_entries_token_time
        ON early_wallet_entries(token, first_buy_at);
      CREATE INDEX IF NOT EXISTS idx_early_wallet_outcomes_wallet
        ON early_wallet_outcomes(wallet, horizon_s);
    `)

    // Migrate cached research DBs created before clock-driven settlement existed.
    ensureColumn(this.db, 'early_wallet_outcomes', 'source', 'TEXT')
    ensureColumn(this.db, 'early_wallet_outcomes', 'sample_lag_ms', 'INTEGER')

    this.insertEntry = this.db.prepare(`
      INSERT OR IGNORE INTO early_wallet_entries
      (wallet, token, first_tx_hash, first_buy_at, entry_mcap_usd, entry_usd, participant_source)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    this.upsertPool = this.db.prepare(`
      INSERT INTO early_wallet_token_pools
      (token, venue, pool_id, token_is0, quote_address, quote_symbol, quote_decimals, quote_usd_kind, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET
        venue=excluded.venue,
        pool_id=excluded.pool_id,
        token_is0=excluded.token_is0,
        quote_address=excluded.quote_address,
        quote_symbol=excluded.quote_symbol,
        quote_decimals=excluded.quote_decimals,
        quote_usd_kind=excluded.quote_usd_kind,
        last_seen_at=excluded.last_seen_at
      WHERE excluded.last_seen_at >= early_wallet_token_pools.last_seen_at
    `)

    this.insertOutcome = this.db.prepare(`
      INSERT OR IGNORE INTO early_wallet_outcomes
      (wallet, token, horizon_s, measured_at, market_cap_usd, multiple, source, sample_lag_ms)
      SELECT wallet, token, ?, ?, ?, (? / entry_mcap_usd), ?, (? - (first_buy_at + ?))
      FROM early_wallet_entries
      WHERE token=?
        AND first_buy_at <= (? - ?)
        AND first_buy_at >= (? - ? - ?)
        AND entry_mcap_usd > 0
    `)
  }

  rememberPricingContext(trade) {
    const token = lower(trade?.token)
    const ctx = trade?.pricingContext
    if (!ctx || !isAddress(token)) return false
    const venue = String(ctx.venue ?? '')
    const poolId = lower(ctx.poolId)
    const quoteDecimals = finite(ctx.quoteDecimals, null)
    const quoteUsdKind = String(ctx.quoteUsdKind ?? '')
    if (!venue || !isPoolId(poolId) || !Number.isInteger(quoteDecimals) || quoteDecimals < 0 || quoteDecimals > 36) return false
    if (!['eth', 'usd'].includes(quoteUsdKind)) return false

    this.upsertPool.run(
      token,
      venue,
      poolId,
      ctx.tokenIs0 === true ? 1 : 0,
      isAddress(ctx.quoteAddress) ? lower(ctx.quoteAddress) : null,
      ctx.quoteSymbol ? String(ctx.quoteSymbol) : null,
      quoteDecimals,
      quoteUsdKind,
      Number(trade?.observedAt ?? Date.now())
    )
    return true
  }

  recordTrade(trade) {
    const token = lower(trade?.token)
    const wallet = lower(trade?.participant)
    const txHash = lower(trade?.txHash)
    const at = Number(trade?.observedAt ?? Date.now())
    const marketCapUsd = finite(trade?.marketCapUsd, 0)
    const usdValue = finite(trade?.usdValue, 0)

    this.rememberPricingContext(trade)

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

    if (isAddress(token) && marketCapUsd > 0) this.settleToken(token, marketCapUsd, at, { source: 'trade' })
  }

  settleToken(tokenAddress, marketCapUsd, measuredAt = Date.now(), { source = 'trade', allowZero = false } = {}) {
    const token = lower(tokenAddress)
    const mcap = finite(marketCapUsd, null)
    const at = Number(measuredAt)
    const validMcap = mcap > 0 || (allowZero === true && mcap === 0)
    if (!isAddress(token) || !validMcap || !Number.isFinite(at)) return 0

    let settled = 0
    for (const horizon of EARLY_WALLET_HORIZONS_S) {
      const horizonMs = horizon * 1000
      const maxLagMs = EARLY_WALLET_MAX_SAMPLE_LAG_MS[horizon]
      const result = this.insertOutcome.run(
        horizon,
        at,
        mcap,
        mcap,
        String(source),
        at,
        horizonMs,
        token,
        at,
        horizonMs,
        at,
        horizonMs,
        maxLagMs
      )
      settled += Number(result?.changes ?? 0)
    }
    return settled
  }

  tokensDueForSampling(measuredAt = Date.now(), { limit = 50 } = {}) {
    const at = Number(measuredAt)
    if (!Number.isFinite(at)) return []
    const contexts = this.db.prepare(`
      SELECT e.wallet, e.token, e.first_buy_at,
             p.venue, p.pool_id, p.token_is0, p.quote_address, p.quote_symbol,
             p.quote_decimals, p.quote_usd_kind
      FROM early_wallet_entries e
      JOIN early_wallet_token_pools p ON p.token=e.token
      WHERE p.venue='uniswap-v4'
      ORDER BY e.first_buy_at ASC
    `).all()
    const existing = new Set(this.db.prepare(`
      SELECT wallet, token, horizon_s FROM early_wallet_outcomes
    `).all().map((r) => `${r.wallet}:${r.token}:${r.horizon_s}`))

    const due = new Map()
    for (const row of contexts) {
      for (const horizon of EARLY_WALLET_HORIZONS_S) {
        const key = `${row.wallet}:${row.token}:${horizon}`
        if (existing.has(key)) continue
        const dueAt = Number(row.first_buy_at) + horizon * 1000
        const lagMs = at - dueAt
        if (lagMs < 0 || lagMs > EARLY_WALLET_MAX_SAMPLE_LAG_MS[horizon]) continue
        const token = lower(row.token)
        const item = due.get(token) ?? {
          token,
          venue: row.venue,
          poolId: lower(row.pool_id),
          tokenIs0: Boolean(row.token_is0),
          quoteAddress: lower(row.quote_address),
          quoteSymbol: row.quote_symbol,
          quoteDecimals: Number(row.quote_decimals),
          quoteUsdKind: row.quote_usd_kind,
          horizons: new Set()
        }
        item.horizons.add(horizon)
        due.set(token, item)
      }
      if (due.size >= Math.max(1, Math.trunc(limit))) break
    }

    return [...due.values()].map((item) => ({ ...item, horizons: [...item.horizons].sort((a, b) => a - b) }))
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
    const stateViewOutcomes = Number(this.db.prepare("SELECT COUNT(*) n FROM early_wallet_outcomes WHERE source LIKE 'v4_state_view%'").get()?.n ?? 0)
    return {
      entries,
      wallets,
      tokens,
      settled6h,
      stateViewOutcomes,
      minBuyUsd: this.minBuyUsd,
      outcomeMode: 'trade_plus_v4_state_view'
    }
  }
}
