const DEFAULT_DIRECT_ROUTERS = ['0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f']
const ADDRESS_RE = /^0x[a-f0-9]{40}$/
const ZERO = '0x0000000000000000000000000000000000000000'
const lower = (v) => String(v ?? '').toLowerCase()

export function routerSet() {
  const configured = (process.env.FOMO_DIRECT_ROUTERS ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
  return new Set(configured.length ? configured : DEFAULT_DIRECT_ROUTERS)
}

export function isDirectRouterAddress(address, directRouters = routerSet()) {
  const normalized = lower(address)
  return ADDRESS_RE.test(normalized) && directRouters.has(normalized)
}

export function classifyWalletAttribution({ receiptTo, usdValue, profile, directRouters = routerSet() }) {
  const to = lower(receiptTo)
  if (isDirectRouterAddress(to, directRouters)) return { kind: 'direct', countsAsSmart: false }

  const absoluteFloor = Number(process.env.DUST_ABS_USD ?? 5)
  const ratio = Number(process.env.DUST_RATIO ?? 0.02)
  const median = Number(profile?.medianBuyUsd ?? 0)
  const dustFloor = Math.max(absoluteFloor, median > 0 ? median * ratio : 0)
  if (Number(usdValue) < dustFloor) return { kind: 'dust', countsAsSmart: false, dustFloor }

  return { kind: 'verified_trade', countsAsSmart: true, dustFloor }
}

function largest(candidates) {
  if (!candidates.length) return null
  return candidates.reduce((best, item) => !best || item.amount > best.amount ? item : best, null)
}

/**
 * Resolve the economic token-side wallet without trusting tx.from.
 * FOMO transactions are relayed, so the signer is not the trader. The strongest identity is
 * the ERC-20 leg facing the known router: router -> wallet on buys, wallet -> router on sells.
 * For ordinary V2/V3 swaps we can fall back to the pool-facing token leg.
 * If neither relationship exists, return null rather than inventing a distinct buyer per tx.
 */
export function chooseTradeParticipant({ transfers, isBuy, poolAddress = null, directRouters = routerSet() }) {
  const pool = lower(poolAddress)
  const routed = []
  const pooled = []
  for (const t of transfers ?? []) {
    const from = lower(t.from)
    const to = lower(t.to)
    if (!ADDRESS_RE.test(from) || !ADDRESS_RE.test(to)) continue
    const amount = typeof t.value === 'bigint' ? t.value : BigInt(t.value ?? 0)
    if (amount <= 0n) continue

    if (isBuy && directRouters.has(from) && !directRouters.has(to) && to !== ZERO) {
      routed.push({ wallet: to, amount, source: 'router_leg' })
    } else if (!isBuy && directRouters.has(to) && !directRouters.has(from) && from !== ZERO) {
      routed.push({ wallet: from, amount, source: 'router_leg' })
    }

    if (pool && ADDRESS_RE.test(pool)) {
      if (isBuy && from === pool && to !== ZERO) pooled.push({ wallet: to, amount, source: 'pool_leg' })
      else if (!isBuy && to === pool && from !== ZERO) pooled.push({ wallet: from, amount, source: 'pool_leg' })
    }
  }
  return largest(routed) ?? largest(pooled)
}

export function chooseTrackedWallet({ transfers, isBuy, trackedProfiles, receiptTo, usdValue, directRouters = routerSet() }) {
  const candidates = []
  for (const t of transfers ?? []) {
    const from = lower(t.from)
    const to = lower(t.to)
    let wallet = null
    let routerFacing = false

    if (isBuy && directRouters.has(from)) {
      wallet = to
      routerFacing = true
    } else if (!isBuy && directRouters.has(to)) {
      wallet = from
      routerFacing = true
    } else {
      // Kept only for seeded/direct detection on venue paths that do not expose the FOMO router leg.
      wallet = lower(isBuy ? t.to : t.from)
    }

    if (!ADDRESS_RE.test(wallet) || wallet === ZERO) continue
    const profile = trackedProfiles.get(wallet)
    if (!profile) continue
    const attribution = classifyWalletAttribution({ receiptTo, usdValue, profile, directRouters })
    candidates.push({ wallet, profile, attribution, amount: t.value, routerFacing })
  }

  // A real FOMO smart-wallet trade must show the router-facing token leg. A fallback tracked
  // transfer is still retained in candidates for spoof/seed diagnostics but cannot become smart.
  for (const c of candidates) {
    if (!c.routerFacing && c.attribution.countsAsSmart) {
      c.attribution = { ...c.attribution, kind: 'unverified_transfer', countsAsSmart: false }
    }
  }

  const verified = candidates.filter((c) => c.attribution.countsAsSmart)
  verified.sort((a, b) => Number(b.profile?.quality ?? 0) - Number(a.profile?.quality ?? 0))
  return {
    wallet: verified[0]?.wallet ?? null,
    attribution: verified[0]?.attribution ?? candidates[0]?.attribution ?? { kind: 'unattributed', countsAsSmart: false },
    candidates
  }
}
