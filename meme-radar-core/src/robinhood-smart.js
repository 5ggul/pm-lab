import { auditToken } from './audit.js'
import { readEthUsdFromV3 } from './eth-usd.js'
import { RobinhoodAdapter } from './robinhood.js'
import { classifyWalletAttribution, chooseTradeParticipant, chooseTrackedWallet } from './provenance.js'

const lower = (v) => String(v ?? '').toLowerCase()
const isAddress = (v) => /^0x[a-f0-9]{40}$/.test(lower(v))

/**
 * Accuracy layer over the venue adapter.
 *
 * A matching sequencer signer can identify an ordinary confirmed buyer without waiting for a
 * receipt RPC. Smart-wallet credit is stricter: the tracked signer must still pass the same
 * direct-router/dust provenance policy used by receipt-based attribution. Legacy/non-launchpad
 * trades keep the receipt-transfer fallback.
 */
export class SmartRobinhoodAdapter extends RobinhoodAdapter {
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

    const retryDelays = [1_500, 5_000, 15_000, 45_000]
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
      participant = lower(origin.sender)
      participantSource = 'sequencer_signed_buy'
      const profile = this.trackedProfiles.get(participant)
      if (profile) {
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
          wallet: participant,
          profile,
          attribution,
          amount: 0n,
          routerFacing: classified.countsAsSmart
        }
        seeded = this.updateSpoofState(pool.token, {
          wallet: classified.countsAsSmart ? participant : null,
          attribution,
          candidates: [candidate]
        })
        if (classified.countsAsSmart) trader = participant
      }
      this.onTelemetry({
        type: 'sequencer-identity-hit', txHash: transactionHash, buyer: participant,
        tracked: Boolean(profile), smart: attribution.countsAsSmart,
        attribution: attribution.kind, selector: origin.selector, observedAt: Date.now()
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

      if (this.trackedProfiles.size) {
        const chosen = chooseTrackedWallet({
          transfers,
          isBuy,
          trackedProfiles: this.trackedProfiles,
          receiptTo: receipt.to,
          usdValue
        })
        attribution = chosen.attribution
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
      risk
    })
  }
}
