const EPHEMERAL_TABLES = Object.freeze([
  'signal_wallets',
  'outcomes',
  'signals',
  'radar_events',
  'trades',
  'funding_clusters'
])

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 ok FROM sqlite_master WHERE type='table' AND name=?").get(name)?.ok)
}

function countIfPresent(db, table) {
  if (!tableExists(db, table)) return 0
  return Number(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get()?.n ?? 0)
}

/**
 * Reset only per-run shadow telemetry while preserving longitudinal early-wallet learning.
 *
 * The Shadow SQLite file is restored from the previous successful GitHub Actions cache. Clearing
 * session tables here keeps each report comparable while `early_wallet_entries` and
 * `early_wallet_outcomes` accumulate across runs and can eventually satisfy the six-hour / eight-
 * token promotion rule. Table names are a fixed internal allow-list; no caller-controlled SQL is
 * interpolated.
 */
export function resetShadowSession(db) {
  const learningBefore = {
    entries: countIfPresent(db, 'early_wallet_entries'),
    outcomes: countIfPresent(db, 'early_wallet_outcomes')
  }
  const cleared = []

  db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;')
  try {
    for (const table of EPHEMERAL_TABLES) {
      if (!tableExists(db, table)) continue
      db.exec(`DELETE FROM ${table}`)
      cleared.push(table)
    }
    if (tableExists(db, 'sqlite_sequence')) {
      for (const table of ['trades', 'radar_events', 'signals']) {
        db.prepare('DELETE FROM sqlite_sequence WHERE name=?').run(table)
      }
    }
    db.exec('COMMIT;')
  } catch (error) {
    try { db.exec('ROLLBACK;') } catch {}
    throw error
  }

  const learningAfter = {
    entries: countIfPresent(db, 'early_wallet_entries'),
    outcomes: countIfPresent(db, 'early_wallet_outcomes')
  }
  if (learningAfter.entries !== learningBefore.entries || learningAfter.outcomes !== learningBefore.outcomes) {
    throw new Error('shadow session reset modified longitudinal early-wallet tables')
  }

  return { cleared, learningPreserved: learningAfter }
}
