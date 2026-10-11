import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { resetShadowSession } from '../src/shadow-session.js'

test('shadow reset clears run telemetry and preserves longitudinal early-wallet learning', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE trades (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE radar_events (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE signals (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE signal_wallets (signal_id INTEGER);
    CREATE TABLE outcomes (signal_id INTEGER);
    CREATE TABLE funding_clusters (wallet TEXT);
    CREATE TABLE early_wallet_entries (wallet TEXT, token TEXT);
    CREATE TABLE early_wallet_outcomes (wallet TEXT, token TEXT, horizon_s INTEGER);
    INSERT INTO trades DEFAULT VALUES;
    INSERT INTO radar_events DEFAULT VALUES;
    INSERT INTO signals DEFAULT VALUES;
    INSERT INTO signal_wallets VALUES (1);
    INSERT INTO outcomes VALUES (1);
    INSERT INTO funding_clusters VALUES ('0x1');
    INSERT INTO early_wallet_entries VALUES ('wallet-a','token-a');
    INSERT INTO early_wallet_outcomes VALUES ('wallet-a','token-a',21600);
  `)

  const result = resetShadowSession(db)
  assert.deepEqual(result.learningPreserved, { entries: 1, outcomes: 1 })
  for (const table of ['trades', 'radar_events', 'signals', 'signal_wallets', 'outcomes', 'funding_clusters']) {
    assert.equal(Number(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n), 0)
  }
  assert.equal(Number(db.prepare('SELECT COUNT(*) n FROM early_wallet_entries').get().n), 1)
  assert.equal(Number(db.prepare('SELECT COUNT(*) n FROM early_wallet_outcomes').get().n), 1)
  db.close()
})

test('shadow reset is safe on a fresh database before schema creation', () => {
  const db = new DatabaseSync(':memory:')
  const result = resetShadowSession(db)
  assert.deepEqual(result.cleared, [])
  assert.deepEqual(result.learningPreserved, { entries: 0, outcomes: 0 })
  db.close()
})
