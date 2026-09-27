import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { fetchText } from './collectors.mjs';
import { kstDay } from './growth-engine.mjs';

const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const hash = s => createHash('sha256').update(s).digest('hex');
const useful = /절약|생활비|무료|할인|환급|요금|교통|주거|육아|돌봄|교육|도서관|공공|주차|충전|통신|소비자|택배|반품|휴가|여행|박물관|문화|장보기|상품권|지원금|보조금/;
const excluded = /대통령|정당|선거|북핵|전쟁|외교|정상회담|투자|주식|금리|대출|적금|청약|예금|암치료|예방접종|의약품|건강기능|국정|로드맵|공급계획|주거안정|공적주택|자회사|신규 직무/;

export function articleUrl(value) {
  try {
    const u = new URL(value, 'https://www.korea.kr');
    if (u.hostname !== 'www.korea.kr' || !/^\/news\/(policyNewsView|customizedNewsView)\.do$/.test(u.pathname) || !/^\d+$/.test(u.searchParams.get('newsId'))) return null;
    return `${u.origin}${u.pathname}?newsId=${u.searchParams.get('newsId')}`;
  } catch { return null; }
}
export function parseArticle(url, html, now = new Date()) {
  const $ = cheerio.load(html);
  const title = clean($('meta[property="og:title"]').attr('content'));
  const publishedAt = $('meta[property="article:published_time"]').attr('content');
  const age = now - new Date(publishedAt);
  if (!title || !useful.test(title) || excluded.test(title) || !Number.isFinite(age) || age < 0 || age > 120 * 864e5) return null;
  const body = $('.view_cont').first().clone();
  body.find('script,style,figure,.copyright,.kogl,.img_desc').remove();
  const paragraphs = body.find('p').map((_, e) => clean($(e).text())).get().filter(t => t.length > 15 && !/ⓒ|무단 전재|저작권|^문의\s*[:：]/.test(t));
  const text = paragraphs.join('\n');
  if (text.length < 150 || text.length > 16000) return null;
  return { url: articleUrl(url), title, publishedAt, text, today: kstDay(now), nowKst: new Date(now.getTime() + 9 * 36e5).toISOString().replace('Z', '+09:00') };
}

export function validateDraft(source, answer, now = new Date()) {
  const d = answer?.draft;
  if (!d || d.actionableNow !== true || answer.review?.ok !== true || d.title?.length > 55) return null;
  if (![d.title, d.category, d.readerNeed, d.editorialAngle, d.shareRecipient].every(v => typeof v === 'string' && v.trim().length > 2)) return null;
  if (!Array.isArray(d.facts) || d.facts.length < 2 || d.facts.length > 4 || !Array.isArray(d.conditions) || d.conditions.length > 3) return null;
  const lines = [...d.facts, ...d.conditions];
  const sourceText = clean(source.text);
  if (lines.some(x => typeof x.text !== 'string' || x.text.length < 12 || typeof x.evidence !== 'string' || x.evidence.length < 15 || !sourceText.includes(clean(x.evidence)))) return null;
  const allText = d.title + '\n' + lines.map(x => x.text).join('\n');
  if (allText.length < 120 || allText.length > 900 || /https?:|골라(?:봐요|보세요)|찾아(?:봐요|보세요)|챙겨보세요|확인하세요|저도|제가|써봤|대박|역대급/.test(allText)) return null;
  const numbers = s => [...String(s).matchAll(/\d+(?:[,.]\d+)*/g)].map(x => x[0].replaceAll(',', ''));
  const allowed = new Set(numbers(source.text + ' ' + source.publishedAt));
  if (numbers(allText).some(n => !allowed.has(n))) return null;
  // Never permit stale evidence indefinitely; source is refreshed before publishing.
  const maxExpiry = new Date(now.getTime() + 7 * 864e5).toISOString();
  const expiry = d.expiresAt ? Date.parse(d.expiresAt) : Date.parse(maxExpiry);
  if (d.expiresAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(d.expiresAt)) return null;
  if (!Number.isFinite(expiry) || expiry <= now.getTime()) return null;
  const facts = d.facts.map(x => x.text), conditions = d.conditions.map(x => x.text);
  const observedAt = now.toISOString();
  return {
    id: 'research:' + new URL(source.url).searchParams.get('newsId'), sourceUrl: source.url,
    title: d.title, type: 'tip', board: '💰 꿀팁 공유', trustScore: 95, imageUrl: '',
    contentVersion: hash(allText).slice(0, 16), expiresAt: new Date(Math.min(expiry, Date.parse(maxExpiry))).toISOString(),
    sourcePublishedAt: source.publishedAt, recheckEvidence: lines.map(x => clean(x.evidence)),
    sourceTextHash: hash(sourceText), generatedAt: observedAt, reviewRevision: 2,
    verification: { status: 'verified', observedAt, method: 'official_source_evidence_and_separate_ai_review', model: answer.model },
    copyContext: { kind: 'researched', intent: 'HOUSEHOLD_BRIEF', sourceTitle: d.title, category: d.category,
      readerNeed: d.readerNeed, editorialAngle: d.editorialAngle, shareRecipient: d.shareRecipient,
      returnReason: '새 생활비 정보와 이용 조건', seriesId: 'household-news',
      facts, conditions, requiredFacts: facts, requiredConditions: conditions, url: source.url,
      claims: lines.map((x, i) => ({ key: 'fact_' + i, value: x.text, evidence: x.evidence, sourceUrl: source.url, verified: true, observedAt })) }
  };
}

export async function collectResearch({ cache, published, attempts = {}, fetcher = fetchText, env = process.env, now = new Date(), maxAttempts = 4 }) {
  const done = new Set(published.map(x => articleUrl(x.sourceUrl)).filter(Boolean));
  const retained = cache.filter(x => x.reviewRevision === 2 && !done.has(x.sourceUrl) && Date.parse(x.expiresAt) > now.getTime()).slice(-40);
  const report = { cached: retained.length, attempted: 0, added: 0, failures: [] };
  // Re-observe cached sources: evidence changes invalidate the entire draft.
  const valid = [];
  for (const item of retained) {
    try {
      const page = await fetcher(item.sourceUrl, 12000, 1);
      const article = parseArticle(page.url, page.text, now);
      if (article && hash(clean(article.text)) === item.sourceTextHash) {
        item.verification.observedAt = now.toISOString();
        valid.push(item);
      }
    } catch { /* invalid cache entry cannot publish */ }
  }
  if (!env.DAANGN_EDITOR_URL || !env.DAANGN_EDITOR_TOKEN) {
    report.failures.push('editor_not_configured');
    return { items: valid, cache: valid, report };
  }
  if (valid.length >= 30) return { items: valid, cache: valid, report };
  const links = new Set();
  const keywords = ['무료', '할인', '육아', '교통', '통신', '소비자', '교육', '여행', '환급', '도서관', '장보기', '돌봄'];
  const offset = (Math.floor(now.getTime() / 36e5)) % keywords.length;
  const searches = ['', ...Array.from({ length: 4 }, (_, i) => keywords[(offset + i) % keywords.length])];
  for (const keyword of searches) {
    let list;
    try { list = await fetcher(`https://www.korea.kr/news/policyNewsList.do?smenu=EDS01&pageIndex=1&srchWord=${encodeURIComponent(keyword)}`, 12000, 1); }
    catch { report.failures.push('search_unavailable'); continue; }
    const $ = cheerio.load(list.text);
    $('a[href*="newsId="]').each((_, el) => {
      const url = articleUrl($(el).attr('href'));
      const text = clean($(el).text());
      if (url && useful.test(text) && !excluded.test(text.slice(0, 100))) links.add(url);
    });
  }
  for (const url of links) {
    if (done.has(url) || valid.some(x => x.sourceUrl === url)) continue;
    if (attempts[url] && now - new Date(attempts[url].at) < 24 * 36e5) continue;
    if (report.attempted >= maxAttempts) break;
    try {
      const page = await fetcher(url, 12000, 1);
      const source = parseArticle(page.url, page.text, now);
      if (!source) { attempts[url] = { at: now.toISOString(), status: 'irrelevant_or_stale' }; continue; }
      report.attempted++;
      const response = await fetch(env.DAANGN_EDITOR_URL + '/draft', {
        method: 'POST', headers: { authorization: `Bearer ${env.DAANGN_EDITOR_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify(source), signal: AbortSignal.timeout(100000)
      });
      if (!response.ok) { report.failures.push('editor_http_' + response.status); break; }
      const answer = await response.json();
      const item = validateDraft(source, answer, now);
      attempts[url] = { at: now.toISOString(), status: item ? 'accepted' : 'rejected' };
      if (item) { valid.push(item); report.added++; }
      else report.failures.push({ url, reason: answer.reason || 'draft_validation_failed' });
    } catch { report.failures.push({ url, reason: 'source_or_editor_unavailable' }); }
  }
  return { items: valid, cache: valid, report };
}
