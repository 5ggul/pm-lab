import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function hoodwatchBinary() {
  if (process.env.HOODWATCH_BIN) return process.env.HOODWATCH_BIN
  const local = path.resolve('node_modules', '.bin', process.platform === 'win32' ? 'hoodwatch.cmd' : 'hoodwatch')
  return fs.existsSync(local) ? local : 'hoodwatch'
}

function parseJsonOutput(stdout) {
  const text = String(stdout ?? '').trim()
  try { return JSON.parse(text) } catch {}
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first >= 0 && last > first) return JSON.parse(text.slice(first, last + 1))
  throw new Error('hoodwatch returned no JSON object')
}

function flagId(flag) {
  return String(flag?.id ?? flag?.code ?? flag?.name ?? '').toLowerCase()
}

function flagSeverity(flag) {
  return String(flag?.severity ?? '').toLowerCase()
}

function hasFlag(flags, patterns, severeOnly = false) {
  return flags.some((f) => {
    const id = flagId(f)
    const severe = ['critical', 'high', 'error'].includes(flagSeverity(f))
    return (!severeOnly || severe) && patterns.some((p) => id.includes(p))
  })
}

function findNumber(value, keys, depth = 0) {
  if (!value || depth > 5) return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const n = findNumber(item, keys, depth + 1)
      if (n !== null) return n
    }
    return null
  }
  if (typeof value !== 'object') return null
  for (const [k, v] of Object.entries(value)) {
    if (keys.includes(k.toLowerCase()) && Number.isFinite(Number(v))) return Number(v)
  }
  for (const v of Object.values(value)) {
    const n = findNumber(v, keys, depth + 1)
    if (n !== null) return n
  }
  return null
}

export function mapAuditResult(result) {
  const flags = Array.isArray(result?.flags) ? result.flags : []
  const verdict = String(result?.verdict ?? 'UNKNOWN').toUpperCase()
  const score = Number(result?.score)
  const hardVerdict = ['AVOID', 'HIGH_RISK'].includes(verdict)
  const honeypot = hasFlag(flags, ['honeypot', 'cannot_sell', 'unsellable'], true)
  const sellSimulationFailed = hasFlag(flags, ['sell_sim', 'sell-sim', 'sell_failed', 'cannot_sell'], true)
  const devDump = hasFlag(flags, ['dev_dump', 'deployer_dump', 'creator_dump'], true)
  const clusterHigh = hasFlag(flags, ['cluster', 'bundle', 'sybil', 'same_funder'], true)
  const holderHigh = hasFlag(flags, ['holder_concentration', 'top_holder', 'concentration'], true)
  const lpDanger = hasFlag(flags, ['lp_pull', 'liquidity_pull', 'unlocked_lp'], true)
  const liquidityUsd = findNumber(result?.sections, ['liquidityusd', 'liquidity_usd', 'liquidity'])

  return {
    securityVerified: true,
    auditScore: Number.isFinite(score) ? score : 0,
    auditVerdict: verdict,
    auditHardFail: hardVerdict || honeypot || sellSimulationFailed || lpDanger,
    honeypot,
    sellSimulationFailed,
    devDump,
    linkedWalletRisk: clusterHigh ? 0.9 : 0.15,
    holderClusterRisk: holderHigh ? 0.9 : 0.15,
    creatorRisk: devDump ? 1 : 0.2,
    liquidityUsd: Number.isFinite(liquidityUsd) ? liquidityUsd : null,
    flags: flags.slice(0, 20).map((f) => ({ id: flagId(f), severity: flagSeverity(f) }))
  }
}

export async function auditToken(token) {
  if (process.env.HOODWATCH_DISABLE === '1') {
    return { securityVerified: false, auditVerdict: 'DISABLED', auditScore: 0 }
  }
  const env = { ...process.env }
  if (process.env.RH_RPC_URL && !env.HOODWATCH_RPC_URL) env.HOODWATCH_RPC_URL = process.env.RH_RPC_URL
  try {
    const { stdout } = await execFileAsync(hoodwatchBinary(), ['audit', token, '--json', '--fast'], {
      env,
      timeout: Number(process.env.HOODWATCH_TIMEOUT_MS ?? 15_000),
      maxBuffer: 4 * 1024 * 1024
    })
    return mapAuditResult(parseJsonOutput(stdout))
  } catch (error) {
    return {
      securityVerified: false,
      auditVerdict: 'PENDING',
      auditScore: 0,
      auditError: String(error?.message ?? error).slice(0, 300)
    }
  }
}
