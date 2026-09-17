import fs from 'node:fs'
import { RadarEngine } from './engine.js'
import { RobinhoodAdapter } from './robinhood.js'
import { syncPublicWalletRoster } from './wallet-directory.js'

function loadWalletProfiles() {
  const file = process.env.WALLET_PROFILES_FILE ?? new URL('../wallet-profiles.json', import.meta.url)
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    return new Map(Object.entries(raw).map(([address, profile]) => [address.toLowerCase(), profile]))
  } catch {
    return new Map()
  }
}

async function notifyTelegram(signal, kind) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  const title = kind === 'watch'
    ? '⚡ PRIME WATCH · 안전검사중'
    : signal.band === 'PRIME_EARLY' ? '🔥 PRIME VERIFIED' : `📡 ${signal.band} VERIFIED`
  const text = [
    title,
    signal.symbol ? `$${signal.symbol}` : signal.token,
    `MC $${Math.round(signal.marketCapUsd).toLocaleString('en-US')}`,
    `Radar ${signal.score}/${signal.threshold}`,
    `Smart ${signal.independentSmartBuyers} · Buyers10s ${signal.uniqueBuyers10s}`,
    `Buy10s $${Math.round(signal.buyUsd10s).toLocaleString('en-US')} · B/S ${signal.buySellRatio.toFixed(1)}x`,
    `Age ${(signal.ageMs / 1000).toFixed(1)}s`,
    kind === 'watch' ? 'HoodWatch audit: pending' : `HoodWatch: ${signal.risk?.auditVerdict ?? 'verified'}`,
    signal.token
  ].join('\n')
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  }).catch(() => {})
}

const profiles = loadWalletProfiles()
try {
  const sync = await syncPublicWalletRoster(profiles)
  console.log(JSON.stringify({ type: 'WALLET_ROSTER_SYNC', ...sync }))
} catch (e) {
  console.warn(JSON.stringify({ type: 'WALLET_ROSTER_SYNC_FAILED', message: String(e?.message ?? e), fallbackProfiles: profiles.size }))
}

const engine = new RadarEngine({
  walletProfiles: profiles,
  onWatch: (signal) => {
    console.log(JSON.stringify({ type: 'WATCH', ...signal }))
    notifyTelegram(signal, 'watch')
  },
  onSignal: (signal) => {
    console.log(JSON.stringify({ type: 'SIGNAL', ...signal }))
    notifyTelegram(signal, 'signal')
  }
})
for (const [address, profile] of profiles) engine.setWalletProfile(address, profile)

const adapter = new RobinhoodAdapter({
  trackedProfiles: profiles,
  onTrade: (trade) => {
    const result = engine.ingestTrade(trade)
    if (result && process.env.LOG_RADAR === '1') console.log(JSON.stringify({ type: 'RADAR', symbol: trade.symbol, ...result }))
  },
  onLaunch: (launch) => console.log(JSON.stringify({ type: 'LAUNCH', ...launch, blockNumber: launch.blockNumber?.toString?.() })),
  onAudit: ({ token, risk }) => console.log(JSON.stringify({
    type: 'AUDIT', token, verified: risk.securityVerified, score: risk.auditScore,
    verdict: risk.auditVerdict, hardFail: Boolean(risk.auditHardFail)
  })),
  onTelemetry: (event) => process.env.LOG_TELEMETRY === '1' && console.log(JSON.stringify(event))
})

await adapter.start()
console.log(JSON.stringify({
  type: 'READY', chain: 'robinhood', maxMcap: 1_000_000, primeMcap: 100_000,
  walletProfiles: profiles.size, feed: process.env.RH_DISABLE_FEED === '1' ? 'disabled' : 'sequencer',
  eventTransport: process.env.RH_WS_URL ? 'websocket' : 'http-polling'
}))

const rosterTimer = setInterval(async () => {
  try {
    const sync = await syncPublicWalletRoster(profiles)
    for (const [address, profile] of profiles) engine.setWalletProfile(address, profile)
    console.log(JSON.stringify({ type: 'WALLET_ROSTER_REFRESH', ...sync }))
  } catch (e) {
    console.warn(JSON.stringify({ type: 'WALLET_ROSTER_REFRESH_FAILED', message: String(e?.message ?? e) }))
  }
}, Number(process.env.WALLET_ROSTER_REFRESH_MS ?? 600_000))
rosterTimer.unref?.()

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { adapter.stop(); clearInterval(rosterTimer); process.exit(0) })
}
