import fs from 'node:fs'
import { RadarEngine } from './engine.js'
import { RobinhoodAdapter } from './robinhood.js'

function loadWalletProfiles() {
  const file = process.env.WALLET_PROFILES_FILE ?? new URL('../wallet-profiles.json', import.meta.url)
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    return new Map(Object.entries(raw).map(([address, profile]) => [address.toLowerCase(), profile]))
  } catch {
    return new Map()
  }
}

async function notifyTelegram(signal) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  const text = [
    signal.band === 'PRIME_EARLY' ? '🔥 PRIME EARLY' : `📡 ${signal.band}`,
    signal.symbol ? `$${signal.symbol}` : signal.token,
    `MC $${Math.round(signal.marketCapUsd).toLocaleString('en-US')}`,
    `Score ${signal.score}/${signal.threshold}`,
    `Smart ${signal.independentSmartBuyers} · Buyers10s ${signal.uniqueBuyers10s}`,
    `Buy10s $${Math.round(signal.buyUsd10s).toLocaleString('en-US')} · B/S ${signal.buySellRatio.toFixed(1)}x`,
    `Age ${(signal.ageMs / 1000).toFixed(1)}s`,
    signal.token
  ].join('\n')
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  }).catch(() => {})
}

const profiles = loadWalletProfiles()
const engine = new RadarEngine({
  walletProfiles: profiles,
  onSignal: (signal) => {
    console.log(JSON.stringify({ type: 'SIGNAL', ...signal }))
    notifyTelegram(signal)
  }
})
for (const [address, profile] of profiles) engine.setWalletProfile(address, profile)

const adapter = new RobinhoodAdapter({
  onTrade: (trade) => {
    const result = engine.ingestTrade(trade)
    if (result) console.log(JSON.stringify({ type: 'RADAR', symbol: trade.symbol, ...result }))
  },
  onLaunch: (launch) => console.log(JSON.stringify({ type: 'LAUNCH', ...launch, blockNumber: launch.blockNumber?.toString?.() })),
  onTelemetry: (event) => process.env.LOG_TELEMETRY === '1' && console.log(JSON.stringify(event))
})

await adapter.start()
console.log(JSON.stringify({
  type: 'READY', chain: 'robinhood', maxMcap: 1_000_000, primeMcap: 100_000,
  walletProfiles: profiles.size, feed: process.env.RH_DISABLE_FEED === '1' ? 'disabled' : 'sequencer'
}))

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { adapter.stop(); process.exit(0) })
}
