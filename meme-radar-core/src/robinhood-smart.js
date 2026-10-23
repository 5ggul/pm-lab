import { auditToken } from './audit.js'
import { readEthUsdFromV3 } from './eth-usd.js'
import { RobinhoodAdapter } from './robinhood.js'
import {
  classifyWalletAttribution,
  chooseTradeParticipant,
  chooseTrackedWallet,
  isDirectRouterAddress,
  verifySignedWalletTransfer
} from './provenance.js'

const lower = (v) => String(v ?? '').toLowerCase()
const isAddress = (v) => /^0x[a-f0-9]{40}$/.test(lower(v))
const isSmartEligibleProfile = (profile) => profile?.smartEligible === true && Number(profile?.quality) >= 70

/**
 * Accuracy layer over the venue adapter.
 *
 * Sequencer signatures are fast enough for ordinary buyer velocity, but generic routers may send
 * bought tokens to a recipient other than tx.from. Smart credit therefore requires receipt proof.
 * Receipt verification is deferred and retried so a rate-limited RPC never blocks the ordinary
 * buyer event; a later proof upgrades the already-persisted tx in place.
 */
export class SmartRobinhoodAdapter extends RobinhoodAdapter {
  constructor(options = {}) {
    super(options)
    this.onAttributionUpdate = options.onAttributionUpdate ?? (() => {})
    this.smartReceiptJobs = new Map()
  }

  smartTrackedProfiles() {
    return new Map([...this.trackedProfiles].filter(([, profile]) => isSmartEligibleProfile(profile)))
  }

  smartReceiptRetryDelays() {
    return [350, 900, 1_800, 3_200]
  }

  emitAttributionUpdate(update) {
    try {
      const result = this.onAttributionUpdate(update)
      if (result?.catch) result.catch((e) => this.onTelemetry({
        type: 'smart-attribution-update-error', txHash: update.txHash, message: String(e?.message ?? e)
      }))
    } catch (e) {
      this.onTelemetry({ type: 'smart-attribution-update-error', txHash: update.txHash, message: String(e?.message ?? e) })
    }
  }

  scheduleSmartReceiptVerification({ pool, isBuy, transactionHash, usdValue, signer, profile, origin }) {
    const key = lower(transactionHash)
    if (!key || this.smartReceiptJobs.has(key)) return false
    const delays = this.smartReceiptRetryDelays()
    const job = { timer: null, attempt: 0, startedAt: Date.now() }
    this.smartReceiptJobs.set(key, job)

    const finish = () => {
      if (job.timer) clearTimeout(job.timer)
      this.smartReceiptJobs.delete(key)
    }

    const run = async () => {
      const attempt = job.attempt
      try {
        const receipt = await this.hood.public.getTransactionReceipt({ hash: transactionHash })
        const transfers = this.decodeTokenTransfers(receipt, pool.token)
        const verified = verifySignedWalletTransfer({
          transfers, isBuy, signer, profile,
          receiptTo: receipt.to ?? origin.to, usdValue
        })
        const observedAt = Date.now()

        if (verified.verified) {
          const candidate = {
            wallet: signer, profile, attribution: verified.attribution,
            amount: verified.amount, routerFacing: true
          }
          const seeded = this.updateSpoofState(pool.token, {
            wallet: signer, attribution: verified.attribution, candidates: [candidate]
          })
          let risk
          if (seeded) {
            const base = this.risks.get(lower(pool.token)) ?? {}
            risk = { ...base, seeded: true }
            this.risks.set(lower(pool.token), risk)
          }
          this.emitAttributionUpdate({
            chain: 'robinhood', token: pool.token, txHash: transactionHash, isBuy,
            trader: signer, participant: signer,
            participantSource: 'verified_smart_signer_receipt',
            attribution: 'verified_signer_receipt', risk, observedAt
          })
        } else {
          this.emitAttributionUpdate({
            chain: 'robinhood', token: pool.token, txHash: transactionHash, isBuy,
            attribution: verified.attribution.kind, observedAt
          })
        }

        this.onTelemetry({
          type: 'smart-signer-receipt', txHash: transactionHash, signer,
          attempt: attempt + 1, verified: verified.verified,
          attribution: verified.attribution.kind,
          latencyMs: observedAt - job.startedAt,
          to: origin.to, selector: origin.selector, observedAt
        })
        finish()
      } catch (e) {
        this.onTelemetry({
          type: 'smart-signer-receipt-error', txHash: transactionHash, signer,
          attempt: attempt + 1, message: String(e?.message ?? e), observedAt: Date.now()
        })
        job.attempt += 1
        if (job.attempt >= delays.length) {
          finish()
          return
        }
        job.timer = setTimeout(run, delays[job.attempt])
        job.timer.unref?.()
      }
    }

    job.timer = setTimeout(run, delays[0])
    job.timer.unref?.()
    return true
  }

  async getEthUsd() {
    const now = Date.now()
    const cacheMs = Math.max(5_000, Number(process.env.ETH_USD_CACHE_MS ?? 15_000))
    const staleMs = Math.max(cacheMs, Number(process.env.ETH_USD_STALE_MS ?? 300_000))
    if (this.ethUsd.value > 0 && now - this.ethUsd.at < cacheMs) return this.ethUsd.value

    try {
      const best = await readEthUsdFromV3(this.hood.public)
      const previousPool = this.ethUsd.pool ?? null
      this.ethUsd = {
        value: best.price, at: now, pool: best.pool, fee: best.fee,
        liquidity: best.liquidity.toString()
      }
      if (previousPool !== best.pool) {
        this.onTelemetry({
          type: 'eth-usd-source', source: 'weth-usdg-v3-slot0', pool: best.pool,
          fee: best.fee, price: Math.round(best.price * 100) / 100, observedAt: now
        })
      }
      return best.price
    } catch (e) {
      if (this.ethUsd.value > 0 && now - this.ethUsd.at < staleMs) {
        this.onTelemetry({
          type: 'eth-usd-stale-cache', ageMs: now - this.ethUsd.at,
          message: String(e?.message ?? e), observedAt: now
        })
        return this.ethUsd.value
      }
      throw e
    }
  }

  async auditWithRetry(token, attempt) {
    const risk = await auditToken(token)
    this.risks.set(lower(token), risk)
    this.onAudit({ token, risk, observedAt: Date.now() })

    const retryDelays = [1_500, 5_000, 15_000, 45_000, 120_000]
    const shouldRetry = risk.auditComplete !== true && risk.auditHardFail !== true && attempt < retryDelays.length
    if (shouldRetry) {
      const delay = retryDelays[attempt]
      setTimeout(() => this.auditWithRetry(token, attempt + 1).catch((e) => this.onTelemetry({
        type: 'audit-retry-error', token, attempt: attempt + 1, message: String(e?.message ?? e)
      })), delay)
    }
  }

  async attributeTrade(pool, isBuy, transactionHash, usdValue) {
    let trader = `tx:${lower(transactionHash)}`
    let participant = null
    let participantSource = null
    let attribution = { kind: 'unattributed', countsAsSmart: false }
    let seeded = false
    let deferredSmart = null

    const origin = isBuy ? this.getSequencerOrigin(transactionHash) : null
    if (origin && isAddress(origin.sender)) {
      const signer = lower(origin.sender)
      const relayed = isDirectRouterAddress(origin.to)
      const profile = this.trackedProfiles.get(signer)
      const smartEligible = isSmartEligibleProfile(profile)

      if (!relayed) {
        participant = signer
        participantSource = 'sequencer_signed_buy'

        if (profile && !smartEligible) {
          trader = signer
          attribution = { kind: 'tracked_watch_observation', countsAsSmart: false }
          this.onTelemetry({
            type: 'sequencer-identity-hit', txHash: transactionHash, signer, buyer: participant,
            tracked: true, smart: false, smartEligible: false,
            attribution: attribution.kind, to: origin.to, selector: origin.selector, observedAt: Date.now()
          })
          return { trader, participant, participantSource, attribution, seeded: false, deferredSmart }
        }

        if (!profile) {
          this.onTelemetry({
            type: 'sequencer-identity-hit', txHash: transactionHash, signer, buyer: participant,
            tracked: false, smart: false, smartEligible: false,
            attribution: attribution.kind, to: origin.to, selector: origin.selector, observedAt: Date.now()
          })
          return { trader, participant, participantSource, attribution, seeded: false, deferredSmart }
        }

        const preliminary = classifyWalletAttribution({ receiptTo: origin.to, usdValue, profile })
        if (!preliminary.countsAsSmart) {
          attribution = preliminary
          const candidate = { wallet: signer, profile, attribution, amount: 0n, routerFacing: false }
          seeded = this.updateSpoofState(pool.token, { wallet: null, attribution, candidates: [candidate] })
          this.onTelemetry({
            type: 'sequencer-identity-hit', txHash: transactionHash, signer, buyer: participant,
            tracked: true, smart: false, smartEligible: true,
            attribution: attribution.kind, to: origin.to, selector: origin.selector, observedAt: Date.now()
          })
          return { trader, participant, participantSource, attribution, seeded, deferredSmart }
        }

        attribution = { kind: 'smart_receipt_pending', countsAsSmart: false }
        deferredSmart = { signer, profile, origin }
        this.onTelemetry({
          type: 'sequencer-identity-hit', txHash: transactionHash, signer, buyer: participant,
          tracked: true, smart: false, smartEligible: true,
          attribution: attribution.kind, to: origin.to, selector: origin.selector, observedAt: Date.now()
        })
        return { trader, participant, participantSource, attribution, seeded: false, deferredSmart }
      }

      attribution = { kind: 'direct', countsAsSmart: false }
      participantSource = 'sequencer_relayer_unresolved'
      this.onTelemetry({
        type: 'sequencer-relayer-hit', txHash: transactionHash, signer,
        buyer: null, tracked: Boolean(profile), smart: false,
        attribution: 'direct', to: origin.to, selector: origin.selector, observedAt: Date.now()
      })
    }

    try {
      const receipt = await this.hood.public.getTransactionReceipt({ hash: transactionHash })
      const transfers = this.decodeTokenTransfers(receipt, pool.token)
      const generic = chooseTradeParticipant({ transfers, isBuy, poolAddress: pool.address ?? null })
      participant = generic?.wallet ?? null
      participantSource = generic?.source ?? participantSource

      const observedProfile = isAddress(participant) ? this.trackedProfiles.get(lower(participant)) : null
      if (observedProfile && !isSmartEligibleProfile(observedProfile)) {
        trader = lower(participant)
        attribution = { kind: 'tracked_watch_observation', countsAsSmart: false }
      }

      const smartProfiles = this.smartTrackedProfiles()
      if (smartProfiles.size) {
        const chosen = chooseTrackedWallet({
          transfers, isBuy, trackedProfiles: smartProfiles,
          receiptTo: receipt.to, usdValue
        })
        if (chosen.wallet || chosen.attribution?.kind !== 'unattributed') attribution = chosen.attribution
        if (chosen.wallet && chosen.attribution.countsAsSmart) {
          trader = chosen.wallet
          participant = chosen.wallet
          participantSource = 'verified_smart_router_leg'
        }
        seeded = this.updateSpoofState(pool.token, chosen)
      }
    } catch (e) {
      this.onTelemetry({ type: 'receipt-identity-error', txHash: transactionHash, message: e.message })
    }

    return { trader, participant, participantSource, attribution, seeded, deferredSmart }
  }

  async emitTrade({ pool, isBuy, usdValue, marketCapUsd, transactionHash }) {
    if (!(usdValue > 0) || !(marketCapUsd > 0) || marketCapUsd >= 1_000_000) return
    this.ensureAudit(pool.token)
    const identity = await this.attributeTrade(pool, isBuy, transactionHash, usdValue)
    const baseRisk = this.risks.get(lower(pool.token)) ?? {
      securityVerified: false, auditVerdict: 'PENDING', auditScore: 0
    }
    const risk = { ...baseRisk, seeded: baseRisk.seeded || identity.seeded }
    if (identity.seeded) this.risks.set(lower(pool.token), risk)

    const meta = await this.ensureTokenMeta(pool.token)
    const trade = {
      chain: 'robinhood', venue: pool.venue, token: pool.token, symbol: meta.symbol,
      trader: identity.trader, participant: identity.participant,
      participantSource: identity.participantSource, isBuy, usdValue, marketCapUsd,
      liquidityUsd: Number(risk.liquidityUsd ?? 0), observedAt: Date.now(),
      launchedAt: pool.createdAt, txHash: transactionHash,
      poolId: pool.poolId ?? pool.address, attribution: identity.attribution.kind, risk,
      pricingContext: {
        venue: pool.venue, poolId: pool.poolId ?? pool.address,
        tokenIs0: pool.tokenIs0 === true,
        quoteAddress: pool.quote?.address ?? null,
        quoteSymbol: pool.quote?.symbol ?? null,
        quoteDecimals: Number(pool.quote?.decimals ?? 18),
        quoteUsdKind: pool.quote?.usdKind ?? 'eth'
      }
    }
    this.onTrade(trade)

    if (identity.deferredSmart) {
      this.scheduleSmartReceiptVerification({
        pool, isBuy, transactionHash, usdValue,
        signer: identity.deferredSmart.signer,
        profile: identity.deferredSmart.profile,
        origin: identity.deferredSmart.origin
      })
    }
  }

  stop() {
    for (const job of this.smartReceiptJobs.values()) if (job?.timer) clearTimeout(job.timer)
    this.smartReceiptJobs.clear()
    super.stop()
  }
}
