import { platformProfile } from './platform-profiles.mjs';

const URL_RE = /https?:\/\/\S+/gi;
const BANNED_AI = /(핵심만 보면|기준으로 보면|결국|체감|판단하면|볼 만해요|볼 만|눈여겨|반갑죠|감 와요|더 감이 와요|요건 챙겨|필요한 숫자만|간단히 적어둘게|생활에 영향 있는 내용만|한 번 체크해보세요|꼼꼼히 확인하세요|좋은 선택이 될 수|합리적인 가격|경쟁력 있는 가격|추천드립니다|도움이 되실 것 같|참고하시면 좋을 것 같|확인됩니다|확인해주세요|덜 내는 셈|아끼는 셈)/;
const FAKE_EXPERIENCE = /(저도\s*(?:샀|구매|주문|써|먹어|다녀)|제가\s*(?:샀|구매|주문|써|먹어|다녀)|저희\s*애|우리\s*애|써봤|먹어봤|사용해봤|직접\s*써|직접\s*먹|다녀왔는데|원래\s*쓰던|친구가\s*(?:샀|써|먹)|엄마가\s*(?:좋아|샀|써))/;
const HYPE = /(무조건|대박|역대급|미쳤|혜자|꼭\s*사|놓치면\s*후회|강추|무조건\s*이득|역대\s*최저가)/;
const CUTE_RE = /(나와용|보세용|챙겨용|해용|됩니당|입니당|좋습니당|왔어용|내려왔어용|참고해용)/g;
const CTA_RE = /(보세요|보세용|참고하세요|참고해요|참고해용|챙기세요|챙겨용|확인하세요|다녀오세요|다녀오세용)/g;
const EMOJI_RE = /[\p{Extended_Pictographic}]/gu;

export const cleanText = s => String(s || '').replace(/\s+/g, ' ').trim();
export function sourceStore(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}
const stripUrls = s => String(s || '').replace(URL_RE, ' ');

export function normalizedText(s = '') {
  return stripUrls(s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\d[\d,.]*/g, '#')
    .replace(/[^\p{L}\p{N}#%]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s = '') {
  return normalizedText(s).split(' ').filter(x => x.length > 1);
}

function shingles(s = '', n = 2) {
  const t = tokens(s);
  const out = new Set();
  for (let i = 0; i <= t.length - n; i += 1) out.add(t.slice(i, i + n).join(' '));
  return out;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const v of a) if (b.has(v)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function textSimilarity(a = '', b = '', n = 2) {
  return jaccard(shingles(a, n), shingles(b, n));
}

function prefix(s = '', n = 24) {
  return normalizedText(s).replace(/\s+/g, '').slice(0, n);
}

function lines(body = '') {
  return String(body).split(/\n+/).map(cleanText).filter(Boolean);
}

function nonLinkLines(body = '') {
  return lines(body).filter(x => !/^https?:\/\//i.test(x) && !/^\S*\s*https?:\/\//i.test(x));
}

function linkPosition(body = '') {
  const all = lines(body);
  const idx = all.findIndex(x => /https?:\/\//i.test(x));
  if (idx < 0) return 'none';
  if (idx === 0) return 'start';
  if (idx === all.length - 1) return /^https?:\/\//i.test(all[idx]) ? 'end' : 'labeled-end';
  return 'middle';
}

function sentenceLengthPattern(body = '') {
  return nonLinkLines(body).map(x => x.length < 16 ? 'S' : x.length < 36 ? 'M' : 'L').join('');
}

function endingForms(body = '') {
  return nonLinkLines(body).map(x => x.replace(/[.!?~ㅎㅋ\s]+$/g, '').slice(-5)).filter(Boolean);
}

function count(re, s) {
  return (String(s || '').match(re) || []).length;
}

function numericTokens(s = '') {
  return [...stripUrls(s).matchAll(/\d+(?:[,.]\d+)*/g)]
    .map(m => m[0].replace(/,/g, ''))
    .filter(Boolean);
}

function collectAllowedNumbers(value, out = new Set(), key = '') {
  if (value == null) return out;
  if (/url|id$/i.test(key)) return out;
  if (typeof value === 'number' && Number.isFinite(value)) {
    out.add(String(value));
    out.add(String(Math.round(value)));
    out.add(String(Math.round(value * 10) / 10));
    return out;
  }
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) return out;
    for (const token of numericTokens(value)) out.add(token);
    return out;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectAllowedNumbers(v, out, key);
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectAllowedNumbers(v, out, k);
  }
  return out;
}

function numericClaimCheck(item, title, body) {
  const allowed = collectAllowedNumbers(item?.copyContext || {});
  if (!allowed.size) return { ok: true, unknown: [] };
  const used = new Set([...numericTokens(title), ...numericTokens(body)]);
  const unknown = [...used].filter(x => !allowed.has(x));
  return { ok: unknown.length === 0, unknown };
}

function sourceTrust(item) {
  if (Number.isFinite(item?.trustScore)) return item.trustScore;
  const kind = item?.copyContext?.kind;
  if (kind === 'policy') return 98;
  if (kind === 'event') return 96;
  if (kind === 'hotdeal') {
    if (item?.baselineSource === '최근 관측가 중앙값') return 93;
    if (item?.baselineSource === '상품 페이지 기준가') return 90;
    return 86;
  }
  return 75;
}

export function audienceFitScore(item) {
  const text = [
    item?.title,
    item?.copyContext?.product,
    item?.copyContext?.sourceTitle,
    item?.copyContext?.name,
    item?.copyContext?.category,
    item?.copyContext?.intent
  ].filter(Boolean).join(' ');
  let score = 55;
  if (/(생필품|생활용품|세제|휴지|물티슈|치약|샴푸|주방|침구|식품|쌀|햇반|과일|채소|고기|생선|우유|커피|간식)/.test(text)) score += 25;
  if (/(육아|아이|자녀|어린이|교육|학원|보육|출산|돌봄)/.test(text)) score += 30;
  if (/(건강|검진|의료|병원|치과|요양|연금|어르신|시니어)/.test(text)) score += 25;
  if (/(환급|지원금|보조금|세금|공제|보험료|전기|가스|통신|공과금|청약|대출|금리)/.test(text)) score += 25;
  if (/(무료|축제|나들이|공원|체험|가족|주말)/.test(text)) score += 20;
  if (item?.copyContext?.kind === 'event') score += 15;
  if (item?.copyContext?.kind === 'event' && /무료|0원/.test(item?.copyContext?.cost || '')) score += 10;
  if (/(의류|신발|화장품|미용|헤어|가전)/.test(text)) score += 10;
  if (/(게이밍|그래픽카드|RTX\s*\d|GTX\s*\d|\bX3D\b|메인보드|PC부품|키보드|피규어|프라모델|낚시|골프채|명품|슈퍼카)/i.test(text)) score -= 80;
  return Math.max(0, Math.min(100, score));
}

function utilityScore(item) {
  const kind = item?.copyContext?.kind;
  if (kind === 'hotdeal') {
    const pct = Number(item?.discountPct || item?.copyContext?.discountPct || 0);
    const saving = Number(item?.saving || item?.copyContext?.saving || 0);
    return Math.max(30, Math.min(100, 50 + pct + Math.min(25, saving / 2000)));
  }
  if (kind === 'event') return /무료|0원/.test(item?.copyContext?.cost || '') ? 88 : 72;
  if (kind === 'policy') return item?.copyContext?.intent === 'DEADLINE' ? 92 : 86;
  return 60;
}

function freshnessScore(item) {
  if (item?.expiresAt) return 95;
  return 85;
}

export function itemQuality(item) {
  const trust = sourceTrust(item);
  const audience = audienceFitScore(item);
  const utility = utilityScore(item);
  const freshness = freshnessScore(item);
  const condition = item?.copyContext?.kind === 'hotdeal'
    ? (item?.price && item?.sourceUrl ? 90 : 55)
    : 90;
  const base = trust * 0.20 + audience * 0.25 + utility * 0.25 + freshness * 0.15 + condition * 0.10 + 5;
  const hardReasons = [];
  if (trust < 80) hardReasons.push('trust_too_low');
  if (audience < 45) hardReasons.push('audience_mismatch');
  if (base < 70) hardReasons.push('quality_below_70');
  return {
    trustScore: Math.round(trust),
    audienceFitScore: Math.round(audience),
    utilityScore: Math.round(utility),
    freshnessScore: Math.round(freshness),
    conditionClarityScore: Math.round(condition),
    qualityScore: Math.round(base),
    ok: hardReasons.length === 0,
    reasons: hardReasons
  };
}

export function buildCopyMeta(title, body, hints = {}) {
  const text = title + '\n' + body;
  const bodyLines = nonLinkLines(body);
  const first = bodyLines[0] || '';
  const last = bodyLines.at(-1) || '';
  const cute = count(CUTE_RE, text);
  const cta = count(CTA_RE, text);
  const endings = endingForms(body);
  const rhythmSignature = [
    bodyLines.length,
    sentenceLengthPattern(body),
    linkPosition(body),
    cute,
    cta,
    endings.map(x => x.slice(-2)).join('/')
  ].join('|');
  return {
    platform: hints.platform || 'daangn',
    intent: hints.intent || '',
    styleMode: hints.styleMode || '',
    titleStrategy: hints.titleStrategy || hints.titlePattern || '',
    bodyStrategy: hints.bodyStrategy || hints.bodyPattern || '',
    skeleton: hints.skeleton || '',
    titleOpeningKey: prefix(title, 16),
    openingKey: prefix(first),
    closingKey: prefix(last),
    sentenceCount: bodyLines.length,
    sentenceLengthPattern: sentenceLengthPattern(body),
    endingForms: endings,
    linkPosition: linkPosition(body),
    cuteEndingCount: cute,
    ctaCount: cta,
    emojiCount: count(EMOJI_RE, text),
    rhythmSignature,
    normalizedTitle: normalizedText(title),
    normalizedBody: normalizedText(body)
  };
}

function recentMeta(post) {
  if (post?.copyMeta) return post.copyMeta;
  return {
    platform: 'daangn',
    intent: post?.intent || post?.type || '',
    styleMode: post?.styleMode || '',
    titleStrategy: post?.titlePattern || '',
    bodyStrategy: post?.bodyPattern || '',
    skeleton: post?.bodyPattern || '',
    titleOpeningKey: prefix(post?.title || '', 16),
    openingKey: '',
    closingKey: '',
    sentenceCount: 0,
    sentenceLengthPattern: '',
    endingForms: [],
    linkPosition: '',
    cuteEndingCount: 0,
    ctaCount: 0,
    emojiCount: 0,
    rhythmSignature: '',
    normalizedTitle: normalizedText(post?.title || ''),
    normalizedBody: normalizedText(post?.bodyText || '')
  };
}

export function assessCopyCandidate({ item, candidate, recentPosts = [], platform = 'daangn' }) {
  const profile = platformProfile(platform);
  const title = cleanText(candidate.postTitle);
  const body = String(candidate.postBody || '').trim();
  const text = title + '\n' + body;
  const meta = buildCopyMeta(title, body, {
    platform,
    intent: item?.copyContext?.intent || item?.type || '',
    styleMode: candidate.styleMode,
    titleStrategy: candidate.titleStrategy,
    bodyStrategy: candidate.bodyStrategy,
    skeleton: candidate.skeleton
  });
  const hardReasons = [];
  let penalty = 0;

  if (!title || !body) hardReasons.push('empty_copy');
  if (title.length > profile.titleMax) hardReasons.push('title_too_long');
  if (meta.sentenceCount < profile.minBodyLines || meta.sentenceCount > profile.maxBodyLines) hardReasons.push('body_line_count');
  if (BANNED_AI.test(text)) hardReasons.push('banned_ai_phrase');
  if (FAKE_EXPERIENCE.test(text)) hardReasons.push('fake_experience');
  if (HYPE.test(text)) hardReasons.push('hype_phrase');
  if (meta.cuteEndingCount > profile.maxCutePerPost) hardReasons.push('cute_budget');
  if (meta.ctaCount > profile.maxCtaPerPost) hardReasons.push('cta_budget');
  if (meta.emojiCount > profile.maxEmoji) hardReasons.push('emoji_budget');

  const claimCheck = numericClaimCheck(item, title, body);
  if (!claimCheck.ok) hardReasons.push('unsupported_number:' + claimCheck.unknown.join(','));

  const history = recentPosts.slice(-profile.historyWindow);
  const metas = history.map(recentMeta);
  const last = metas.at(-1);
  if (candidate.styleMode && last?.styleMode === candidate.styleMode) hardReasons.push('consecutive_style_mode');

  const skeletonWindow = metas.slice(-profile.hardSkeletonWindow);
  if (meta.skeleton && skeletonWindow.some(x => x.skeleton === meta.skeleton)) hardReasons.push('recent_skeleton_duplicate');

  const titleOpeningWindow = metas.slice(-profile.hardTitleOpeningWindow);
  if (meta.titleOpeningKey && titleOpeningWindow.some(x => x.titleOpeningKey && x.titleOpeningKey === meta.titleOpeningKey)) {
    hardReasons.push('recent_title_hook_duplicate');
  }

  const openingWindow = metas.slice(-profile.hardOpeningWindow);
  if (meta.openingKey && openingWindow.some(x => x.openingKey && x.openingKey === meta.openingKey)) hardReasons.push('recent_opening_duplicate');

  const closingWindow = metas.slice(-profile.hardClosingWindow);
  if (meta.closingKey && closingWindow.some(x => x.closingKey && x.closingKey === meta.closingKey)) hardReasons.push('recent_closing_duplicate');

  const cuteWindow = metas.slice(-profile.recentCuteWindow);
  if (meta.cuteEndingCount && cuteWindow.filter(x => x.cuteEndingCount > 0).length >= profile.maxCutePostsInWindow) {
    hardReasons.push('recent_cute_budget');
  }

  const ctaWindow = metas.slice(-profile.recentCtaWindow);
  if (meta.ctaCount && ctaWindow.filter(x => x.ctaCount > 0).length >= profile.maxCtaPostsInWindow) {
    hardReasons.push('recent_cta_budget');
  }

  let maxTitleSimilarity = 0;
  let maxBodySimilarity = 0;
  for (const post of history) {
    const oldTitle = post?.title || post?.copyMeta?.normalizedTitle || '';
    const oldBody = post?.bodyText || post?.copyMeta?.normalizedBody || '';
    maxTitleSimilarity = Math.max(maxTitleSimilarity, textSimilarity(title, oldTitle, 2));
    if (oldBody) maxBodySimilarity = Math.max(maxBodySimilarity, textSimilarity(body, oldBody, 2));
  }
  if (maxTitleSimilarity > profile.hardTitleSimilarity) hardReasons.push('title_similarity');
  if (maxBodySimilarity > profile.hardBodySimilarity) hardReasons.push('body_similarity');

  const recentModes = metas.slice(-10).map(x => x.styleMode).filter(Boolean);
  if (candidate.styleMode) {
    const modeShare = recentModes.filter(x => x === candidate.styleMode).length / Math.max(1, recentModes.length);
    if (modeShare >= 0.30) penalty += 35;
  }
  const recentTitles = metas.slice(-5).map(x => x.titleStrategy).filter(Boolean);
  if (recentTitles.includes(meta.titleStrategy)) penalty += 20;
  const recentLinks = metas.slice(-4).map(x => x.linkPosition).filter(Boolean);
  if (recentLinks.length === 4 && recentLinks.every(x => x === meta.linkPosition)) penalty += 15;
  const recentRhythms = metas.slice(-20).map(x => x.rhythmSignature).filter(Boolean);
  if (recentRhythms.includes(meta.rhythmSignature)) penalty += 20;

  const naturalnessScore = Math.max(0, Math.min(100,
    92
    - meta.cuteEndingCount * 4
    - meta.ctaCount * 3
    - maxTitleSimilarity * 30
    - maxBodySimilarity * 35
    - penalty * 0.25
  ));
  const noveltyScore = Math.max(0, Math.min(100, 100 - maxTitleSimilarity * 45 - maxBodySimilarity * 55 - penalty * 0.35));
  const quality = itemQuality(item);
  const finalScore = Math.round(
    quality.qualityScore * 0.55 +
    naturalnessScore * 0.20 +
    noveltyScore * 0.25
  );

  return {
    ok: hardReasons.length === 0 && finalScore >= 72 && quality.ok,
    reasons: [...quality.reasons, ...hardReasons],
    meta,
    scores: {
      ...quality,
      naturalnessScore: Math.round(naturalnessScore),
      noveltyScore: Math.round(noveltyScore),
      finalScore
    },
    maxTitleSimilarity: Number(maxTitleSimilarity.toFixed(3)),
    maxBodySimilarity: Number(maxBodySimilarity.toFixed(3)),
    penalty
  };
}
