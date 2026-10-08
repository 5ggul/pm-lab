import test from 'node:test'
import assert from 'node:assert/strict'
import { FundingClusterResolver, isSharedFundingEntity, pickRecentDirectFunder } from '../src/funding.js'

const W = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const A = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const B = '0xcccccccccccccccccccccccccccccccccccccccc'
const C = '0xdddddddddddddddddddddddddddddddddddddddd'

const tx = ({ from = A, value = '2000000000000000', timestamp = '2026-09-17T00:00:00Z', contract = false, name = null } = {}) => ({
  status: 'ok', value, timestamp, hash: '0x' + '1'.repeat(64),
  to: { hash: W, is_contract: false },
  from: { hash: from, is_contract: contract, name, public_tags: [] }
})

test('picks newest meaningful EOA native funder', () => {
  const got = pickRecentDirectFunder({ items: [
    tx({ from: A, timestamp: '2026-09-16T00:00:00Z' }),
    tx({ from: B, timestamp: '2026-09-17T00:00:00Z' })
  ] }, W)
  assert.equal(got.funder, B)
})

test('ignores dust and shared service/contract funders', () => {
  assert.equal(isSharedFundingEntity({ is_contract: true }), true)
  assert.equal(isSharedFundingEntity({ is_contract: false, name: 'Binance Hot Wallet' }), true)
  const got = pickRecentDirectFunder({ items: [
    tx({ from: A, value: '10' }),
    tx({ from: B, contract: true, value: '9000000000000000' })
  ] }, W)
  assert.equal(got, null)
})

test('resolver returns same cluster for wallets funded by same EOA', async () => {
  const payload = (wallet) => ({ items: [{
    status: 'ok', value: '3000000000000000', timestamp: '2026-09-17T00:00:00Z',
    hash: '0x' + '2'.repeat(64), to: { hash: wallet, is_contract: false },
    from: { hash: A, is_contract: false, public_tags: [] }
  }] })
  const fetchImpl = async (url) => {
    const wallet = url.match(/addresses\/(0x[a-f0-9]{40})\//)?.[1]
    return { ok: true, json: async () => payload(wallet) }
  }
  const r = new FundingClusterResolver({ fetchImpl, timeoutMs: 1000, bootstrapEnabled: true })
  const x = await r.resolve(W)
  const y = await r.resolve(B)
  assert.equal(x.cluster, `funder:${A}`)
  assert.equal(y.cluster, `funder:${A}`)
})

test('sequencer native funding clusters tracked wallets without Blockscout', async () => {
  const r = new FundingClusterResolver({ bootstrapEnabled: false })
  r.observeNativeFunding({ wallet: W, funder: A, valueWei: '3000000000000000', txHash: '0x' + '3'.repeat(64), timestampMs: 1 })
  r.observeNativeFunding({ wallet: B, funder: A, valueWei: '4000000000000000', txHash: '0x' + '4'.repeat(64), timestampMs: 2 })

  const x = await r.resolve(W)
  const y = await r.resolve(B)
  assert.equal(x.cluster, `funder:${A}`)
  assert.equal(y.cluster, `funder:${A}`)
  assert.equal(x.source, 'sequencer_native_inbound')
  assert.equal(y.source, 'sequencer_native_inbound')
})

test('shared sequencer funder is suppressed instead of collapsing unrelated wallets', async () => {
  const r = new FundingClusterResolver({ bootstrapEnabled: false, maxWalletsPerFunder: 2 })
  r.observeNativeFunding({ wallet: W, funder: A, valueWei: '3000000000000000' })
  r.observeNativeFunding({ wallet: B, funder: A, valueWei: '3000000000000000' })
  r.observeNativeFunding({ wallet: C, funder: A, valueWei: '3000000000000000' })

  const x = await r.resolve(W)
  const y = await r.resolve(B)
  const z = await r.resolve(C)
  assert.equal(x.cluster, W)
  assert.equal(y.cluster, B)
  assert.equal(z.cluster, C)
  assert.equal(x.confidence, 'shared_funder_suppressed')
  assert.equal(y.confidence, 'shared_funder_suppressed')
  assert.equal(z.confidence, 'shared_funder_suppressed')
})
