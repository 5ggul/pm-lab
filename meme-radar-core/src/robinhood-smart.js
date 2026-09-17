import { auditToken } from './audit.js'
import { readEthUsdFromV3 } from './eth-usd.js'
import { RobinhoodAdapter } from './robinhood.js'
import { classifyWalletAttribution, chooseTradeParticipant, chooseTrackedWallet, isDirectRouterAddress } from './provenance.js'

const lower = (v) => String(v ?? '').toLowerCase()
const isAddress = (v) => /^0x[a-f0-9]{40}$/.test(lower(v))
const isSmartEligibleProfile = (profile) => profile?.smartEligible === true && Number(profile?.quality) >= 70

/**
 * Accuracy layer over the venue adapter.
 *
 * A matching sequencer signer can identify an ordinary confirmed buyer without waiting for a
 * receipt RPC only when the signer is the economic caller. Known relayer/direct-router paths keep
 * buyer identity unresolved until a receipt token-transfer leg reveals the actual wallet. Smart
 * credit always applies the same dust/direct provenance policy as receipt-based attribution.
 * WATCH-directory wallets may be observed, but only profiles explicitly marked smartEligible may
 * receive smart credit or participate in seeded-wallet heuristics.
 */
export class SmartRobinhoodAdapter extends RobinhoodAdapter {
  smartTrackedProfiles() {
    return new Map([...this.trackedProfiles].filter(([, profile]) => isSmartEligibleProfile(profile)))
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
        value: best.price,
        at: now,
        pool: best.pool,
        fee: best.fee,
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

    // Brand-new Robinhood tokens can be sellable before contract/holder indexing catches up.
    // Keep fail-closed verification but re-check through the two-minute propagation window.
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

    const origin = isBuy ? this.getSequencerOrigin(transactionHash) : null
    if (origin && isAddress(origin.sender)) {
      const signer = lower(origin.sender)
      const relayed = isDirectRouterAddress(origin.to)

      // The known direct router is relayed: tx signer is infrastructure, not the economic buyer.
      // Without a receipt token-transfer leg we intentionally leave both buyer and smart identity
      // unresolved. This also prevents a tracked relayer from creating false seeded-wallet evidence.
      if (relayed) {
        attribution = { kind: 'direct', countsAsSmart: false }
        participantSource = 'sequencer_relayer_unresolved'
        this.onTelemetry({
          type: 'sequencer-relayer-hit', txHash: transactionHash, signer,
          buyer: null, tracked: this.trackedProfiles.has(signer), smart: false,
          attribution: 'direct', to: origin.to, selector: origin.selector, observedAt: Date.now()
        })
        return { trader, participant: null, participantSource, attribution, seeded: false }
      }

      participant = signer
      participantSource = 'sequencer_signed_buy'
      const profile = this.trackedProfiles.get(signer)
      const smartEligible = isSmartEligibleProfile(profile)
      if (profile && !smartEligible) {
        // Observation-only WATCH wallet: preserve its identity for research, but do not let it
        // receive smart credit or influence seeded-wallet manipulation heuristics.
        trader = signer
        attribution = { kind: 'tracked_watch_observation', countsAsSmart: false }
      } else if (profile) {
        const classified = classifyWalletAttribution({
          receiptTo: origin.to,
          usdValue,
          profile
        })
        attribution = {
          ...classified,
          kind: classified.countsAsSmart ? 'sequencer_signed_buy' : classified.kind
        }
        const candidate = {
          wallet: signer,
          profile,
          attribution,
          amount: 0n,
          routerFacing: classified.countsAsSmart
        }
        seeded = this.updateSpoofState(pool.token, {
          wallet: classified.countsAsSmart ? signer : null,
          attribution,
          candidates: [candidate]
        })
        if (classified.countsAsSmart) trader = signer
      }

      this.onTelemetry({
        type: 'sequencer-identity-hit', txHash: transactionHash,
        signer, buyer: participant, tracked: Boolean(profile),
        smart: attribution.countsAsSmart, smartEligible,
        attribution: attribution.kind,
        to: origin.to, selector: origin.selector, observedAt: Date.now()
      })
      return { trader, participant, participantSource, attribution, seeded }
    }

    try {
      const receipt = await this.hood.public.getTransactionReceipt({ hash: transactionHash })
      const transfers = this.decodeTokenTransfers(receipt, pool.token)
      const generic = chooseTradeParticipant({
        transfers,
        isBuy,
        poolAddress: pool.address ?? null
      })
      participant = generic?.wallet ?? null
      participantSource = generic?.source ?? null

      const observedProfile = isAddress(participant) ? this.trackedProfiles.get(lower(participant)) : null
      if (observedProfile && !isSmartEligibleProfile(observedProfile)) {
        trader = lower(participant)
        attribution = { kind: 'tracked_watch_observation', countsAsSmart: false }
      }

      const smartProfiles = this.smartTrackedProfiles()
      if (smartProfiles.size) {
        const chosen = chooseTrackedWallet({
          transfers,
          isBuy,
          trackedProfiles: smartProfiles,
          receiptTo: receipt.to,
          usdValue
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

    return { trader, participant, participantSource, attribution, seeded }
  }

  async emitTrade({ pool, isBuy, usdValue, marketCapUsd, transactionHash }) {
    if (!(usdValue > 0) || !(marketCapUsd > 0) || marketCapUsd >= 1_000_000) return
    this.ensureAudit(pool.token)
    const identity = await this.attributeTrade(pool, isBuy, transactionHash, usdValue)
    const baseRisk = this.risks.get(lower(pool.token)) ?? {
      securityVerified: false,
      auditVerdict: 'PENDING',
      auditScore: 0
    }
    const risk = { ...baseRisk, seeded: baseRisk.seeded || identity.seeded }
    if (identity.seeded) this.risks.set(lower(pool.token), risk)

    const meta = await this.ensureTokenMeta(pool.token)
    this.onTrade({
      chain: 'robinhood',
      venue: pool.venue,
      token: pool.token,
      symbol: meta.symbol,
      trader: identity.trader,
      participant: identity.participant,
      participantSource: identity.participantSource,
      isBuy,
      usdValue,
      marketCapUsd,
      liquidityUsd: Number(risk.liquidityUsd ?? 0),
      observedAt: Date.now(),
      launchedAt: pool.createdAt,
      txHash: transactionHash,
      poolId: pool.poolId ?? pool.address,
      attribution: identity.attribution.kind,
      risk,
      pricingContext: {
        venue: pool.venue,
        poolId: pool.poolId ?? pool.address,
        tokenIs0: pool.tokenIs0 === true,
        quoteAddress: pool.quote?.address ?? null,
        quoteSymbol: pool.quote?.symbol ?? null,
        quoteDecimals: Number(pool.quote?.decimals ?? 18),
        quoteUsdKind: pool.quote?.usdKind ?? 'eth'
      }
    })
  }
}
