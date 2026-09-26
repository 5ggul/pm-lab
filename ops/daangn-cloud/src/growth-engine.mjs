import { createHash } from 'node:crypto';
import { itemQuality, sourceStore } from './quality-engine.mjs';

const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
export const kstDay = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d);
const finite = n => typeof n === 'number' && Number.isFinite(n);
export function expiryTime(raw) {
  if (!raw) return null;
  const s = String(raw);
  const m = s.match(/^(\d{4})[-.]?(\d{2})[-.]?(\d{2})$/);
  const ms = Date.parse(m ? `${m[1]}-${m[2]}-${m[3]}T23:59:59+09:00` : s);
  return Number.isFinite(ms) ? ms : NaN;
}
export function slotFor(now, config) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23' }).format(now));
  if (hour < 8 || hour > 22) return null;
  const h = config.slotHoursKst.filter(x => x <= hour).at(-1);
  return h === undefined ? null : `${kstDay(now)}@${h}`;
}
export function slotDecision(ledger, slot, config) {
  if (!slot) return { run: false, reason: 'outside_window' };
  const entry = ledger[slot];
  if (!entry) return { run: true, reason: 'new_slot' };
  if (entry.status === 'technical_failure' && entry.attempts < config.maxTechnicalAttempts) return { run: true, reason: 'technical_retry' };
  return { run: false, reason: entry.status === 'publishing' ? 'publish_unknown' : entry.status };
}
export function contentKey(item) {
  const identity = item.semanticKey || item.id || item.sourceUrl;
  if (!identity) throw new Error('CONTENT_ID_REQUIRED');
  return createHash('sha256').update(identity + '\n' + (item.contentVersion || '1')).digest('hex');
}
export function semanticTopic(item) {
  const c = item.copyContext || {};
  return clean(c.product || c.name || c.sourceTitle || item.semanticKey || item.title || item.id)
    .normalize('NFKC').toLowerCase().replace(/[0-9,.]+\s*원/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function classifyTopic(item) {
  const c = item.copyContext || {};
  if (c.kind === 'digest') return 'digest';
  if (c.kind === 'question' || c.memberSubmission) return 'community';
  if (c.kind === 'event') return 'local';
  if (c.kind === 'hotdeal') return 'deal';
  return 'utility';
}
export function planItem(item, config, now = new Date()) {
  const c = item.copyContext || {};
  const reasons = [];
  const quality = itemQuality(item);
  const expiry = expiryTime(item.expiresAt);
  if (Number.isNaN(expiry)) reasons.push('invalid_expiry');
  if (expiry !== null && expiry <= now.getTime()) reasons.push('expired');
  if (!quality.ok) reasons.push(...quality.reasons);
  if (item.verification?.status !== 'verified') reasons.push('source_not_verified');
  const observed = Date.parse(item.verification?.observedAt || '');
  const ttl = c.kind === 'hotdeal' ? 15 * 60e3 : 24 * 36e5;
  if (!Number.isFinite(observed) || observed > now.getTime() || now.getTime() - observed > ttl) reasons.push('source_stale');
  if (!Array.isArray(c.claims) || !c.claims.length || c.claims.some(x => x.verified !== true || !x.sourceUrl)) reasons.push('claim_not_verified');
  if (c.kind === 'policy' && !item.reviewApproval) reasons.push('policy_requires_review');
  if (c.kind === 'event') {
    if (!config.primaryRegions.length) reasons.push('region_not_configured');
    else if (!config.primaryRegions.some(r => clean(c.region).startsWith(clean(r)))) reasons.push('region_mismatch');
    if (!item.expiresAt || !c.start || !c.end) reasons.push('event_dates_missing');
  }
  if (c.memberSubmission && (!item.consent || !item.reviewApproval)) reasons.push('member_consent_or_review_missing');
  if (!['hotdeal', 'event', 'policy', 'service', 'comparison', 'digest', 'question'].includes(c.kind)) reasons.push('unsupported_kind');
  const bucket = classifyTopic(item);
  const need = clean(c.readerNeed || (c.kind === 'hotdeal' ? `${c.category || '생활용품'} 구매 비용 비교` : c.kind === 'event' ? `${c.region || ''} 나들이 일정` : ''));
  const angle = clean(c.editorialAngle || (c.kind === 'hotdeal' ? (c.unitInfo ? '수량과 단가로 구매 조건 비교' : '현재 가격과 배송 조건 확인') : c.kind === 'event' ? '지역·기간·비용을 함께 확인' : ''));
  const recipient = clean(c.shareRecipient || (c.kind === 'hotdeal' ? '같은 품목을 구매하려는 가족' : c.kind === 'event' ? '함께 나들이 갈 이웃' : ''));
  const returnReason = clean(c.returnReason || '');
  const points = {
    utility: { score: need ? Math.min(25, Math.round(quality.utilityScore / 4)) : 0, reason: need || '독자 필요 미정' },
    audience: { score: Math.round(quality.audienceFitScore / 5), reason: c.category || c.region || c.sourceTitle || '생활 절약 적합도' },
    share: { score: recipient ? 15 : 0, reason: recipient || '공유 대상 미정' },
    addedValue: { score: angle ? 15 : 0, reason: angle || '추가 가치 미정' },
    timing: { score: Number.isFinite(observed) ? 10 : 0, reason: item.verification?.observedAt || '확인 시각 없음' },
    return: { score: returnReason ? 10 : 0, reason: returnReason || '반복 가치 없음' },
    clarity: { score: c.claims?.length >= 2 ? 5 : 0, reason: `${c.claims?.length || 0}개 근거와 조건` }
  };
  const score = Object.values(points).reduce((a, x) => a + x.score, 0);
  const status = reasons.length ? 'review' : score >= config.topicAutoThreshold ? 'eligible' : score >= config.topicReviewThreshold ? 'review' : 'rejected';
  return { version: 4, status, reasons, score, points, bucket, objective: bucket === 'community' ? 'participation' : bucket === 'digest' ? 'return' : 'reach', readerNeed: need, editorialAngle: angle, shareRecipient: recipient || null, returnReason: returnReason || null, seriesId: c.seriesId || null, plannedAt: now.toISOString() };
}
export function chooseItem(queue, recent, today, config, learningFactor = () => 1) {
  const last = recent.at(-1);
  const lastTopic = last?.topic;
  const counts = recent.slice(-20).reduce((a, x) => { const b = x.editorialPlan?.bucket || (x.type === 'hotdeal' ? 'deal' : x.type === 'event' ? 'local' : 'utility'); a[b] = (a[b] || 0) + 1; return a; }, {});
  return queue.filter(x => {
    const merchant = sourceStore(x.buyUrl || x.sourceUrl);
    const typeCount = today.filter(p => p.type === x.type).length;
    if (typeCount >= (config.typeCaps[x.type] ?? 1)) return false;
    if (today.filter(p => (p.sourceStore || sourceStore(p.sourceUrl)) === merchant).length >= config.merchantDailyMax) return false;
    if (lastTopic && lastTopic === (x.copyContext?.category || x.copyContext?.intent || x.type)) return false;
    return x.editorialPlan?.status === 'eligible';
  }).map(item => {
    const b = item.editorialPlan.bucket;
    const share = (counts[b] || 0) / Math.max(1, Math.min(20, recent.length));
    return { item, rank: item.editorialPlan.score * Math.min(1.25, Math.max(0.75, learningFactor(item))) + ((config.portfolio[b] || 0) - share) * 30 };
  }).sort((a, b) => b.rank - a.rank)[0]?.item || null;
}
export function growthCopyFailures(item, candidate) {
  if (!item.editorialPlan) return [];
  const c = item.copyContext || {};
  const body = String(candidate.postBody || '');
  const text = candidate.postTitle + '\n' + body;
  const errors = [];
  if (/\[(?:지역|기관|날짜|연령|공식 링크|유료 항목)\]|\{\{/.test(text)) errors.push('unresolved_placeholder');
  for (const condition of c.requiredConditions || c.conditions || []) if (!body.includes(condition)) errors.push('condition_omitted');
  for (const fact of c.requiredFacts || []) if (!body.includes(fact)) errors.push('required_fact_omitted');
  if (c.kind === 'hotdeal' && c.shipping && !body.includes(c.shipping)) errors.push('shipping_omitted');
  if (c.kind === 'event' && (!text.includes(c.end) || !text.includes(c.cost))) errors.push('event_condition_omitted');
  if (!item.editorialPlan.readerNeed || !item.editorialPlan.editorialAngle) errors.push('no_reader_value');
  return [...new Set(errors)];
}
export function communitySnapshot(input = {}, now = new Date()) {
  const fields = ['members', 'joins', 'leaves', 'shares', 'saves', 'retention'];
  return { observedAt: now.toISOString(), source: input.source || null, ...Object.fromEntries(fields.map(k => [k, finite(input[k]) && input[k] >= 0 ? input[k] : null])), availability: Object.fromEntries(fields.map(k => [k, finite(input[k]) && input[k] >= 0 ? 'available' : 'unavailable'])) };
}
export function growthReport(published, metrics, snapshots = [], now = new Date()) {
  const ordered = snapshots.filter(x => finite(x.members)).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const from = ordered.at(-2), to = ordered.at(-1);
  const current = metrics.filter(m => m.lastScrape?.ok).map(m => m.snapshots?.at(-1)).filter(Boolean);
  return { generatedAt: now.toISOString(), publishedCount: published.filter(x => x.status === 'published').length, measuredPosts: current.length, memberNetChange: from && to ? to.members - from.members : null, memberWindow: from && to ? [from.observedAt, to.observedAt] : null, shares: null, saves: null, retention: null, attributedJoins: null, commentCountsIncludeOperator: true, exact24hViews: null, note: '일일 스냅샷. 조회수는 가입·공유·유지율이 아니며 댓글 수는 실질 회원 참여와 구분합니다.' };
}
