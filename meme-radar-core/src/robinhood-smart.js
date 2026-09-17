import { RobinhoodAdapter } from './robinhood.js'
import { chooseTradeParticipant, chooseTrackedWallet } from './provenance.js'

const lower = (v) => String(v ?? '').toLowerCase()

/**
 * Accuracy layer over the venue adapter.
 *
 * The base adapter discovers pools/prices as fast as possible. This subclass spends one receipt
 * read only after a swap has already passed the <$1M gate, so buyer identity cannot slow pool
 * discovery. The receipt is also reused for smart-wallet provenance; no second tx read is needed.
 */
export class SmartRobinhoodAdapter extends RobinhoodAdapter {
  async attributeTrade(pool, isBuy, transactionHash, usdValue) {
    let trader = `tx:${lower(transactionHash)}`
    let participant = null
    let participantSource = null
    let attribution = { kind: 'unattributed', countsAsSmart: false }
    let seeded = false

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
