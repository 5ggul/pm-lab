import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeDirectoryRow, syncPublicWalletRoster } from '../src/wallet-directory.js'

const A = '0x1111111111111111111111111111111111111111'
const B = '0x2222222222222222222222222222222222222222'
const C = '0x3333333333333333333333333333333333333333'
const D = '0x4444444444444444444444444444444444444444'

test('FOLLOW keeps its score while WATCH pays a conservative 10 point penalty', () => {
  assert.equal(normalizeDirectoryRow({ address: A, score: 76, status: 'active' }).profile.quality, 76)
  const watch = normalizeDirectoryRow({ address: B, score: 84, status: 'watch' })
  assert.equal(watch.profile.quality, 74)
  assert.equal(watch.profile.externalStatusPenalty, 10)
  assert.equal(watch.profile.source, 'fomoradar-public-watch-penalized')
})

test('weak WATCH and DROP rows fail closed', () => {
  assert.equal(normalizeDirectoryRow({ address: A, score: 79, status: 'watch' }), null)
  assert.equal(normalizeDirectoryRow({ address: B, score: 99, status: 'dropped' }), null)
  assert.equal(normalizeDirectoryRow({ address: 'bad', score: 99, status: 'active' }), null)
})

test('settled local early quality remains authoritative over external prior', () => {
  const normalized = normalizeDirectoryRow(
    { address: A, score: 81, status: 'watch' },
    { earlyModelQuality: 88, source: 'local-early-model' }
  )
  assert.equal(normalized.profile.quality, 88)
  assert.equal(normalized.profile.externalQuality, 71)
  assert.equal(normalized.profile.source, 'local-early-model')
})

test('roster sync accepts FOLLOW plus only high-confidence WATCH and reports status counts', async (t) => {
  const previousFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = previousFetch })
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        traders: [
          { address: A, score: 75, status: 'active' },
          { address: B, score: 85, status: 'watch' },
          { address: C, score: 79, status: 'watch' },
          { address: D, score: 95, status: 'dropped' }
        ]
      }
    }
  })

  const target = new Map()
  const result = await syncPublicWalletRoster(target, { url: 'https://example.test/leaderboard' })
  assert.equal(result.total, 4)
  assert.equal(result.accepted, 2)
  assert.equal(result.smartEligible, 2)
  assert.deepEqual(result.statusCounts, { active: 1, watch: 2, dropped: 1, other: 0 })
  assert.equal(target.has(A), true)
  assert.equal(target.has(B), true)
  assert.equal(target.has(C), false)
  assert.equal(target.has(D), false)
})
