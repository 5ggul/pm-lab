import assert from 'node:assert/strict';
import { parseArticle, articleUrl, validateDraft } from './research-supply.mjs';
import { chooseItem, planItem } from './growth-engine.mjs';
import { selectCommunityCopy } from './copy-engine.mjs';
import fs from 'node:fs/promises';
const now = new Date('2026-09-27T12:00:00Z');
const source = { url: 'https://www.korea.kr/news/policyNewsView.do?newsId=123', publishedAt: '2026-09-25T12:00:00Z', text: '어린이 도서관의 무료 대출 서비스는 참여 도서관에서만 이용할 수 있습니다. 이용자는 본인 명의 회원증으로 도서를 대출하고 반납할 수 있습니다. 회원증을 발급받으려면 해당 도서관의 회원 자격을 갖춰야 합니다.' };
const answer = { review: { ok: true }, model: 'fixture', draft: {
 title: '어린이 도서관 무료 대출, 참여 도서관 회원만 이용 가능', category: '어린이 교육', readerNeed: '아이 책 구매비 절약', editorialAngle: '대출 대상과 회원 자격 구분', shareRecipient: '아이 책을 사는 부모', expiresAt: null, actionableNow: true,
 facts: [{ text: '어린이 도서관 무료 대출은 참여 도서관에서 운영합니다.', evidence: '어린이 도서관의 무료 대출 서비스는 참여 도서관에서만 이용할 수 있습니다.' }, { text: '대출과 반납에는 본인 명의 회원증이 필요해요.', evidence: '이용자는 본인 명의 회원증으로 도서를 대출하고 반납할 수 있습니다.' }],
 conditions: [{ text: '회원증 발급은 해당 도서관의 회원 자격을 갖춘 사람에게만 가능합니다.', evidence: '회원증을 발급받으려면 해당 도서관의 회원 자격을 갖춰야 합니다.' }]
} };
const item = validateDraft(source, answer, now);
assert.ok(item);
assert.equal(articleUrl('https://evil.test/news/policyNewsView.do?newsId=123'), null);
assert.equal(articleUrl('/news/policyNewsView.do?newsId=123&pWise=x'), source.url);
assert.equal(validateDraft(source, {...answer, review:{ok:false}}, now), null);
const change = fn => { const x=structuredClone(answer);fn(x.draft);return x; };
assert.equal(validateDraft(source, change(d=>d.facts[0].evidence='원문에 없는 근거를 넣어 보겠습니다'), now), null);
assert.equal(validateDraft(source, change(d=>d.title+=' 5000원 환급'), now), null);
assert.equal(validateDraft(source, change(d=>d.expiresAt='2026-09-26'), now), null);
assert.equal(validateDraft(source, change(d=>d.facts[0].text='제가 직접 써봤는데 아주 좋았어요.'), now), null);
const html = `<meta property="og:title" content="무료 어린이 도서관 이용"><meta property="article:published_time" content="2020-01-01T00:00:00Z"><div class="view_cont"><p>${source.text}</p></div>`;
assert.equal(parseArticle(source.url, html, now), null, 'old articles are not fresh just because fetched today');
const config=JSON.parse(await fs.readFile(new URL('../growth-config.json',import.meta.url)));
item.editorialPlan=planItem(item,config,now);
assert.equal(item.editorialPlan.status,'eligible');
assert.equal(selectCommunityCopy(item).copyRejected,false);
assert.equal(chooseItem([item],[],[{sourceStore:'korea.kr'},{sourceStore:'korea.kr'}],config),item,'public publisher is not a merchant cap');
assert.equal(chooseItem([item],[],Array.from({length:3},()=>({topic:item.copyContext.category})),config),null,'same topic still capped');
console.log('research source, evidence, expiry, copy and diversity checks passed');
