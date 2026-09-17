const DEFAULT_DIRECT_ROUTERS = ['0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f']

export function routerSet() {
  const configured = (process.env.FOMO_DIRECT_ROUTERS ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
  return new Set(configured.length ? configured : DEFAULT_DIRECT_ROUTERS)
}

export function classifyWalletAttribution({ receiptTo, usdValue, profile, directRouters = routerSet() }) {
  const to = String(receiptTo ?? '').toLowerCase()
  if (to && directRouters.has(to)) return { kind: 'direct', countsAsSmart: false }

  const absoluteFloor = Number(process.env.DUST_ABS_USD ?? 5)
  const ratio = Number(process.env.DUST_RATIO ?? 0.02)
  const median = Number(profile?.medianBuyUsd ?? 0)
  const dustFloor = Math.max(absoluteFloor, median > 0 ? median * ratio : 0)
  if (Number(usdValue) < dustFloor) return { kind: 'dust', countsAsSmart: false, dustFloor }

  return { kind: 'verified_trade', countsAsSmart: true, dustFloor }
}

export function chooseTrackedWallet({ transfers, isBuy, trackedProfiles, receiptTo, usdValue }) {
  const candidates = []
  for (const t of transfers) {
    const wallet = (isBuy ? t.to : t.from)?.toLowerCase()
    if (!wallet) continue
    const profile = trackedProfiles.get(wallet)
    if (!profile) continue
    const attribution = classifyWalletAttribution({ receiptTo, usdValue, profile })
    candidates.push({ wallet, profile, attribution, amount: t.value })
  }
  const verified = candidates.filter((c) => c.attribution.countsAsSmart)
  verified.sort((a, b) => Number(b.profile?.quality ?? 0) - Number(a.profile?.quality ?? 0))
  return {
    wallet: verified[0]?.wallet ?? null,
    attribution: verified[0]?.attribution ?? candidates[0]?.attribution ?? { kind: 'unattributed', countsAsSmart: false },
    candidates
  }
}
