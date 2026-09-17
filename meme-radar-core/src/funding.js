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

export class FundingClusterResolver {
  constructor({
    baseUrl = process.env.BLOCKSCOUT_API_BASE ?? 'https://robinhoodchain.blockscout.com/api/v2',
    fetchImpl = fetch,
    timeoutMs = Number(process.env.FUNDING_LOOKUP_TIMEOUT_MS ?? 3500),
    minEth = Number(process.env.FUNDING_MIN_ETH ?? 0.001)
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
    this.minWei = BigInt(Math.max(0, Math.floor(minEth * 1e18)))
    this.cache = new Map()
    this.inflight = new Map()
  }

  async resolve(walletAddress) {
    const wallet = lower(walletAddress)
    if (!ADDRESS_RE.test(wallet)) return { wallet, cluster: wallet, funder: null, resolved: false, reason: 'invalid_address' }
    if (this.cache.has(wallet)) return this.cache.get(wallet)
    if (this.inflight.has(wallet)) return this.inflight.get(wallet)

    const task = this.#fetch(wallet).finally(() => this.inflight.delete(wallet))
    this.inflight.set(wallet, task)
    return task
  }

  async #fetch(wallet) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const url = `${this.baseUrl}/addresses/${wallet}/transactions?filter=to`
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
            confidence: 'heuristic_recent_direct_eoa',
            valueWei: found.valueWei.toString(),
            timestampMs: found.timestampMs,
            txHash: found.txHash
          }
        : { wallet, cluster: wallet, funder: null, resolved: true, confidence: 'none_found' }
      this.cache.set(wallet, result)
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
