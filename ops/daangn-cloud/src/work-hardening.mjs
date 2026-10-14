import { titleTokenFailures, cleanTitleText } from './title-tools.mjs';
import { publicCondition } from './editorial-language.mjs';
const normalize = s => String(s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
export function deadlineInfo(raw, now = new Date()) {
  if (!raw) return { state: 'not_disclosed', precision: null, timestamp: null };
  const text = String(raw).trim(), day = text.match(/^(\d{4})[-.]?(\d{2})[-.]?(\d{2})$/);
  if (day) {
    const date = `${day[1]}-${day[2]}-${day[3]}`, parsed = new Date(date + 'T00:00:00Z');
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date) return { state: 'invalid', precision: null, timestamp: null };
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
    return { state: date < today ? 'deadline_passed' : 'time_unverified', precision: 'date', date, timestamp: null };
  }
  const absolute = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/), ms = absolute ? Date.parse(text) : NaN;
  if (!absolute || !Number.isFinite(ms) || Number(absolute[2]) > 23 || Number(absolute[3]) > 59 || Number(absolute[4] || 0) > 59 || deadlineInfo(absolute[1], now).state === 'invalid') return { state: 'invalid', precision: null, timestamp: null };
  return { state: ms <= now.getTime() ? 'deadline_passed' : 'within_stated_period', precision: 'instant', timestamp: ms };
}
export function verifyEditorTitle(expected, actual, maxLength = 50) {
  const limit = Number.isInteger(maxLength) && maxLength > 0 ? Math.min(50, maxLength) : 50;
  const errors = titleTokenFailures(expected, { max: limit });
  if (expected !== actual) errors.push('EDITOR_TITLE_MISMATCH');
  return { ok: errors.length === 0, errors };
}
export function lifecycleState(record, observation = {}, now = new Date()) {
  const knownDeadline = record.expiresAt || record.deadline?.raw, d = deadlineInfo(knownDeadline, now);
  if (observation.verified === true && observation.status === 'sold_out') return { state: 'sold_out', reviewRequired: false };
  if (observation.verified === true && observation.status === 'ended') return { state: 'ended', reviewRequired: false };
  if (observation.verified === true && observation.expiresAt && observation.expiresAt !== knownDeadline) return { state: 'changed', reviewRequired: true, change: 'deadline', newDeadline: observation.expiresAt };
  if (observation.verified === true && observation.fingerprint && record.sourceFingerprint && observation.fingerprint !== record.sourceFingerprint) return { state: 'changed', reviewRequired: true, change: 'conditions' };
  if (d.state === 'deadline_passed') return { state: 'deadline_passed', reviewRequired: true, sourceUnavailable: observation.available === false };
  if (!knownDeadline && /(?:행사\s*종료|할인\s*기한|마감)\s*:?\s*\d{1,2}\/\d{1,2}/.test(record.bodyText || '')) return { state: 'legacy_deadline_unverified', reviewRequired: true };
  if (observation.available === false) return { state: 'source_unavailable', reviewRequired: true };
  return { state: d.state, reviewRequired: ['invalid', 'time_unverified'].includes(d.state) };
}
export function buildLifecycleQueue(records, now = new Date()) { return records.filter(r => r.status === 'published').map(r => ({ postUrl: r.postUrl, title: r.title, ...lifecycleState(r, {}, now), checkedAt: now.toISOString() })).filter(x => x.reviewRequired); }

export function samePostUrl(a,b) {
  try { const x=new URL(a),y=new URL(b); return x.origin===y.origin && decodeURIComponent(x.pathname)===decodeURIComponent(y.pathname); } catch { return false; }
}
export function verifyPublishedSnapshot(item,snapshot,{postUrl,submissionStartedAt,expectedImageCount=0,now=new Date()}={}) {
  const errors=[...(snapshot?.errors||[])];
  if(cleanTitleText(snapshot?.title)!==cleanTitleText(item.postTitle))errors.push('SAVED_TITLE_MISMATCH');
  if(normalize(snapshot?.body)!==normalize(item.postBody))errors.push('SAVED_BODY_MISMATCH');
  if(snapshot?.board!==item.board)errors.push('SAVED_BOARD_MISMATCH');
  if((snapshot?.images?.length||0)!==expectedImageCount)errors.push('SAVED_IMAGE_COUNT_MISMATCH');
  if(!samePostUrl(snapshot?.postUrl,postUrl))errors.push('SAVED_POST_IDENTITY_MISMATCH');
  const submitted=Date.parse(submissionStartedAt||''),published=Date.parse(snapshot?.datePublished||'');
  if(!Number.isFinite(submitted)||!Number.isFinite(published)||published<submitted-5000||published>+now+5000)errors.push('SAVED_PUBLICATION_TIME_UNVERIFIED');
  return {ok:errors.length===0,status:errors.length?'publish_unknown':'published',errors:[...new Set(errors)]};
}
export function runtimeDraftFailures(item,{now=new Date()}={}) {
  const c=item.copyContext||{},errors=titleTokenFailures(item.postTitle,{price:c.kind==='hotdeal'?c.price:null});
  const d=deadlineInfo(item.expiresAt,now);
  if(d.state==='deadline_passed')errors.push('DEADLINE_PASSED');
  if(['invalid','time_unverified'].includes(d.state))errors.push('DEADLINE_UNVERIFIED');
  if(c.kind==='hotdeal') {
    const body=String(item.postBody||'');
    if(/기재된\s*기한/.test(body)||/행사\s*종료\s*:?\s*\d/.test(body))errors.push('DEADLINE_LABEL_NOT_UPDATED');
    if(body.includes('다른 판매처의 최저가를 확인한 정보는 아닙니다.'))errors.push('REMOVED_EDITORIAL_SENTENCE');
    for(const condition of c.requiredConditions||c.conditions||[])if(!publicCondition(body).includes(publicCondition(condition)))errors.push('CONDITION_OMITTED');
  }
  return [...new Set(errors)];
}
