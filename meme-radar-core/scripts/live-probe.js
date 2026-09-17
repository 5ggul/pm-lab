import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHoodClient, subscribeFeed } from 'hoodchain'
import { RobinhoodAdapter } from '../src/robinhood.js'
import { syncPublicWalletRoster } from '../src/wallet-directory.js'

const execFileAsync = promisify(execFile)
const RPC = process.env.RH_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'
const POOL_MANAGER = '0x8366a39cc670b4001a1121b8f6a443a643e40951'
const outPath = process.env.LIVE_PROBE_OUT ?? 'live-probe.json'

function binary(name) {
  const local = path.resolve('node_modules', '.bin', name)
  return fs.existsSync(local) ? local : name
}

function parseJsonLoose(text) {
  const raw = String(text ?? '').trim()
  try { return JSON.parse(raw) } catch {}
  const firstArray = raw.indexOf('[')
  const firstObj = raw.indexOf('{')
  const first = firstArray >= 0 && (firstObj < 0 || firstArray < firstObj) ? firstArray : firstObj
  const close = first === firstArray ? raw.lastIndexOf(']') : raw.lastIndexOf('}')
  if (first >= 0 && close > first) {
    try { return JSON.parse(raw.slice(first, close + 1)) } catch {}
  }
  return null
}

function latestLaunchToken(scan) {
  const launches = Array.isArray(scan?.launches) ? scan.launches : []
  const preferred = [...launches].reverse().find((x) => x?.v4 && /^0x[a-fA-F0-9]{40}$/.test(x?.token ?? ''))
  const fallback = [...launches].reverse().find((x) => /^0x[a-fA-F0-9]{40}$/.test(x?.token ?? ''))
  return (preferred ?? fallback)?.token ?? null
}

async function probeFeed(ms = 4000) {
  const stats = { connected: false, frames: 0, transactions: 0, firstLatencyMs: null, error: null }
  const started = Date.now()
  let sub
  try {
    sub = await subscribeFeed((msg) => {
      stats.frames += 1
      stats.transactions += msg.transactions.length
      if (stats.firstLatencyMs === null) stats.firstLatencyMs = Date.now() - started
    }, {
      maxReconnects: 1,
      reconnectDelayMs: 250,
      onConnect: () => { stats.connected = true },
      onError: (e) => { stats.error = String(e?.message ?? e) }
    })
    await new Promise((resolve) => setTimeout(resolve, ms))
  } catch (e) {
    stats.error = String(e?.message ?? e)
  } finally {
    sub?.close()
  }
  return stats
}

async function hoodwatchScan(latestBlock) {
  const since = latestBlock > 20_000n ? latestBlock - 20_000n : 0n
  try {
    const { stdout, stderr } = await execFileAsync(binary('hoodwatch'), ['scan', '--since', since.toString(), '--json'], {
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, HOODWATCH_RPC_URL: process.env.HOODWATCH_RPC_URL ?? RPC }
    })
    const parsed = parseJsonLoose(stdout)
    return { ok: Boolean(parsed), since: since.toString(), parsed, stderr: String(stderr ?? '').slice(0, 1000), rawHead: parsed ? null : String(stdout).slice(0, 2000) }
  } catch (e) {
    return { ok: false, since: since.toString(), error: String(e?.message ?? e).slice(0, 1000), stdout: String(e?.stdout ?? '').slice(0, 2000), stderr: String(e?.stderr ?? '').slice(0, 2000) }
  }
}

async function hoodwatchAudit(token) {
  if (!token) return { skipped: true, reason: 'no recent token returned by scan' }
  try {
    const { stdout, stderr } = await execFileAsync(binary('hoodwatch'), ['audit', token, '--json', '--fast'], {
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, HOODWATCH_RPC_URL: process.env.HOODWATCH_RPC_URL ?? RPC }
    })
    const parsed = parseJsonLoose(stdout)
    return {
      ok: Boolean(parsed), token,
      verdict: parsed?.verdict ?? null,
      score: parsed?.score ?? null,
      flags: Array.isArray(parsed?.flags)
        ? parsed.flags.map((f) => ({ id: f?.id ?? f?.code ?? null, severity: f?.severity ?? null, message: f?.message ?? f?.title ?? null })).slice(0, 20)
        : [],
      sectionKeys: parsed?.sections && typeof parsed.sections === 'object' ? Object.keys(parsed.sections) : [],
      stderr: String(stderr ?? '').slice(0, 1000),
      rawHead: parsed ? null : String(stdout).slice(0, 2000)
    }
  } catch (e) {
    return { ok: false, token, error: String(e?.message ?? e).slice(0, 1000), stderr: String(e?.stderr ?? '').slice(0, 2000) }
  }
}

async function probeAdapter() {
  const stats = { ok: false, launches: 0, trades: 0, audits: 0, telemetry: {}, error: null }
  const prevDisable = process.env.RH_DISABLE_FEED
  const prevBackfill = process.env.RH_BACKFILL_BLOCKS
  process.env.RH_DISABLE_FEED = '1'
  process.env.RH_BACKFILL_BLOCKS = process.env.LIVE_PROBE_BACKFILL_BLOCKS ?? '1000'
  const adapter = new RobinhoodAdapter({
    trackedProfiles: new Map(),
    onLaunch: () => { stats.launches += 1 },
    onTrade: () => { stats.trades += 1 },
    onAudit: () => { stats.audits += 1 },
    onTelemetry: (e) => { stats.telemetry[e.type] = (stats.telemetry[e.type] ?? 0) + 1 }
  })
  try {
    await adapter.start()
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.LIVE_PROBE_ADAPTER_MS ?? 1500)))
    stats.ok = true
  } catch (e) {
    stats.error = String(e?.stack ?? e)
  } finally {
    adapter.stop()
    if (prevDisable === undefined) delete process.env.RH_DISABLE_FEED
    else process.env.RH_DISABLE_FEED = prevDisable
    if (prevBackfill === undefined) delete process.env.RH_BACKFILL_BLOCKS
    else process.env.RH_BACKFILL_BLOCKS = prevBackfill
  }
  return stats
}

const result = {
  startedAt: new Date().toISOString(),
  rpc: RPC,
  node: process.version,
  chainId: null,
  latestBlock: null,
  poolManagerCodeBytes: 0,
  roster: null,
  sequencer: null,
  hoodwatchScan: null,
  hoodwatchAudit: null,
  adapter: null
}

let exitCode = 0
try {
  const hood = createHoodClient({ rpcUrl: RPC })
  const [chainId, latestBlock, code] = await Promise.all([
    hood.public.getChainId(),
    hood.public.getBlockNumber(),
    hood.public.getCode({ address: POOL_MANAGER })
  ])
  result.chainId = chainId
  result.latestBlock = latestBlock.toString()
  result.poolManagerCodeBytes = code && code !== '0x' ? (code.length - 2) / 2 : 0
  if (chainId !== 4663 || result.poolManagerCodeBytes <= 0) exitCode = 2

  const roster = new Map()
  try {
    result.roster = await syncPublicWalletRoster(roster)
    result.roster.validAddresses = roster.size
  } catch (e) {
    result.roster = { ok: false, error: String(e?.message ?? e), validAddresses: 0 }
  }

  result.sequencer = await probeFeed(Number(process.env.LIVE_PROBE_FEED_MS ?? 4000))
  result.hoodwatchScan = await hoodwatchScan(latestBlock)
  const token = latestLaunchToken(result.hoodwatchScan?.parsed)
  result.hoodwatchAudit = await hoodwatchAudit(token)
  result.adapter = await probeAdapter()

  if (!result.sequencer.connected || result.sequencer.frames < 1) exitCode ||= 4
  if (!result.hoodwatchScan.ok || Number(result.hoodwatchScan.parsed?.count ?? 0) < 1) exitCode ||= 5
  if (!result.hoodwatchAudit.ok) exitCode ||= 6
  if (!result.adapter.ok) exitCode ||= 7
} catch (e) {
  result.fatal = String(e?.stack ?? e)
  exitCode = 3
}

result.finishedAt = new Date().toISOString()
result.exitCode = exitCode
fs.writeFileSync(outPath, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
process.exitCode = exitCode
