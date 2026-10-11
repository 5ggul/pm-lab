import { setTimeout as sleep } from 'node:timers/promises'
import { EarlyWalletLearner } from '../src/early-wallet-learning.js'
import { HorizonSampler } from '../src/horizon-sampler.js'
import { SmartRobinhoodAdapter } from '../src/robinhood-smart.js'
import { ShadowStore } from '../src/store.js'

const clamp = (value, min, max, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

const durationMin = clamp(process.env.LONGITUDINAL_DURATION_MIN, 1, 350, 20)
const intervalMs = clamp(process.env.HORIZON_SAMPLE_INTERVAL_MS, 10_000, 300_000, 30_000)
const maxTokensPerPass = Math.trunc(clamp(process.env.HORIZON_SAMPLE_MAX_TOKENS, 1, 250, 100))
const dbPath = process.env.RADAR_DB_PATH ?? 'shadow-soak.sqlite'

const store = new ShadowStore(dbPath)
const learner = new EarlyWalletLearner(store.db)
const telemetry = (event) => console.log(JSON.stringify(event))
const adapter = new SmartRobinhoodAdapter({
  onTrade: () => {},
  trackedProfiles: new Map(),
  onTelemetry: telemetry
})
const sampler = new HorizonSampler({
  learner,
  adapter,
  intervalMs,
  maxTokensPerPass,
  onTelemetry: telemetry
})

let stopping = false
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { stopping = true })
}

const startedAt = Date.now()
const deadline = startedAt + durationMin * 60_000
const totals = { passes: 0, dueTokens: 0, sampled: 0, settled: 0, failed: 0 }

console.log(JSON.stringify({
  type: 'LONGITUDINAL_START', dbPath, durationMin, intervalMs, maxTokensPerPass,
  earlyLearning: learner.summary(), observedAt: startedAt
}))

try {
  while (!stopping && Date.now() < deadline) {
    const result = await sampler.sampleOnce(Date.now())
    if (!result?.skipped) {
      totals.passes += 1
      totals.dueTokens += Number(result?.dueTokens ?? 0)
      totals.sampled += Number(result?.sampled ?? 0)
      totals.settled += Number(result?.settled ?? 0)
      totals.failed += Number(result?.failed ?? 0)
    }
    const remaining = deadline - Date.now()
    if (remaining <= 0 || stopping) break
    await sleep(Math.min(intervalMs, remaining))
  }
} finally {
  adapter.stop?.()
  console.log(JSON.stringify({
    type: 'LONGITUDINAL_DONE', ...totals, earlyLearning: learner.summary(),
    runtimeMs: Date.now() - startedAt, observedAt: Date.now()
  }))
  store.close()
}
