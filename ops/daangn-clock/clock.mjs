const REPO = 'https://api.github.com/repos/5ggul/pm-lab';
const WORKFLOW = 'daangn-cloud.yml';
const terminal = new Set(['published', 'publishing', 'publish_unknown', 'daily_cap', 'no_candidate', 'quality_or_category_skip']);

export function clockSlot(time, config) {
  const kst = new Date(time + 9 * 3600000);
  const hour = kst.getUTCHours();
  if (!config.enabled || !config.slotHoursKst.includes(hour) || kst.getUTCMinutes() < 7) return null;
  return `${kst.toISOString().slice(0, 10)}@${hour}`;
}

export async function runClock(event, env, fetcher = fetch) {
  const scheduledTime = event.scheduledTime;
  if (!env.GITHUB_DISPATCH_TOKEN) throw new Error('DISPATCH_SECRET_MISSING');
  const request = async (path, options = {}) => {
    const response = await fetcher(REPO + path, {
      ...options,
      headers: { Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`, Accept: 'application/vnd.github+json',
        'User-Agent': 'daangn-publisher-clock', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(`GITHUB_${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  const readFile = async name => {
    const result = await request(`/contents/ops/daangn-cloud/${name}?ref=main`);
    const bytes = Uint8Array.from(atob(result.content.replace(/\s/g, '')), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  const config = await readFile('growth-config.json');
  const slot = clockSlot(scheduledTime, config);
  const warmupSlot = time => {
    const kst = new Date(time + 9 * 36e5);
    return config.enabled && config.researchWarmupHoursKst?.includes(kst.getUTCHours()) && kst.getUTCMinutes() >= 7
      ? `${kst.toISOString().slice(0, 10)}@research${kst.getUTCHours()}` : null;
  };
  const supplySlot = warmupSlot(scheduledTime);
  if (supplySlot) {
    const runs = await request(`/actions/workflows/${WORKFLOW}/runs?branch=main&per_page=20`);
    if (runs.workflow_runs.some(r => ['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(r.status))) return { scheduledTime, slot: supplySlot, status: 'workflow_active' };
    if (runs.workflow_runs.some(r => r.event !== 'pull_request' && warmupSlot(Date.parse(r.created_at)) === supplySlot)) return { scheduledTime, slot: supplySlot, status: 'supply_already_requested' };
    await request(`/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main', inputs: { collect_only: true } }) });
    return { scheduledTime, slot: supplySlot, status: 'supply_dispatched' };
  }
  if (!slot) return { scheduledTime, status: 'outside_slot' };
  const ledger = await readFile('state/publish-ledger.json');
  const entry = ledger[slot];
  const supplyRetry = ['no_candidate', 'quality_or_category_skip'].includes(entry?.status) && !entry.key && entry.attempts < config.maxTechnicalAttempts && scheduledTime - Date.parse(entry.finishedAt) >= 20 * 60000;
  if (terminal.has(entry?.status) && !supplyRetry) return { scheduledTime, slot, status: 'slot_handled', result: entry.status, postUrl: entry.postUrl || null };
  if (entry && !supplyRetry && (entry.status !== 'technical_failure' || entry.attempts >= config.maxTechnicalAttempts)) {
    return { scheduledTime, slot, status: 'retry_blocked' };
  }
  const runs = await request(`/actions/workflows/${WORKFLOW}/runs?branch=main&per_page=20`);
  if (runs.workflow_runs.some(r => ['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(r.status))) {
    return { scheduledTime, slot, status: 'workflow_active' };
  }
  // Avoid dispatch loops if a runner fails before it writes the slot ledger.
  const currentAttempts = runs.workflow_runs.filter(r => r.event !== 'pull_request' && clockSlot(Date.parse(r.created_at), config) === slot);
  if (currentAttempts.length >= config.maxTechnicalAttempts) return { scheduledTime, slot, status: 'dispatch_limit' };
  await request(`/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main', inputs: { collect_only: false } }) });
  return { scheduledTime, slot, status: 'dispatched' };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      let report;
      try { report = await runClock(event, env); }
      catch (error) { report = { scheduledTime: event.scheduledTime, status: 'failed', reason: error.message }; }
      console.log(JSON.stringify(report));
      if (env.STATUS) {
        await env.STATUS.put('latest', JSON.stringify(report));
        await env.STATUS.put(`event:${event.scheduledTime}`, JSON.stringify(report), { expirationTtl: 604800 });
      }
      if (report.status === 'failed') throw new Error(report.reason);
    })());
  },
  fetch() { return new Response('Not found', { status: 404 }); }
};
