import { DatabaseSync } from 'node:sqlite'

export const OUTCOME_HORIZONS_S = Object.freeze([60, 300, 900, 3600, 21600])

const lower = (v) => String(v ?? '').toLowerCase()
const finite = (v, fallback = null) => Number.isFinite(Number(v)) ? Number(v) : fallback
const json = (v) => JSON.stringify(v ?? {})
const isAddress = (v) => /^0x[a-f0-9]{40}$/.test(lower(v))

export class ShadowStore {
  constructor(file = process.env.RADAR_DB_PATH ?? 'meme-radar-shadow.sqlite') {
    this.db = new DatabaseSync(file)
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=NORMAL;
      PRAGMA foreign_keys=ON;

      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain TEXT NOT NULL,
        token TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        trader TEXT NOT NULL,
        participant TEXT,
        participant_source TEXT,
        side TEXT NOT NULL CHECK(side IN ('buy','sell')),
        usd_value REAL NOT NULL,
        market_cap_usd REAL NOT NULL,
        attribution TEXT,
        observed_at INTEGER NOT NULL,
        risk_json TEXT NOT NULL,
        UNIQUE(tx_hash, token, trader, side)
      );

      CREATE TABLE IF NOT EXISTS radar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain TEXT NOT NULL,
        token TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        band TEXT,
        reason TEXT NOT NULL,
        score REAL NOT NULL,
        threshold REAL,
        market_cap_usd REAL NOT NULL,
        smart_buyers INTEGER NOT NULL,
        buyers_10s INTEGER NOT NULL,
        unidentified_buy_events_10s INTEGER NOT NULL,
        buy_usd_10s REAL NOT NULL,
        sell_usd_10s REAL NOT NULL,
        buy_sell_ratio REAL NOT NULL,
        security_verified INTEGER NOT NULL,
        components_json TEXT NOT NULL,
        observed_at INTEGER NOT NULL,
        UNIQUE(token, tx_hash)
      );

      CREATE TABLE IF NOT EXISTS signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK(kind IN ('WATCH','VERIFIED')),
        chain TEXT NOT NULL,
        token TEXT NOT NULL,
        symbol TEXT,
        band TEXT NOT NULL,
        score REAL NOT NULL,
        threshold REAL,
        market_cap_usd REAL NOT NULL,
        smart_buyers INTEGER NOT NULL,
        buyers_10s INTEGER NOT NULL,
        buy_usd_10s REAL NOT NULL,
        buy_sell_ratio REAL NOT NULL,
        observed_at INTEGER NOT NULL,
        risk_json TEXT NOT NULL,
        UNIQUE(kind, token, observed_at)
      );

      CREATE TABLE IF NOT EXISTS signal_wallets (
        signal_id INTEGER NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
        wallet TEXT NOT NULL,
        PRIMARY KEY(signal_id, wallet)
      );

      CREATE TABLE IF NOT EXISTS outcomes (
        signal_id INTEGER NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
        horizon_s INTEGER NOT NULL,
        measured_at INTEGER NOT NULL,
        market_cap_usd REAL NOT NULL,
        multiple REAL NOT NULL,
        PRIMARY KEY(signal_id, horizon_s)
      );

      CREATE TABLE IF NOT EXISTS funding_clusters (
        wallet TEXT PRIMARY KEY,
        cluster_key TEXT NOT NULL,
        funder TEXT,
        resolved INTEGER NOT NULL,
        confidence TEXT,
        value_wei TEXT,
        source_tx TEXT,
        source_at INTEGER,
        checked_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_trades_token_time ON trades(token, observed_at);
      CREATE INDEX IF NOT EXISTS idx_radar_token_time ON radar_events(token, observed_at);
      CREATE INDEX IF NOT EXISTS idx_radar_reason ON radar_events(reason);
      CREATE INDEX IF NOT EXISTS idx_signals_token_time ON signals(token, observed_at);
      CREATE INDEX IF NOT EXISTS idx_signal_wallets_wallet ON signal_wallets(wallet);
      CREATE INDEX IF NOT EXISTS idx_funding_cluster_key ON funding_clusters(cluster_key);
    `)

    this.ensureColumn('trades', 'participant', 'TEXT')
    this.ensureColumn('trades', 'participant_source', 'TEXT')

    this.insertTrade = this.db.prepare(`
      INSERT OR IGNORE INTO trades
      (chain, token, tx_hash, trader, participant, participant_source, side, usd_value, market_cap_usd, attribution, observed_at, risk_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    this.insertRadar = this.db.prepare(`
      INSERT OR REPLACE INTO radar_events
      (chain, token, tx_hash, band, reason, score, threshold, market_cap_usd, smart_buyers, buyers_10s,
       unidentified_buy_events_10s, buy_usd_10s, sell_usd_10s, buy_sell_ratio, security_verified, components_json, observed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    this.insertSignal = this.db.prepare(`
      INSERT OR IGNORE INTO signals
      (kind, chain, token, symbol, band, score, threshold, market_cap_usd, smart_buyers, buyers_10s,
       buy_usd_10s, buy_sell_ratio, observed_at, risk_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    this.findSignal = this.db.prepare('SELECT id FROM signals WHERE kind=? AND token=? AND observed_at=?')
    this.insertWallet = this.db.prepare('INSERT OR IGNORE INTO signal_wallets(signal_id, wallet) VALUES (?, ?)')
    this.insertOutcome = this.db.prepare(`
      INSERT OR IGNORE INTO outcomes(signal_id, horizon_s, measured_at, market_cap_usd, multiple)
      SELECT id, ?, ?, ?, (? / market_cap_usd)
      FROM signals
      WHERE token=? AND observed_at <= ? AND market_cap_usd > 0
    `)
    this.upsertFunding = this.db.prepare(`
      INSERT INTO funding_clusters
      (wallet, cluster_key, funder, resolved, confidence, value_wei, source_tx, source_at, checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(wallet) DO UPDATE SET
        cluster_key=excluded.cluster_key,
        funder=excluded.funder,
        resolved=excluded.resolved,
        confidence=excluded.confidence,
        value_wei=excluded.value_wei,
        source_tx=excluded.source_tx,
        source_at=excluded.source_at,
        checked_at=excluded.checked_at
    `)
    this.getFundingStmt = this.db.prepare('SELECT * FROM funding_clusters WHERE wallet=?')
  }

  ensureColumn(table, column, type) {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all().map((r) => String(r.name))
    if (!columns.includes(column)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
  }

  recordTrade(trade) {
    const token = lower(trade.token)
    const at = Number(trade.observedAt ?? Date.now())
    this.insertTrade.run(
      String(trade.chain ?? 'unknown'), token, lower(trade.txHash), lower(trade.trader),
      isAddress(trade.participant) ? lower(trade.participant) : null,
      trade.participantSource ? String(trade.participantSource) : null,
      trade.isBuy ? 'buy' : 'sell', finite(trade.usdValue, 0), finite(trade.marketCapUsd, 0),
      String(trade.attribution ?? 'unattributed'), at, json(trade.risk)
    )
    this.settleOutcomes(token, trade.marketCapUsd, at)
  }

  recordRadar(result, trade) {
    if (!result || !trade?.token || !trade?.txHash) return
    this.insertRadar.run(
      String(trade.chain ?? result.chain ?? 'unknown'), lower(trade.token), lower(trade.txHash),
      result.band ?? null, String(result.reason ?? 'UNKNOWN'), finite(result.score, 0), finite(result.threshold),
      finite(result.marketCapUsd ?? trade.marketCapUsd, 0),
      Math.max(0, Math.trunc(finite(result.independentSmartBuyers, 0))),
      Math.max(0, Math.trunc(finite(result.uniqueBuyers10s, 0))),
      Math.max(0, Math.trunc(finite(result.unidentifiedBuyEvents10s, 0))),
      finite(result.buyUsd10s, 0), finite(result.sellUsd10s, 0), finite(result.buySellRatio, 0),
      result.risk?.securityVerified === true ? 1 : 0,
      json(result.components), Number(result.observedAt ?? trade.observedAt ?? Date.now())
    )
  }

  recordSignal(signal, kind) {
    if (!['WATCH', 'VERIFIED'].includes(kind)) throw new Error(`unknown signal kind ${kind}`)
    const token = lower(signal.token)
    const at = Number(signal.observedAt ?? Date.now())
    this.insertSignal.run(
      kind, String(signal.chain ?? 'unknown'), token, signal.symbol ?? null, String(signal.band ?? 'UNKNOWN'),
      finite(signal.score, 0), finite(signal.threshold), finite(signal.marketCapUsd, 0),
      Math.max(0, Math.trunc(finite(signal.independentSmartBuyers, 0))),
      Math.max(0, Math.trunc(finite(signal.uniqueBuyers10s, 0))), finite(signal.buyUsd10s, 0),
      finite(signal.buySellRatio, 0), at, json(signal.risk)
    )
    const row = this.findSignal.get(kind, token, at)
    if (!row) return null
    const signalId = Number(row.id)
    for (const wallet of signal.smartWallets ?? []) {
      if (isAddress(wallet)) this.insertWallet.run(signalId, lower(wallet))
    }
    return signalId
  }

  settleOutcomes(tokenAddress, marketCapUsd, measuredAt = Date.now()) {
    const token = lower(tokenAddress)
    const mcap = finite(marketCapUsd, 0)
    if (!(mcap > 0)) return
    for (const horizon of OUTCOME_HORIZONS_S) {
      this.insertOutcome.run(horizon, measuredAt, mcap, mcap, token, measuredAt - horizon * 1000)
    }
  }

  saveFundingCluster(result, checkedAt = Date.now()) {
    const wallet = lower(result?.wallet)
    if (!isAddress(wallet)) return
    this.upsertFunding.run(
      wallet,
      String(result.cluster ?? wallet),
      result.funder ? lower(result.funder) : null,
      result.resolved ? 1 : 0,
      result.confidence ?? null,
      result.valueWei ?? null,
      result.txHash ? lower(result.txHash) : null,
      finite(result.timestampMs),
      checkedAt
    )
  }

  getFundingCluster(walletAddress, maxAgeMs = 86_400_000) {
    const wallet = lower(walletAddress)
    const row = this.getFundingStmt.get(wallet)
    if (!row) return null
    if (Date.now() - Number(row.checked_at) > maxAgeMs) return null
    return {
      wallet,
      cluster: String(row.cluster_key),
      funder: row.funder ? String(row.funder) : null,
      resolved: Boolean(row.resolved),
      confidence: row.confidence ? String(row.confidence) : null,
      valueWei: row.value_wei ? String(row.value_wei) : null,
      txHash: row.source_tx ? String(row.source_tx) : null,
      timestampMs: finite(row.source_at)
    }
  }

  walletEarlyStats(walletAddress) {
    const wallet = lower(walletAddress)
    const rows = this.db.prepare(`
      SELECT s.token, MIN(s.market_cap_usd) AS entry_mcap,
             MAX(o.multiple) AS max_multiple,
             MAX(CASE WHEN o.horizon_s=21600 THEN o.multiple END) AS six_hour_multiple
      FROM signal_wallets sw
      JOIN signals s ON s.id=sw.signal_id
      LEFT JOIN outcomes o ON o.signal_id=s.id
      WHERE sw.wallet=? AND s.market_cap_usd < 100000 AND s.kind='VERIFIED'
      GROUP BY s.token
    `).all(wallet)
    const settled = rows.filter((r) => Number.isFinite(Number(r.six_hour_multiple)))
    if (!settled.length) return { settledEarlyTrades: 0, winRate: 0, hit2xRate: 0, hit5xRate: 0, rugRate: 0 }
    const rate = (fn) => settled.filter(fn).length / settled.length
    return {
      settledEarlyTrades: settled.length,
      winRate: rate((r) => Number(r.six_hour_multiple) > 1),
      hit2xRate: rate((r) => Number(r.max_multiple) >= 2),
      hit5xRate: rate((r) => Number(r.max_multiple) >= 5),
      rugRate: rate((r) => Number(r.six_hour_multiple) <= 0.25)
    }
  }

  summary() {
    const one = (table) => Number(this.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n)
    return {
      trades: one('trades'),
      radarEvents: one('radar_events'),
      signals: one('signals'),
      outcomes: one('outcomes'),
      fundingClusters: one('funding_clusters')
    }
  }

  close() { this.db.close() }
}
