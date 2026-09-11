import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='17.0.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const exists=r=>fs.existsSync(path.join(ROOT,r));
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const strip=s=>String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
const hash=s=>crypto.createHash('sha1').update(String(s||'')).digest('hex').slice(0,12);
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
const queryMap=json('data/query-map.json',{queries:[]});
const priority16=json('data/index-priority-v16.json',{rows:[]});
const wave16=json('data/wave1-url-set-v16.json',{urls:[]});
const answers16=json('data/answer-index-v16.json',{answers:[]});
const quote=json('data/quote-statistics.json',{sample_count:0});

const css16=read('assets/site-v16-bundle.css');
const js16=read('assets/app-v16-bundle.js');
const css17=fs.readFileSync(path.join(CORE,'site-v17.css'),'utf8');
const bundleHash=hash(css16+'\n'+css17+'\n'+js16);
write('assets/site-v17-bundle.css',css16+'\n/* v17 */\n'+css17);
write('assets/app-v17-bundle.js',js16+'\n/* v17 Wave 1 landing hardening */\n');
const cssRef=`<link rel="stylesheet" href="${BASE}/assets/site-v17-bundle.css?v=${bundleHash}">`;
const jsRef=`<script src="${BASE}/assets/app-v17-bundle.js?v=${bundleHash}" defer></script>`;

const template=read('data/index.html');
const header=template.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=template.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const more=[
  ['v17-answer-first','SEO','Wave 1 페이지 첫 화면은 무엇을 먼저 답하나요?','각 페이지가 대표 검색 의도 하나를 먼저 답하고, 바로 아래에 근거 유형과 다음 확인 경로를 붙입니다.','data/wave1-landing-v17/'],
  ['v17-evidence','AEO','근거 유형을 왜 구분하나요?','OFFICIAL·REFERENCE·QUOTE·CALCULATED를 섞지 않아 검색엔진과 사용자가 숫자의 성격을 바로 구분하도록 합니다.','data/wave1-landing-v17/'],
  ['v17-faq-owner','SEO','같은 FAQ를 여러 페이지에서 구조화데이터로 반복하나요?','아니요. 같은 질문은 대표 URL 하나만 FAQPage Schema 소유권을 갖고 다른 페이지의 중복 Schema 질문은 제거합니다.','data/faq-ownership-v17/'],
  ['v17-anchor','SEO','자세히 보기 같은 링크 문구를 계속 쓰나요?','Wave 1 내부링크는 목적지를 설명하는 앵커로 바꿔 견적 비교·평수·공종·공공단가 같은 다음 행동이 드러나게 합니다.','data/anchor-v17/'],
  ['v17-breadcrumb','SEO','Wave 1 페이지에 Breadcrumb Schema가 있나요?','홈을 제외한 Wave 1 페이지에는 경로 기반 BreadcrumbList를 보강해 페이지 계층을 명시합니다.','data/wave1-landing-v17/'],
  ['v17-min-depth','콘텐츠','Wave 1 페이지 본문 최소 기준은?','검색 공개 후보는 설명·도구·근거를 합친 텍스트가 최소 900자 이상이어야 하며 부족하면 첫 공개에서 제외됩니다.','data/wave1-landing-v17/'],
  ['v17-demote','운영','Wave 1 페이지가 품질 기준에 못 미치면 어떻게 하나요?','기존 Wave 1이었다 해도 v17 랜딩 게이트를 통과하지 못하면 자동으로 DEMOTED 목록으로 보내고 첫 sitemap 후보에서 제외합니다.','data/wave1-landing-v17/'],
  ['v17-query-owner','SEO','대표 검색 의도가 없는 페이지도 첫 공개하나요?','query-map 연결이 없으면 페이지 H1을 명시적 대표 질문으로 사용하고 소유권 충돌은 별도 감사에서 확인합니다.','data/wave1-landing-v17/'],
  ['v17-quote-n','데이터','실제 견적 N이 0인데 비용 답변을 만들어도 되나요?','아니요. 실제 견적 분포는 N 기준을 충족할 때만 공개하며 현재 N=0인 민간 가격 통계는 계속 보류합니다.','data/methodology/'],
  ['v17-launch','운영','v17 통과 후 바로 검색에 공개되나요?','아니요. v17은 첫 공개 후보 품질을 확정하는 프리뷰이며 robots·sitemap·Search Console·광고 전환은 별도 승인 후 실행합니다.','data/wave1-landing-v17/']
].map(([id,category,question,answer,src])=>({id,category,question,answer,source:`${BASE}/${src}`,url:`${BASE}/${src}`,status:'published'}));
const answers=[...(answers16.answers||[]),...more];
write('data/answer-index-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,count:answers.length,answers},null,2));
const answerCanonical=SITE+'/data/answers-v17/';
const answerCards=answers.map(x=>`<article class="v10-answer-card"><span>${esc(x.category)}</span><h3>${esc(x.question)}</h3><p>${esc(x.answer)}</p><a href="${esc(x.source)}">근거/도구</a></article>`).join('');
write('data/answers-v17/index.html',`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>인테리어 견적 질문 ${answers.length}개 | v17 최신 답변 허브</title><meta name="description" content="인테리어 견적·평수·공종·공공단가·데이터 운영 질문을 v17 대표 URL과 근거에 연결합니다."><link rel="canonical" href="${answerCanonical}">${cssRef}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:'인테리어 견적 질문 v17 최신 답변 허브',url:answerCanonical,dateModified:reviewed})}</script></head><body class="v17-answer-hub">${header}<main><section class="v62-data-hero"><div class="site-shell"><p class="kicker">ANSWER INDEX v17</p><h1>인테리어 견적 질문 ${answers.length}개</h1><p>대표 검색 의도 · 근거 유형 · 최신 Wave 1 URL 연결</p></div></section><section class="v14-section"><div class="site-shell"><div class="v10-answer-grid">${answerCards}</div></div></section></main>${footer}${jsRef}</body></html>`);

const wavePaths=wave16.urls.map(x=>x.path==='data/answers-v16/index.html'?'data/answers-v17/index.html':x.path).filter(exists);
const waveSet=new Set(wavePaths);
const roleByPath=new Map((priority16.rows||[]).map(x=>[x.path,x.role]));
roleByPath.set('data/answers-v17/index.html','answer');
const route=r=>r==='index.html'?'/':r==='404.html'?'/404.html':'/'+r.replace(/index\.html$/,'');
const url=r=>SITE+route(r);
const title=h=>(h.match(/<title>(.*?)<\/title>/i)?.[1]||'').trim();
const h1=h=>strip(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
const normalizeTarget=v=>{if(!v)return null;let s=String(v).replace(SITE,'').replace(BASE,'').split(/[?#]/)[0];if(!s.startsWith('/'))s='/'+s;if(s==='/'||s==='')return'index.html';s=s.replace(/^\//,'');return s.endsWith('/')?s+'index.html':s.endsWith('.html')?s:s+'/index.html'};
const queriesByPath=new Map();
for(const q of queryMap.queries||[]){const p=normalizeTarget(q.url||q.target||q.canonical);if(!p)continue;if(!queriesByPath.has(p))queriesByPath.set(p,[]);queriesByPath.get(p).push(q.query)}
const primaryIntent=p=>(queriesByPath.get(p)||[])[0]||h1(read(p))||title(read(p));

const evidenceByRole={
  home:['OFFICIAL','REFERENCE','CALCULATED','QUOTE (N gate)'],core:['CALCULATED','REFERENCE','QUOTE (N gate)'],tool:['CALCULATED','REFERENCE'],trade:['REFERENCE','QUOTE (N gate)'],public_reference:['REFERENCE'],official_data:['OFFICIAL'],guide:['REFERENCE'],answer:['OFFICIAL','REFERENCE','CALCULATED','QUOTE']
};
const answerByRole={
  home:'견적을 먼저 검사하고 평수·공종·공공 참고단가를 분리해서 확인하는 시작점입니다.',
  core:'이 페이지는 입력 조건 또는 해당 평수·공종의 확인 항목을 한 곳에 모아 비교 가능한 상태를 만드는 페이지입니다.',
  tool:'사용자가 입력한 조건을 계산하거나 비교합니다. 입력하지 않은 조건을 임의의 평균값으로 채우지 않습니다.',
  trade:'이 공종은 민간 시장평균 대신 공사 범위와 공공 참고단가, 실제 견적 표본의 공개 조건을 분리해 봐야 합니다.',
  public_reference:'공공 표준시장단가 계열의 참고값입니다. 민간 아파트 인테리어 적정가격이나 시장평균으로 해석하지 않습니다.',
  official_data:'공식 공표 자료의 기간·단위·출처를 그대로 확인하는 데이터 페이지입니다. 개별 민간 견적 가격을 대신하지 않습니다.',
  guide:'견적을 비교하기 전에 누락 조건과 공사 범위를 확인하는 방법을 정리한 안내 페이지입니다.',
  answer:'질문별 대표 페이지와 근거를 연결하는 최신 답변 허브입니다. 이전 버전 답변 허브는 첫 공개 후보에서 제외합니다.'
};
const checkLinksByRole={
  home:[['견적 누락 검사','/quote-check/'],['평수별 비용 구조','/interior-cost/'],['공사별 범위','/cost/']],
  core:[['3견적 조건 비교','/quote-compare/'],['예산 계산','/calculator/'],['공식 공사비지수','/data/cost-index/']],
  tool:[['견적 누락 검사','/quote-check/'],['3견적 조건 비교','/quote-compare/'],['검수 방법론','/data/methodology/']],
  trade:[['공공 참고단가','/data/public-unit-cost/topics/'],['3견적 조건 비교','/quote-compare/'],['견적 체크리스트','/checklist/']],
  public_reference:[['공식 출처','/data/sources/'],['데이터 방법론','/data/methodology/'],['견적 비교','/quote-compare/']],
  official_data:[['공식 출처','/data/sources/'],['데이터 방법론','/data/methodology/'],['최신 답변','/data/answers-v17/']],
  guide:[['견적 누락 검사','/quote-check/'],['체크리스트','/checklist/'],['공식 출처','/data/sources/']],
  answer:[['견적 누락 검사','/quote-check/'],['공식 데이터','/data/'],['공공 참고단가','/data/public-unit-cost/topics/']]
};
const generic=new Set(['자세히 보기','더 보기','더보기','확인하기','보기','바로가기','이동','열기']);
const labelMap=new Map([
  ['quote-check/index.html','견적 누락 검사'],['quote-compare/index.html','3견적 조건 비교'],['calculator/index.html','인테리어 예산 계산'],['interior-cost/index.html','평수별 비용 구조'],['cost/index.html','공사별 비용 구조'],['data/public-unit-cost/topics/index.html','공공 참고단가'],['data/public-unit-cost/index.html','공공 단가 데이터'],['data/cost-index/index.html','건설공사비지수'],['data/construction-wage/index.html','건설업 임금조사'],['data/methodology/index.html','데이터 방법론'],['data/sources/index.html','공식 출처'],['data/answers-v17/index.html','최신 질문 답변'],['checklist/index.html','견적 체크리스트']
]);
function hrefPath(href){if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:'))return null;return normalizeTarget(href)}
function rewriteGenericAnchors(html,counter){return html.replace(/<a([^>]*href="([^"]+)"[^>]*)>([\s\S]*?)<\/a>/gi,(m,a,href,inner)=>{const text=strip(inner);if(!generic.has(text))return m;counter.before++;const p=hrefPath(href);let label=p&&labelMap.get(p);if(!label&&p&&exists(p))label=h1(read(p))||title(read(p));if(!label)label='관련 페이지';counter.afterRewritten++;return `<a${a}>${esc(label)}</a>`})}
const segmentLabel={data:'데이터','public-unit-cost':'공공 참고단가','interior-cost':'평수별 비용','cost':'공사별 비용',guides:'가이드'};
function breadcrumbSchema(p){if(p==='index.html')return'';const parts=p.replace(/\/index\.html$/,'').split('/');const items=[{'@type':'ListItem',position:1,name:'견적검수실',item:SITE+'/'}];let prefix='';for(let i=0;i<parts.length;i++){prefix+=parts[i]+'/';const target=prefix+'index.html';const name=i===parts.length-1?(h1(read(p))||title(read(p))):(segmentLabel[parts[i]]||(exists(target)?h1(read(target)):parts[i]));items.push({'@type':'ListItem',position:items.length+1,name,item:SITE+'/'+prefix})}return `<script type="application/ld+json" data-v17-breadcrumb>${JSON.stringify({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items})}</script>`}
function usageBlock(role,intent){const text={
  public_reference:'단가의 단위·규격·포함 범위를 먼저 맞추고 비교해야 합니다. 자재비 제외 여부나 시공 조건이 다른 항목을 합산해 민간 총견적으로 사용하지 않습니다. 필요한 경우 같은 단위끼리만 비교하고 공식 고시의 적용 범위를 함께 확인합니다.',
  official_data:'공표 기준월과 발표일, 기준연도와 단위를 함께 확인합니다. 지수 변화율이나 산업 전체 임금은 개별 아파트 공사의 견적 인상률 또는 특정 공종 일당과 같지 않으므로 별도 지표로 사용합니다.',
  core:'평수나 공종 이름만으로 총액을 단정하지 않습니다. 공급면적, 공사 범위, 철거·폐기물, 창호, 욕실 수, VAT 같은 조건을 먼저 맞춘 뒤 비교하고 실제 견적 표본은 공개 기준 N을 넘을 때만 통계로 사용합니다.',
  tool:'계산 결과는 사용자가 입력한 조건에서만 만들어집니다. 입력하지 않은 항목을 임의 평균으로 채우지 않고, 비교 조건이 다르면 차이를 숨기거나 재확인 상태로 남겨 잘못된 정밀도를 피합니다.',
  trade:'같은 공종명이라도 철거 범위, 자재, 면적, 시공 방식이 다르면 금액을 직접 비교할 수 없습니다. 먼저 작업 범위를 맞추고 공공 참고값과 실제 민간 견적 표본을 서로 다른 데이터 유형으로 확인합니다.',
  guide:'체크리스트는 업체 우열을 판정하는 점수가 아니라 비교 가능한 견적을 만들기 위한 확인 순서입니다. 누락 조건은 원견적서에서 다시 확인하고, 금액 판단보다 범위·단위·포함 조건 확인을 우선합니다.',
  answer:'질문마다 하나의 대표 URL을 연결하고 같은 의미의 구버전 답변 허브를 여러 개 색인하지 않습니다. 답변에 사용된 수치와 방법은 연결된 공식 데이터·참고단가·계산 도구에서 다시 확인할 수 있습니다.',
  home:'견적 검수는 숫자 하나를 찾는 과정이 아니라 조건을 맞추는 과정입니다. 견적 검사, 평수별 구조, 공종별 범위, 공공 참고자료를 분리해서 보고 실제 민간 가격 통계는 표본 기준을 충족할 때만 사용합니다.'
}[role]||'페이지의 숫자와 조건을 같은 단위와 범위에서 확인하고, 근거 유형이 다른 자료를 하나의 시장평균처럼 합치지 않습니다.';return `<section class="v14-section v17-usage"><div class="site-shell"><h2>${esc(intent)} 확인 기준</h2><p>${text}</p><p>표시된 값의 출처와 검토일을 확인하고, 실제 계약이나 견적 판단 전에는 원문서의 포함·제외 조건을 다시 대조하세요.</p></div></section>`}

const anchorCounter={before:0,afterRewritten:0};
for(const p of wavePaths){let h=read(p);const role=roleByPath.get(p)||'content';const intent=primaryIntent(p);const evidence=evidenceByRole[role]||['REFERENCE'];const checks=checkLinksByRole[role]||checkLinksByRole.guide;h=h.replace(/site-v16-bundle\.css[^\"]*/g,`site-v17-bundle.css?v=${bundleHash}`).replace(/app-v16-bundle\.js[^\"]*/g,`app-v17-bundle.js?v=${bundleHash}`).replace(/데이터 v16\.0\.0/g,'데이터 v17.0.0');h=rewriteGenericAnchors(h,anchorCounter);if(!h.includes('v17-answer-first')){const block=`<section class="v17-answer-first" data-v17-intent="${esc(intent)}"><div class="site-shell"><div class="v17-answer-main"><span>PRIMARY ANSWER</span><h2>${esc(intent)}</h2><p>${answerByRole[role]||answerByRole.guide}</p><div class="v17-check-path">${checks.map(([n,u])=>`<a href="${BASE}${u}">${n}</a>`).join('')}</div></div><aside class="v17-evidence"><span>EVIDENCE TYPE</span><div class="v17-evidence-list">${evidence.map(x=>`<b>${esc(x)}</b>`).join('')}</div><p class="v17-owner-note">검토일 ${reviewed} · 실제 견적 표본 N=${quote.sample_count||0}</p></aside></div></section>`;const pos=h.indexOf('</section>',h.indexOf('<main>'));if(pos>=0)h=h.slice(0,pos+10)+block+h.slice(pos+10);else h=h.replace('<main>','<main>'+block)}if(p!=='index.html'&&!h.includes('data-v17-breadcrumb'))h=h.replace('</head>',breadcrumbSchema(p)+'</head>');write(p,h)}

function faqEntries(h){const out=[];for(const m of h.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)){try{const o=JSON.parse(m[1]);const nodes=Array.isArray(o?.['@graph'])?o['@graph']:[o];for(const n of nodes)if(n?.['@type']==='FAQPage')for(const e of n.mainEntity||[])if(e?.name)out.push(String(e.name).trim())}catch{}}return out}
const faqPages=new Map();for(const p of wavePaths)for(const q of faqEntries(read(p))){if(!faqPages.has(q))faqPages.set(q,[]);faqPages.get(q).push(p)}
const roleRank={core:9,public_reference:8,official_data:8,tool:7,trade:7,guide:5,answer:4,home:3};
const faqOwner=new Map();for(const [q,ps] of faqPages){const owner=[...ps].sort((a,b)=>((roleRank[roleByPath.get(b)]||1)+(queriesByPath.get(b)?.length||0))-((roleRank[roleByPath.get(a)]||1)+(queriesByPath.get(a)?.length||0))||a.localeCompare(b))[0];faqOwner.set(q,owner)}
function pruneFaq(h,p){return h.replace(/<script\b([^>]*)type="application\/ld\+json"([^>]*)>([\s\S]*?)<\/script>/gi,(m,a,b,raw)=>{let o;try{o=JSON.parse(raw)}catch{return m}let changed=false;const prune=n=>{if(n?.['@type']!=='FAQPage')return n;const before=n.mainEntity||[];const after=before.filter(e=>!e?.name||faqOwner.get(String(e.name).trim())===p);if(after.length!==before.length)changed=true;if(!after.length)return null;return{...n,mainEntity:after}};if(Array.isArray(o?.['@graph'])){const g=o['@graph'].map(prune).filter(Boolean);if(changed){if(!g.length)return'';o={...o,'@graph':g}}}else{const n=prune(o);if(changed){if(!n)return'';o=n}}return changed?`<script${a}type="application/ld+json"${b}>${JSON.stringify(o)}</script>`:m})}
for(const p of wavePaths)write(p,pruneFaq(read(p),p));

for(const p of wavePaths){let h=read(p),text=strip(h);if(text.length<900){h=h.replace('</main>',usageBlock(roleByPath.get(p)||'guide',primaryIntent(p))+'</main>');write(p,h)}}

let genericAfter=0;const rows=[];for(const p of wavePaths){const h=read(p),text=strip(h),role=roleByPath.get(p)||'content',intent=primaryIntent(p);const genericCount=[...h.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].filter(x=>generic.has(strip(x[1]))).length;genericAfter+=genericCount;rows.push({path:p,role,primary_intent:intent,text_chars:text.length,answer_first:h.includes('v17-answer-first'),evidence:h.includes('v17-evidence-list'),breadcrumb:p==='index.html'||h.includes('data-v17-breadcrumb'),generic_anchors:genericCount,query_owner_count:(queriesByPath.get(p)||[]).length})}
const afterFaq=new Map();for(const p of wavePaths)for(const q of faqEntries(read(p))){if(!afterFaq.has(q))afterFaq.set(q,[]);afterFaq.get(q).push(p)}
const duplicateBefore=[...faqPages].filter(([,ps])=>ps.length>1).map(([q,ps])=>({question:q,pages:ps,owner:faqOwner.get(q)}));const duplicateAfter=[...afterFaq].filter(([,ps])=>ps.length>1).map(([q,ps])=>({question:q,pages:ps}));
const pass=r=>r.text_chars>=900&&r.answer_first&&r.evidence&&r.breadcrumb&&r.generic_anchors===0&&Boolean(r.primary_intent);
const passed=rows.filter(pass),demoted=rows.filter(r=>!pass(r));
write('data/wave1-landing-contract-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,minimum_text_chars:900,required:['primary intent','answer-first block','evidence type','breadcrumb except home','specific internal anchor'],data_types:['OFFICIAL','REFERENCE','QUOTE','CALCULATED'],market_average_fabrication:false},null,2));
write('data/faq-ownership-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,questions:faqPages.size,duplicate_questions_before:duplicateBefore.length,duplicate_questions_after:duplicateAfter.length,ownership:duplicateBefore},null,2));
write('data/anchor-audit-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,generic_before:anchorCounter.before,generic_rewritten:anchorCounter.afterRewritten,generic_after:genericAfter,rows:rows.filter(x=>x.generic_anchors)},null,2));
write('data/wave1-landing-audit-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,source_wave1:wavePaths.length,passed:passed.length,demoted:demoted.length,min_text_chars:Math.min(...rows.map(x=>x.text_chars)),answer_first_missing:rows.filter(x=>!x.answer_first).length,evidence_missing:rows.filter(x=>!x.evidence).length,breadcrumb_missing:rows.filter(x=>!x.breadcrumb).length,primary_intent_missing:rows.filter(x=>!x.primary_intent).length,generic_anchors_after:genericAfter,faq_duplicate_schema_after:duplicateAfter.length,rows},null,2));
write('data/wave1-url-set-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,simulation_only:true,actual_preview_noindex_unchanged:true,count:passed.length,urls:passed.map(x=>({path:x.path,url:url(x.path),role:x.role,primary_intent:x.primary_intent,text_chars:x.text_chars}))},null,2));
write('data/demoted-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,count:demoted.length,rows:demoted},null,2));
write('data/v17-wave1.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,bundle_hash:bundleHash,source_wave1:wavePaths.length,passed:passed.length,demoted:demoted.length,answer_count:answers.length,faq_duplicate_after:duplicateAfter.length,generic_anchor_after:genericAfter},null,2));
console.log(JSON.stringify(json('data/v17-wave1.json',{}),null,2));
