const DEFAULT_URL = 'https://fomoradar.app/api/leaderboard?status=all&limit=600'

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value)))
const isAddress = (value) => /^0x[a-f0-9]{40}$/.test(String(value ?? '').toLowerCase())

/**
 * Convert one public FOMO leaderboard row into a radar wallet profile.
 *
 * FOLLOW/active remains the primary prior. WATCH is allowed only when its source score is strong
 * enough to remain smart-qualified after a conservative 10-point uncertainty penalty. DROP is
 * fail-closed and never enters the tracked roster, even if its historical numeric score is high.
 */
export function normalizeDirectoryRow(row, existing = {}) {
  const address = String(row?.address ?? '').toLowerCase()
  const rawScore = Number(row?.score)
  const status = String(row?.status ?? '').toLowerCase()
  if (!isAddress(address) || !Number.isFinite(rawScore)) return null
  if (status !== 'active' && status !== 'watch') return null

  const statusPenalty = status === 'watch' ? 10 : 0
  const externalQuality = clamp(rawScore - statusPenalty)

  // A WATCH wallet must still clear the engine's 70 smart-wallet quality floor after penalty.
  // This widens coverage without turning the whole uncertain WATCH cohort into smart money.
  if (status === 'watch' && externalQuality < 70) return null

  const learned = Number(existing?.earlyModelQuality)
  const hasLearnedQuality = Number.isFinite(learned)
  const source = hasLearnedQuality
    ? (existing.source ?? 'local-early-model')
    : status === 'watch'
      ? 'fomoradar-public-watch-penalized'
      : 'fomoradar-public-leaderboard'

  return {
    address,
    profile: {
      ...existing,
      handle: row.handle ?? existing.handle,
      quality: hasLearnedQuality ? clamp(learned) : externalQuality,
      externalQuality,
      externalRawScore: clamp(rawScore),
      externalStatus: status,
      externalStatusPenalty: statusPenalty,
      externalSummary: row.summary ?? null,
      source,
      fundingCluster: existing.fundingCluster ?? address,
      syncedAt: new Date().toISOString()
    }
  }
}

export async function syncPublicWalletRoster(target, { url = process.env.SMART_WALLET_DIRECTORY_URL ?? DEFAULT_URL } = {}) {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'meme-radar/0.1' } })
  if (!response.ok) throw new Error(`wallet directory HTTP ${response.status}`)
  const body = await response.json()
  const rows = Array.isArray(body?.traders) ? body.traders : []
  const statusCounts = { active: 0, watch: 0, dropped: 0, other: 0 }
  let accepted = 0
  let smartEligible = 0

  for (const row of rows) {
    const status = String(row?.status ?? '').toLowerCase()
    if (Object.hasOwn(statusCounts, status)) statusCounts[status] += 1
    else statusCounts.other += 1

    const address = String(row?.address ?? '').toLowerCase()
    const existing = target.get(address) ?? {}
    const normalized = normalizeDirectoryRow(row, existing)
    if (!normalized) continue

    target.set(normalized.address, normalized.profile)
    accepted += 1
    if (Number(normalized.profile.quality) >= 70) smartEligible += 1
  }

  return { accepted, total: rows.length, smartEligible, statusCounts }
}

export function applyEarlyModel(profile, stats) {
  const samples = Number(stats?.settledEarlyTrades ?? 0)
  if (samples < 8) return { ...profile, earlySampleSize: samples }
  const win = Math.max(0, Math.min(1, Number(stats?.winRate ?? 0)))
  const rugAvoid = Math.max(0, Math.min(1, 1 - Number(stats?.rugRate ?? 1)))
  const x2 = Math.max(0, Math.min(1, Number(stats?.hit2xRate ?? 0)))
  const x5 = Math.max(0, Math.min(1, Number(stats?.hit5xRate ?? 0)))
  const sampleConfidence = Math.min(1, samples / 40)
  const raw = 100 * (win * 0.30 + rugAvoid * 0.25 + x2 * 0.25 + x5 * 0.20)
  const external = Number(profile?.externalQuality ?? 50)
  const earlyModelQuality = external * (1 - sampleConfidence) + raw * sampleConfidence
  return { ...profile, earlyModelQuality, quality: earlyModelQuality, earlySampleSize: samples }
}
