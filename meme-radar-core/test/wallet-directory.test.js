import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeDirectoryRow, syncPublicWalletRoster } from '../src/wallet-directory.js'

const A = '0x1111111111111111111111111111111111111111'
const B = '0x2222222222222222222222222222222222222222'
const C = '0x3333333333333333333333333333333333333333'
const D = '0x4444444444444444444444444444444444444444'

test('FOLLOW is smart-eligible while WATCH is observation-only at its source score', () => {
  const follow = normalizeDirectoryRow({ address: A, score: 76, status: 'active' })
  assert.equal(follow.profile.quality, 76)
  assert.equal(follow.profile.smartEligible, true)

  const watch = normalizeDirectoryRow({ address: B, score: 68, status: 'watch' })
  assert.equal(watch.profile.quality, 68)
  assert.equal(watch.profile.smartEligible, false)
  assert.equal(watch.profile.source, 'fomoradar-public-watch-observation')
})

test('DROP and invalid rows fail closed', () => {
  assert.equal(normalizeDirectoryRow({ address: B, score: 35, status: 'dropped' }), null)
  assert.equal(normalizeDirectoryRow({ address: 'bad', score: 99, status: 'active' }), null)
})

test('settled local early model can promote a WATCH observation after enough samples', () => {
  const normalized = normalizeDirectoryRow(
    { address: A, score: 60, status: 'watch' },
    { earlyModelQuality: 88, earlySampleSize: 8, source: 'local-early-model' }
  )
  assert.equal(normalized.profile.quality, 88)
  assert.equal(normalized.profile.externalQuality, 60)
  assert.equal(normalized.profile.smartEligible, true)
  assert.equal(normalized.profile.source, 'local-early-model')
})

test('unsettled local score cannot prematurely promote a WATCH wallet', () => {
  const normalized = normalizeDirectoryRow(
    { address: A, score: 60, status: 'watch' },
    { earlyModelQuality: 95, earlySampleSize: 3 }
  )
  assert.equal(normalized.profile.quality, 60)
  assert.equal(normalized.profile.smartEligible, false)
})

test('roster sync tracks FOLLOW and WATCH but smart-credits only eligible profiles', async (t) => {
  const previousFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = previousFetch })
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        traders: [
          { address: A, score: 75, status: 'active' },
          { address: B, score: 68, status: 'watch' },
          { address: C, score: 45, status: 'watch' },
          { address: D, score: 35, status: 'dropped' }
        ]
      }
    }
  })

  const target = new Map()
  const result = await syncPublicWalletRoster(target, { url: 'https://example.test/leaderboard' })
  assert.equal(result.total, 4)
  assert.equal(result.accepted, 3)
  assert.equal(result.smartEligible, 1)
  assert.equal(result.observationOnly, 2)
  assert.deepEqual(result.statusCounts, { active: 1, watch: 2, dropped: 1, other: 0 })
  assert.equal(target.get(A).smartEligible, true)
  assert.equal(target.get(B).smartEligible, false)
  assert.equal(target.get(C).smartEligible, false)
  assert.equal(target.has(D), false)
})
