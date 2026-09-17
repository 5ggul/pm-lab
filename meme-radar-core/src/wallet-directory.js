const DEFAULT_URL = 'https://fomoradar.app/api/leaderboard?status=active&limit=400'

export async function syncPublicWalletRoster(target, { url = process.env.SMART_WALLET_DIRECTORY_URL ?? DEFAULT_URL } = {}) {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'meme-radar/0.1' } })
  if (!response.ok) throw new Error(`wallet directory HTTP ${response.status}`)
  const body = await response.json()
  const rows = Array.isArray(body?.traders) ? body.traders : []
  let accepted = 0
  for (const row of rows) {
    const address = String(row?.address ?? '').toLowerCase()
    const score = Number(row?.score)
    if (!/^0x[a-f0-9]{40}$/.test(address) || !Number.isFinite(score)) continue
    const existing = target.get(address) ?? {}
    target.set(address, {
      ...existing,
      handle: row.handle ?? existing.handle,
      quality: existing.earlyModelQuality ?? score,
      externalQuality: score,
      externalStatus: row.status ?? null,
      externalSummary: row.summary ?? null,
      source: existing.earlyModelQuality ? existing.source : 'fomoradar-public-leaderboard',
      fundingCluster: existing.fundingCluster ?? address,
      syncedAt: new Date().toISOString()
    })
    accepted += 1
  }
  return { accepted, total: rows.length }
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
