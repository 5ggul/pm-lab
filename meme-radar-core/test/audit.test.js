import test from 'node:test'
import assert from 'node:assert/strict'
import { mapAuditResult } from '../src/audit.js'

test('UNKNOWN audit never becomes security verified', () => {
  const r = mapAuditResult({ verdict: 'UNKNOWN', score: 0, flags: [], sections: {} })
  assert.equal(r.securityVerified, false)
  assert.equal(r.auditComplete, false)
  assert.equal(r.auditPendingReason, 'AUDIT_INCOMPLETE_UNKNOWN')
})

test('UNKNOWN with missing fresh-chain data stays pending but preserves passed sell simulation', () => {
  const r = mapAuditResult({
    verdict: 'UNKNOWN',
    score: 0,
    flags: [
      { id: 'contract_unknown', severity: 'warning' },
      { id: 'holders_unknown', severity: 'warning' },
      { id: 'very_new', severity: 'warning' },
      { id: 'sellable', severity: 'good' }
    ],
    sections: {}
  })
  assert.equal(r.securityVerified, false)
  assert.equal(r.auditComplete, false)
  assert.equal(r.auditPendingReason, 'AUDIT_DATA_PROPAGATION_PENDING')
  assert.equal(r.sellSimulationPassed, true)
  assert.equal(r.sellSimulationFailed, false)
  assert.equal(r.contractKnown, false)
  assert.equal(r.holdersKnown, false)
  assert.equal(r.veryNew, true)
})

test('CAUTION is complete but stays WATCH-only', () => {
  const r = mapAuditResult({ verdict: 'CAUTION', score: 58, flags: [], sections: {} })
  assert.equal(r.auditComplete, true)
  assert.equal(r.securityVerified, false)
  assert.equal(r.auditPendingReason, 'VERDICT_CAUTION')
})

test('FAIR and LOW_RISK can clear safety when no hard fail exists', () => {
  const fair = mapAuditResult({ verdict: 'FAIR', score: 72, flags: [], sections: {} })
  const low = mapAuditResult({ verdict: 'LOW_RISK', score: 91, flags: [], sections: {} })
  assert.equal(fair.securityVerified, true)
  assert.equal(low.securityVerified, true)
  assert.equal(fair.auditHardFail, false)
})

test('hard risk verdict never verifies', () => {
  const r = mapAuditResult({ verdict: 'AVOID', score: 10, flags: [], sections: {} })
  assert.equal(r.securityVerified, false)
  assert.equal(r.auditHardFail, true)
})

test('severe honeypot flag blocks even a nominal FAIR verdict', () => {
  const r = mapAuditResult({
    verdict: 'FAIR',
    score: 70,
    flags: [{ id: 'honeypot_detected', severity: 'critical' }],
    sections: {}
  })
  assert.equal(r.securityVerified, false)
  assert.equal(r.honeypot, true)
  assert.equal(r.auditHardFail, true)
})
