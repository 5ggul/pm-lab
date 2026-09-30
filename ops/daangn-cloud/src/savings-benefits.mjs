import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';

const METHOD = 'reviewed_savings_benefit_v1';
const REVIEW_UNTIL = '2026-12-29T14:59:59.999Z';
const clean = s => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

// These are maintained service pages, not news headlines or a keyword feed.
// Only the reviewed content sections are accepted; changed terms require review.
const DOCUMENTS = {
  refund: { url: 'https://www.smartchoice.or.kr/smc/support/faq.do?tab=C', hash: '73ccbd86c544ff4a4ad3fa73550a074931cb08a32548d141b359575297654ec8' },
  contract: { url: 'https://www.smartchoice.or.kr/smc/service/danpageNew.do', hash: '5e33c28d775cc1837fd07e01f440ac2b7936475a529b0ddf63b266bc1ba44e20' },
  contractApply: { url: 'https://www.smartchoice.or.kr/smc/service/danpageNew2.do', hash: 'a60ef12f5dece37d41c03f5b92dcbcba02f903d48af62dfa3ab0a615e6b7ea4b' },
  senior: { url: 'https://www.tworld.co.kr/poc/html/product/ATS3.3.1T.15.html', hash: '1713a6afa1a52c27873479249b4a4e5339d66856ed22f73128cc311037e481ac' },
  infant: { url: 'https://yangsan.go.kr/welfare/contents.do?mid=0101041000', hash: '8b175d254c535ccc2010f10d57866e17038eb1a544a2dd4cb8a0f209eb53d74f' }
};

const ENTRIES = [
  {
    id: 'telecom-unclaimed-refund', documents: ['refund'], category: '환급·숨은돈', benefitType: 'refund', audience: ['women', 'moms', 'seniors'],
    headlines: ['통신사 옮긴 뒤 남은 돈? 미환급액 조회', '해지한 휴대폰·집전화, 미환급액 확인'],
    lines: [
      '대상: KT·SKT·LG U+·SK브로드밴드 유선·이동전화 해지 또는 번호이동 고객',
      '환급액: 조회 결과에 따라 다름. 미환급액이 있는 경우만 신청 가능',
      '신청: 스마트초이스 또는 해당 통신사 홈페이지·고객센터',
      '본인 실명확인·계좌인증 필요. 본인 명의 계좌로 환급. 14세 미만은 통신사 문의',
      '통신사 최종 확인·미납 정산에 따라 실제 환급액이 달라질 수 있음'
    ],
    need: '해지·번호이동 뒤 남은 통신요금 환급', recipient: '통신사를 바꾼 가족',
    percent: null, maximum: null
  },
  {
    id: 'mobile-selective-contract', documents: ['contract', 'contractApply'], category: '요금·생활비 절약', benefitType: 'bill_discount', audience: ['women', 'moms', 'seniors'],
    headlines: ['약정 끝난 휴대폰, 요금 25% 할인 대상', '휴대폰 그대로 써도 25% 요금할인 가능'],
    lines: [
      '선택약정: 월 이동통신 요금 25% 할인',
      '대상: 단말기 지원금을 받지 않았거나 약정 종료·지원금 위약금 정산을 마친 대상 단말기',
      '1년 또는 2년 약정. 월 요금·다른 할인에 따라 실제 할인액은 다름',
      '신청: SKT·KT·LG U+ 홈페이지, 대리점 또는 전화',
      '중도 해지 시 할인반환금 발생 가능. 가입 전 대상 여부·반환금 확인'
    ],
    need: '가족 휴대폰의 매달 통신비 할인', recipient: '약정이 끝난 휴대폰을 쓰는 가족',
    percent: 25, maximum: null
  },
  {
    id: 'skt-basic-pension-discount', documents: ['senior'], category: '육아·시니어 혜택', benefitType: 'bill_discount', audience: ['seniors', 'women'],
    headlines: ['기초연금 받는 SKT 고객, 월 최대 12,100원 감면', 'SKT 통신비 50% 감면, 기초연금 수급자 대상'],
    lines: [
      '대상: 복지감면 자격이 확인된 SKT 기초연금 수급자',
      '기본료·국내음성·데이터 통화료 50% 감면, 월 최대 12,100원(부가세 포함)',
      '다른 할인 적용 후 금액 기준. 실제 감면액은 요금에 따라 다름',
      '타 통신사 포함 본인 1회선. 다른 복지할인과 중복 불가',
      '신청: SKT 114 또는 지점·대리점. 수급자격 상실 시 감면 중단'
    ],
    need: '기초연금 수급자의 매달 휴대폰 비용 감면', recipient: '기초연금을 받는 부모님',
    percent: 50, maximum: 12100
  },
  {
    id: 'infant-household-electricity', documents: ['infant'], category: '육아·시니어 혜택', benefitType: 'bill_discount', audience: ['moms', 'women'],
    headlines: ['3세 미만 아이 있는 집, 전기요금 30% 할인', '출산가구 전기요금, 월 최대 16,000원 할인'],
    lines: [
      '대상: 출생일부터 3년 미만인 영아가 있는 가구',
      '해당 월 전기요금 30% 할인, 월 최대 16,000원',
      '적용 기간: 아이 출생일부터 3년 이내. 월 전기요금에 따라 할인액은 다름',
      '신청·적용 시작일 문의: 한국전력 123',
      '공식 안내: 양산시 복지포털의 한국전력 출산가구 전기요금 감액'
    ],
    need: '영아를 키우는 가구의 매달 전기요금 할인', recipient: '3세 미만 아이를 키우는 가족',
    percent: 30, maximum: 16000
  }
];

export function extractSavingsEvidence(key, html) {
  const $ = cheerio.load(String(html || ''));
  $('script,style,noscript').remove();
  // Insert spaces at block boundaries so markup changes cannot join money values.
  $('br').replaceWith(' ');
  if (key === 'refund') {
    const questions = [
      '환급신청은 누구나 가능한가요?', '통신 미환급액 정보조회 대상이 궁금합니다.',
      '통신 미환급액 환급 방법을 자세히 알려주세요.', '환급신청은 어디에서 가능한가요?'
    ];
    const sections = questions.map(q => $('.contWrapper .subContWrap--ask').filter((_, e) => clean($(e).find('.faqTit').text()) === q).find('.subCont--ask').text());
    if (sections.some(x => !clean(x))) return '';
    return sections.map(clean).join('\n');
  }
  if (key === 'contract' || key === 'contractApply') return clean($('.contWrapper').text());
  if (key === 'senior') {
    const benefit = $('.bf_d_title').filter((_, e) => clean($(e).text()) === '기초연금 수급자').parent();
    const limits = $('.bf_more_text');
    const application = $('.step_way').filter((_, e) => $(e).find('.title_txt').text().includes('고객센터 연결'));
    if (benefit.length !== 1 || !limits.length || !application.length) return '';
    return [benefit.text(), limits.text(), application.text()].map(clean).join('\n');
  }
  if (key === 'infant') {
    const labels = ['지원대상', '지원사항', '담당부서'];
    const sections = labels.map(label => $('.desc').filter((_, e) => clean($(e).find('.s-title').text()) === label).text());
    if (sections.some(x => !clean(x))) return '';
    return sections.map(clean).join('\n');
  }
  return '';
}

const documentUrls = entry => entry.documents.map(key => DOCUMENTS[key].url);
function contextFor(entry) {
  return {
    kind: 'benefit', intent: entry.benefitType === 'refund' ? 'REFUND_CHECK' : 'BILL_SAVING',
    benefitId: entry.id, benefitType: entry.benefitType, category: entry.category,
    audience: [...entry.audience], sourceTitle: entry.headlines[0], sourceUrls: documentUrls(entry),
    url: documentUrls(entry)[0], headlineCandidates: [...entry.headlines], facts: [...entry.lines],
    benefitLines: [...entry.lines], requiredFacts: [...entry.lines], requiredConditions: entry.lines.slice(1),
    conditions: entry.lines.slice(1), readerNeed: entry.need, editorialAngle: '공식 신청 조건과 실제 금액·상한',
    shareRecipient: entry.recipient, returnReason: '가족 생활비 할인·미환급액 안내',
    seriesId: 'verified-family-savings', benefitPercent: entry.percent, benefitMaximum: entry.maximum,
    claims: entry.lines.map((value, i) => ({ key: 'benefit_' + i, value, verified: true, sourceUrl: documentUrls(entry)[0] }))
  };
}
const signature = entry => hash({ id: entry.id, documents: entry.documents.map(key => DOCUMENTS[key]), context: contextFor(entry), reviewUntil: REVIEW_UNTIL });

export function savingsBenefitScope(item, now = new Date()) {
  const entry = ENTRIES.find(e => e.id === item?.copyContext?.benefitId);
  if (!entry || +new Date(now) > +new Date(REVIEW_UNTIL)) return false;
  const observed = +new Date(item.verification?.observedAt);
  return item.type === 'tip' && item.sourceId === entry.id && item.sourceUrl === documentUrls(entry)[0] &&
    item.verification?.method === METHOD && item.verification?.status === 'verified' &&
    Number.isFinite(observed) && observed <= +new Date(now) + 60000 && +new Date(now) - observed <= 864e5 &&
    item.verification.fingerprint === signature(entry) && hash(item.copyContext) === hash(contextFor(entry));
}

function verifyPage(key, page) {
  const document = DOCUMENTS[key];
  if (!page || page.url !== document.url) return { ok: false, reason: 'benefit_source_redirected' };
  const text = extractSavingsEvidence(key, page.text);
  return text && hash(text) === document.hash ? { ok: true } : { ok: false, reason: 'benefit_terms_changed:' + key };
}

export async function collectSavingsBenefits(state, fetcher, now = new Date()) {
  const diagnostics = { discovered: ENTRIES.length, checked: 0, verified: 0, skipped: {}, examples: [] };
  const reject = (reason, entry) => { diagnostics.skipped[reason] = (diagnostics.skipped[reason] || 0) + 1; diagnostics.examples.push({ id: entry.id, reason }); };
  const items = [];
  const pages = new Map();
  const getPage = key => {
    if (!pages.has(key)) pages.set(key, fetcher(DOCUMENTS[key].url, 12000, 1));
    return pages.get(key);
  };
  for (const entry of ENTRIES) {
    if (+new Date(now) > +new Date(REVIEW_UNTIL)) { reject('benefit_review_expired', entry); continue; }
    const recent = (state.published || []).some(p => (p.sourceId === entry.id || p.sourceUrl === documentUrls(entry)[0]) && +new Date(now) - +new Date(p.publishedAt || p.at || 0) < 30 * 864e5);
    if (recent) { reject('benefit_recently_published', entry); continue; }
    diagnostics.checked++;
    try {
      const verified = await Promise.all(entry.documents.map(async key => verifyPage(key, await getPage(key))));
      const failed = verified.find(result => !result.ok);
      if (failed) { reject(failed.reason, entry); continue; }
      items.push({
        id: 'benefit:' + entry.id, sourceId: entry.id, sourceUrl: documentUrls(entry)[0],
        type: 'tip', board: '💰 꿀팁 공유', title: entry.headlines[0], trustScore: 98,
        category: entry.category, expiresAt: REVIEW_UNTIL,
        verification: { status: 'verified', observedAt: now.toISOString(), method: METHOD, fingerprint: signature(entry) },
        copyContext: contextFor(entry)
      });
      diagnostics.verified++;
    } catch (error) { reject('benefit_source_unavailable:' + String(error.message).slice(0, 70), entry); }
  }
  return { items, diagnostics };
}

export async function recheckSavingsBenefit(item, fetcher, now = new Date()) {
  if (!savingsBenefitScope(item, now)) return { ok: false, reason: 'unreviewed_or_stale_benefit' };
  const entry = ENTRIES.find(e => e.id === item.copyContext.benefitId);
  try {
    for (const key of entry.documents) {
      const result = verifyPage(key, await fetcher(DOCUMENTS[key].url, 12000, 1));
      if (!result.ok) return result;
    }
    return { ok: true };
  } catch { return { ok: false, reason: 'benefit_source_unavailable' }; }
}

export function renderSavingsBenefitCandidates(ctx, platform = 'daangn') {
  const entry = ENTRIES.find(e => e.id === ctx?.benefitId);
  if (!entry || hash(ctx) !== hash(contextFor(entry))) return [];
  return entry.headlines.map((postTitle, i) => ({
    styleMode: i ? 'CONDITION_FIRST' : 'CHANGE_FIRST', titleStrategy: 'BENEFIT_' + entry.benefitType.toUpperCase(),
    bodyStrategy: 'benefit-facts-' + i, skeleton: 'benefit:' + entry.id + ':' + i,
    postTitle, postBody: [...entry.lines, ...documentUrls(entry)].join('\n')
  }));
}
