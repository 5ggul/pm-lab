const ADDRESS_RE = /^0x[a-f0-9]{40}$/
const lower = (v) => String(v ?? '').toLowerCase()

function publicLabel(entity) {
  if (!entity || typeof entity !== 'object') return ''
  const parts = [entity.name, entity.ens_domain_name, entity.metadata?.name]
  for (const tag of entity.public_tags ?? []) parts.push(tag?.display_name, tag?.label)
  return parts.filter(Boolean).join(' ').toLowerCase()
}

const SHARED_SERVICE_HINTS = [
  'binance', 'coinbase', 'okx', 'bybit', 'kraken', 'gate.io', 'gate ', 'kucoin',
  'bitget', 'mexc', 'exchange', 'bridge', 'deposit', 'hot wallet', 'router', 'relayer'
]

export function isSharedFundingEntity(entity) {
  if (!entity || typeof entity !== 'object') return false
  if (entity.is_contract === true) return true
  const label = publicLabel(entity)
  return SHARED_SERVICE_HINTS.some((hint) => label.includes(hint))
}

export function pickRecentDirectFunder(payload, wallet, { minWei = 1_000_000_000_000_000n } = {}) {
  const target = lower(wallet)
  const rows = Array.isArray(payload?.items) ? payload.items : []
  const candidates = []
  for (const tx of rows) {
    if (tx?.status === 'error' || tx?.result === 'error') continue
    const to = lower(tx?.to?.hash ?? tx?.to)
    const from = lower(tx?.from?.hash ?? tx?.from)
    if (to !== target || !ADDRESS_RE.test(from) || from === target) continue
    let value
    try { value = BigInt(String(tx?.value ?? '0')) } catch { continue }
    if (value < minWei) continue
    const fromEntity = typeof tx?.from === 'object' ? tx.from : null
    if (isSharedFundingEntity(fromEntity)) continue
    const ts = Date.parse(String(tx?.timestamp ?? ''))
    candidates.push({
      funder: from,
      valueWei: value,
      timestampMs: Number.isFinite(ts) ? ts : 0,
      txHash: lower(tx?.hash ?? tx?.transaction_hash),
      source: 'blockscout_recent_native_inbound'
    })
  }
  candidates.sort((a, b) => b.timestampMs - a.timestampMs || Number(b.valueWei - a.valueWei))
  return candidates[0] ?? null
}

/**
 * Same-funder clustering is deliberately conservative.
 *
 * The live path comes from the sequencer itself: a signed EOA transaction with native value sent
 * directly to a tracked smart wallet. That needs no address-history API and is available before
 * RPC indexing catches up. A funder that touches too many tracked wallets is treated as shared
 * infrastructure (exchange/hot wallet) and suppressed rather than collapsing unrelated traders.
 *
 * Blockscout is optional historical bootstrap only. The public explorer can 403 datacenter IPs;
 * when BLOCKSCOUT_API_KEY is absent, live sequencer observations remain the source of truth.
 */
export class FundingClusterResolver {
  constructor({
    blockscoutKey = process.env.BLOCKSCOUT_API_KEY ?? '',
    baseUrl = process.env.BLOCKSCOUT_API_BASE ?? (blockscoutKey
      ? 'https://api.blockscout.com/4663/api/v2'
      : 'https://robinhoodchain.blockscout.com/api/v2'),
    fetchImpl = fetch,
    timeoutMs = Number(process.env.FUNDING_LOOKUP_TIMEOUT_MS ?? 3500),
    minEth = Number(process.env.FUNDING_MIN_ETH ?? 0.001),
    maxWalletsPerFunder = Number(process.env.FUNDING_MAX_WALLETS_PER_FUNDER ?? 5),
    bootstrapEnabled = process.env.FUNDING_BOOTSTRAP_BLOCKSCOUT === '1' || Boolean(blockscoutKey)
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.blockscoutKey = blockscoutKey
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
    this.minWei = BigInt(Math.max(0, Math.floor(minEth * 1e18)))
    this.maxWalletsPerFunder = Math.max(2, Math.trunc(maxWalletsPerFunder))
    this.bootstrapEnabled = bootstrapEnabled
    this.cache = new Map()
    this.inflight = new Map()
    this.walletFunder = new Map()
    this.funderWallets = new Map()
  }

  seed(result) {
    const wallet = lower(result?.wallet)
    const funder = lower(result?.funder)
    if (!ADDRESS_RE.test(wallet)) return
    const normalized = {
      ...result,
      wallet,
      cluster: String(result?.cluster ?? wallet),
      funder: ADDRESS_RE.test(funder) ? funder : null
    }
    this.cache.set(wallet, normalized)
    if (normalized.funder) this.#attach(wallet, normalized.funder)
  }

  #attach(wallet, funder) {
    const previous = this.walletFunder.get(wallet)
    if (previous && previous !== funder) {
      const oldSet = this.funderWallets.get(previous)
      oldSet?.delete(wallet)
      if (oldSet?.size === 0) this.funderWallets.delete(previous)
    }
    this.walletFunder.set(wallet, funder)
    const set = this.funderWallets.get(funder) ?? new Set()
    set.add(wallet)
    this.funderWallets.set(funder, set)
    return set
  }

  observeNativeFunding({ wallet: walletAddress, funder: funderAddress, valueWei, txHash = null, timestampMs = Date.now() }) {
    const wallet = lower(walletAddress)
    const funder = lower(funderAddress)
    if (!ADDRESS_RE.test(wallet) || !ADDRESS_RE.test(funder) || wallet === funder) return []
    let value
    try { value = BigInt(String(valueWei ?? 0)) } catch { return [] }
    if (value < this.minWei) return []

    const members = this.#attach(wallet, funder)
    const shared = members.size > this.maxWalletsPerFunder
    const affected = []
    for (const member of members) {
      const result = shared
        ? {
            wallet: member,
            cluster: member,
            funder,
            resolved: true,
            confidence: 'shared_funder_suppressed',
            valueWei: member === wallet ? value.toString() : this.cache.get(member)?.valueWei ?? null,
            txHash: member === wallet ? lower(txHash) : this.cache.get(member)?.txHash ?? null,
            timestampMs: member === wallet ? Number(timestampMs) : this.cache.get(member)?.timestampMs ?? null,
            source: 'sequencer_native_inbound'
          }
        : {
            wallet: member,
            cluster: `funder:${funder}`,
            funder,
            resolved: true,
            confidence: 'sequencer_direct_eoa',
            valueWei: member === wallet ? value.toString() : this.cache.get(member)?.valueWei ?? null,
            txHash: member === wallet ? lower(txHash) : this.cache.get(member)?.txHash ?? null,
            timestampMs: member === wallet ? Number(timestampMs) : this.cache.get(member)?.timestampMs ?? null,
            source: 'sequencer_native_inbound'
          }
      this.cache.set(member, result)
      affected.push(result)
    }
    return affected
  }

  async resolve(walletAddress) {
    const wallet = lower(walletAddress)
    if (!ADDRESS_RE.test(wallet)) return { wallet, cluster: wallet, funder: null, resolved: false, reason: 'invalid_address' }
    if (this.cache.has(wallet)) return this.cache.get(wallet)
    if (!this.bootstrapEnabled) {
      return { wallet, cluster: wallet, funder: null, resolved: false, reason: 'historical_bootstrap_disabled' }
    }
    if (this.inflight.has(wallet)) return this.inflight.get(wallet)

    const task = this.#fetch(wallet).finally(() => this.inflight.delete(wallet))
    this.inflight.set(wallet, task)
    return task
  }

  async #fetch(wallet) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const qs = this.blockscoutKey ? `?filter=to&apikey=${encodeURIComponent(this.blockscoutKey)}` : '?filter=to'
      const url = `${this.baseUrl}/addresses/${wallet}/transactions${qs}`
      const response = await this.fetchImpl(url, {
        headers: { accept: 'application/json', 'user-agent': 'meme-radar/0.1' },
        signal: controller.signal
      })
      if (!response.ok) throw new Error(`blockscout ${response.status}`)
      const payload = await response.json()
      const found = pickRecentDirectFunder(payload, wallet, { minWei: this.minWei })
      const result = found
        ? {
            wallet,
            cluster: `funder:${found.funder}`,
            funder: found.funder,
            resolved: true,
            confidence: 'blockscout_recent_direct_eoa',
            valueWei: found.valueWei.toString(),
            timestampMs: found.timestampMs,
            txHash: found.txHash,
            source: found.source
          }
        : { wallet, cluster: wallet, funder: null, resolved: true, confidence: 'none_found', source: 'blockscout' }
      this.seed(result)
      return result
    } catch (e) {
      const result = { wallet, cluster: wallet, funder: null, resolved: false, reason: String(e?.message ?? e) }
      this.cache.set(wallet, result)
      return result
    } finally {
      clearTimeout(timer)
    }
  }

  async hydrateProfiles(profiles, { concurrency = 4, onResolved = () => {} } = {}) {
    const addresses = [...profiles.keys()].filter((a) => ADDRESS_RE.test(lower(a)))
    if (!this.bootstrapEnabled) {
      return { total: addresses.length, resolved: 0, clustered: 0, skipped: 'blockscout_bootstrap_disabled' }
    }
    let next = 0
    let resolved = 0
    let clustered = 0
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, addresses.length || 1)) }, async () => {
      while (next < addresses.length) {
        const i = next++
        const address = lower(addresses[i])
        const result = await this.resolve(address)
        const profile = profiles.get(address)
        if (!profile) continue
        profile.fundingCluster = result.cluster
        profile.fundingClusterResolved = result.resolved
        profile.funder = result.funder
        profile.fundingClusterConfidence = result.confidence ?? null
        profiles.set(address, profile)
        if (result.resolved) resolved += 1
        if (result.funder) clustered += 1
        onResolved(address, result, profile)
      }
    })
    await Promise.all(workers)
    return { total: addresses.length, resolved, clustered }
  }
}
