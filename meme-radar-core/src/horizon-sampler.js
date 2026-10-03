import { readV4MarketCap } from './v4-state.js'

export class HorizonSampler {
  constructor({
    learner,
    adapter,
    intervalMs = Number(process.env.HORIZON_SAMPLE_INTERVAL_MS ?? 30_000),
    maxTokensPerPass = Number(process.env.HORIZON_SAMPLE_MAX_TOKENS ?? 25),
    onTelemetry = () => {}
  }) {
    this.learner = learner
    this.adapter = adapter
    this.intervalMs = Math.max(10_000, Number(intervalMs) || 30_000)
    this.maxTokensPerPass = Math.max(1, Math.trunc(Number(maxTokensPerPass) || 25))
    this.onTelemetry = onTelemetry
    this.timer = null
    this.running = false
  }

  async sampleToken(item, measuredAt) {
    const meta = await this.adapter.ensureTokenMeta(item.token)
    const quoteUsd = await this.adapter.quoteUsd({
      address: item.quoteAddress,
      symbol: item.quoteSymbol,
      decimals: item.quoteDecimals,
      usdKind: item.quoteUsdKind
    })
    const state = await readV4MarketCap(this.adapter.hood.public, {
      poolId: item.poolId,
      tokenIs0: item.tokenIs0,
      tokenDecimals: meta.decimals,
      quoteDecimals: item.quoteDecimals,
      totalSupply: meta.totalSupply,
      quoteUsd
    })

    // These tokens had meaningful trades when they entered the learner. If the same V4 pool has
    // zero active liquidity at a due horizon, omitting it would create survivorship bias and make
    // rug-prone wallets look better. Record an explicit zero outcome. A positive-liquidity state
    // with an invalid/non-positive market cap is still treated as a measurement failure.
    if (state.liquidity === 0n) {
      const settled = this.learner.settleToken(item.token, 0, measuredAt, {
        source: 'v4_state_view_zero_liquidity',
        allowZero: true
      })
      this.onTelemetry({
        type: 'horizon-sample-rug', token: item.token, poolId: item.poolId,
        horizons: item.horizons, settled, liquidity: '0', marketCapUsd: 0,
        observedAt: measuredAt
      })
      return { settled, marketCapUsd: 0, liquidity: 0n, rug: true }
    }

    if (!(state.marketCapUsd > 0)) {
      this.onTelemetry({
        type: 'horizon-sample-skip', token: item.token, poolId: item.poolId,
        horizons: item.horizons, liquidity: state.liquidity?.toString?.() ?? '0',
        marketCapUsd: state.marketCapUsd, observedAt: measuredAt
      })
      return { settled: 0, marketCapUsd: state.marketCapUsd, liquidity: state.liquidity }
    }

    const settled = this.learner.settleToken(item.token, state.marketCapUsd, measuredAt, {
      source: 'v4_state_view'
    })
    this.onTelemetry({
      type: 'horizon-sample', token: item.token, poolId: item.poolId,
      horizons: item.horizons, settled,
      marketCapUsd: Math.round(state.marketCapUsd * 100) / 100,
      liquidity: state.liquidity.toString(), observedAt: measuredAt
    })
    return { settled, marketCapUsd: state.marketCapUsd, liquidity: state.liquidity }
  }

  async sampleOnce(measuredAt = Date.now()) {
    if (this.running) return { skipped: true, reason: 'already_running' }
    this.running = true
    try {
      const due = this.learner.tokensDueForSampling(measuredAt, { limit: this.maxTokensPerPass })
      let sampled = 0
      let settled = 0
      let failed = 0

      // Public RPC is rate limited. One pool at a time keeps the sampler low pressure; production
      // can raise cadence through a dedicated provider without changing settlement semantics.
      for (const item of due) {
        try {
          const result = await this.sampleToken(item, measuredAt)
          sampled += 1
          settled += Number(result.settled ?? 0)
        } catch (e) {
          failed += 1
          this.onTelemetry({
            type: 'horizon-sample-error', token: item.token, poolId: item.poolId,
            horizons: item.horizons, message: String(e?.message ?? e), observedAt: measuredAt
          })
        }
      }

      if (due.length || process.env.LOG_HORIZON_IDLE === '1') {
        this.onTelemetry({
          type: 'horizon-sample-pass', dueTokens: due.length, sampled, settled, failed,
          observedAt: measuredAt
        })
      }
      return { dueTokens: due.length, sampled, settled, failed }
    } finally {
      this.running = false
    }
  }

  start() {
    if (this.timer || process.env.HORIZON_SAMPLER_ENABLED === '0') return false
    this.sampleOnce().catch(() => {})
    this.timer = setInterval(() => this.sampleOnce().catch(() => {}), this.intervalMs)
    this.timer.unref?.()
    return true
  }

  stop() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }
}
