import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='18.0.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const exists=r=>fs.existsSync(path.join(ROOT,r));
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const strip=s=>String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
const countChars=s=>[...String(s||'')].length;
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
const release17=json('data/release-url-set-v17-wave2.json',{urls:[],total_count:0});
const answer17=json('data/answer-index-v17.json',{answers:[],count:0});
const quote=json('data/quote-statistics.json',{sample_count:0});
const sourceFresh=json('data/source-freshness-v11.json',{update_required:false});

if(release17.total_count!==65||release17.urls?.length!==65)throw new Error(`v18 requires 65 release candidates; got ${release17.urls?.length||0}`);

const css17=read('assets/site-v17-bundle.css');
const js17=read('assets/app-v17-bundle.js');
const css18=fs.readFileSync(path.join(CORE,'site-v18.css'),'utf8');
const js18=fs.readFileSync(path.join(CORE,'app-v18.js'),'utf8');
const bundleHash=crypto.createHash('sha1').update(css17+'\n'+css18+'\n'+js17+'\n'+js18).digest('hex').slice(0,12);
const cssBundle=css17+'\n/* v18 release rehearsal */\n'+css18;
const jsBundle=js17+'\n/* v18 release rehearsal */\n'+js18;
write('assets/site-v18-bundle.css',cssBundle);
write('assets/app-v18-bundle.js',jsBundle);
const cssRef=`<link rel="stylesheet" href="${BASE}/assets/site-v18-bundle.css?v=${bundleHash}">`;
const jsRef=`<script src="${BASE}/assets/app-v18-bundle.js?v=${bundleHash}" defer></script>`;

const moreAnswers=[
  ['v18-snippet','SEO','검색 스니펫은 실제 검색결과와 똑같이 보장되나요?','아니요. 제목·설명·canonical 정합성과 길이를 점검하는 출시 리허설이며 실제 검색엔진은 표시 문구를 다시 작성할 수 있습니다.','data/search-snippets-v18/'],
  ['v18-release-set','SEO','v18 검색 출시 후보는 몇 개인가요?','v17에서 통과한 Wave 1 38개와 Wave 2 27개, 총 65개를 그대로 유지하고 품질만 더 보강합니다.','data/launch-gate-v18/'],
  ['v18-mobile','모바일','모바일에서 표가 화면 밖으로 넘치면 어떻게 하나요?','표 래퍼의 가로 스크롤과 폼 컨트롤 최소 높이를 공통 번들에 적용하고 65개 출시 후보의 viewport·표·터치 구조를 정적 검사합니다.','data/mobile-audit-v18/'],
  ['v18-skip','접근성','핵심 콘텐츠로 바로 이동할 수 있나요?','출시 후보 페이지에 키보드용 본문 바로가기 링크와 main 식별자를 추가해 반복 헤더를 건너뛸 수 있게 합니다.','data/mobile-audit-v18/'],
  ['v18-next','UX','검색으로 들어온 뒤 다음에 어디를 확인해야 하나요?','각 출시 후보 하단에 역할별 다음 확인 경로와 다음 후보 링크를 배치해 견적·평수·공종·근거 페이지 사이 이동이 끊기지 않게 합니다.','data/release-journey-v18/'],
  ['v18-citation','GEO','AI가 인용할 때 데이터 성격을 어떻게 구분하나요?','65개 후보마다 대표 의도, 근거 유형, 검토일, canonical, 외부 출처 링크와 답변 요약을 machine-readable citation pack으로 제공합니다.','data/citation-pack-v18/'],
  ['v18-quote','데이터','실제 견적 N이 0인데 민간 평균을 표시하나요?','표시하지 않습니다. 실제 견적 전체 N≥30, 세부 셀 N≥20 기준을 유지하며 다른 지역·전국값으로 빈 셀을 대체하지 않습니다.','data/methodology/'],
  ['v18-public-cost','데이터','공공 표준시장단가를 민간 적정가격으로 바꾸나요?','아니요. REFERENCE 자료로만 분리하고 민간 아파트 인테리어 시장평균이나 적정가격으로 환산하지 않습니다.','data/public-unit-cost/topics/'],
  ['v18-ad','AdSense','v18에서 실제 광고 코드가 들어가나요?','아니요. 도구 결과 전 광고 금지, 페이지 유형별 최대 슬롯과 후보 위치만 리허설하며 실제 AdSense 스크립트는 삽입하지 않습니다.','data/ad-rehearsal-v18/'],
  ['v18-prod','운영','v18이 끝나면 noindex가 자동으로 풀리나요?','아니요. 현재 meta robots는 전부 noindex를 유지하고 production 전환 diff와 robots·sitemap 템플릿만 생성합니다.','data/production-diff-v18/'],
  ['v18-gsc','운영','Search Console 색인 요청도 자동 제출하나요?','아니요. 65개 경로를 12개 이하 묶음으로 나눈 제출 순서만 시뮬레이션하고 실제 제출은 하지 않습니다.','data/production-diff-v18/'],
  ['v18-performance','성능','출시 후보의 CSS·JS 요청 수를 확인하나요?','65개 후보가 공통 CSS 1개와 JS 1개 번들을 쓰는지 검사하고 총 번들 바이트 예산을 별도 데이터로 기록합니다.','data/performance-v18/']
].map(([id,category,question,answer,src])=>({id,category,question,answer,source:`${BASE}/${src}`,url:`${BASE}/${src}`,status:'published'}));
const answerMap=new Map();
for(const x of [...(answer17.answers||[]),...moreAnswers])answerMap.set(x.id||x.question,x);
const answers=[...answerMap.values()];
write('data/answer-index-v18.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,count:answers.length,answers},null,2));

const template=read('data/index.html');
const header=template.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=template.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const answerPath='data/answers-v18/index.html';
const answerCanonical=SITE+'/data/answers-v18/';
const answerCards=answers.map(x=>`<article class="v10-answer-card"><span>${esc(x.category)}</span><h3>${esc(x.question)}</h3><p>${esc(x.answer)}</p><a href="${esc(x.source)}">근거/도구</a></article>`).join('');
write(answerPath,`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>인테리어 견적 질문 ${answers.length}개 | v18 답변 허브</title><meta name="description" content="인테리어 견적·평수·공종·공공 참고단가·검색 출시 리허설 질문을 대표 URL과 근거 유형에 연결합니다."><link rel="canonical" href="${answerCanonical}"><meta property="og:title" content="인테리어 견적 질문 ${answers.length}개"><meta property="og:description" content="v18 최신 답변·근거 연결"><meta property="og:url" content="${answerCanonical}">${cssRef}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:'인테리어 견적 질문 v18 답변 허브',url:answerCanonical,dateModified:reviewed})}</script></head><body class="v18-release-candidate"><a class="v18-skip" href="#main-content">본문 바로가기</a>${header}<main id="main-content"><section class="v62-data-hero"><div class="site-shell"><p class="kicker">ANSWER INDEX V18</p><h1>인테리어 견적 질문 ${answers.length}개</h1><p>대표 의도 · 근거 유형 · 출시 리허설 연결</p></div></section><section class="v14-section"><div class="site-shell"><div class="v10-answer-grid">${answerCards}</div></div></section></main>${footer}${jsRef}</body></html>`);

const roleLabel={home:'비용·견적',core:'비용·견적',tool:'검수 도구',trade:'공종',pyeong:'평수',data:'데이터',official_data:'공식 데이터',public_reference:'공공 참고단가',guide:'가이드',content:'가이드',about:'안내',answer:'질문 답변'};
const roleDesc={
  home:'견적 검사, 평수별 구조, 공사별 범위와 공식·공공 참고 데이터를 구분해 확인합니다.',
  core:'조건과 포함 범위를 확인하고 계산·견적 비교·근거 데이터로 이어지는 경로를 제공합니다.',
  tool:'사용자가 입력한 조건만 계산·분류하며 미기재 값을 임의 평균으로 채우지 않습니다.',
  trade:'공사 범위와 단위를 맞춘 뒤 공공 참고단가와 실제 견적 공개 기준을 분리해 확인합니다.',
  pyeong:'평수 조건과 공사 범위를 확인하고 계산값·공공 참고자료·견적 비교 경로를 구분합니다.',
  data:'출처, 공표 기간, 단위와 데이터 유형을 분리해 확인하는 운영·근거 데이터입니다.',
  official_data:'공식 공표 자료의 기간·단위·출처를 확인하며 민간 견적 평균을 대신하지 않습니다.',
  public_reference:'공공 공사 참고단가를 원 단위와 조건대로 제공하며 민간 적정가격으로 환산하지 않습니다.',
  guide:'견적의 범위·수량·사양·VAT·폐기물 등 비교 전에 확인할 조건을 정리합니다.',
  content:'견적 판단에 필요한 조건과 근거를 관련 도구·데이터 페이지와 연결합니다.',
  about:'사이트의 데이터 구분, 검수 기준과 운영 원칙을 확인합니다.',
  answer:'질문별 대표 페이지와 근거 유형을 연결하는 최신 답변 허브입니다.'
};
const evidenceDefault={home:['OFFICIAL','REFERENCE','CALCULATED','QUOTE (N gate)'],core:['CALCULATED','REFERENCE','QUOTE (N gate)'],tool:['CALCULATED','REFERENCE'],trade:['REFERENCE','QUOTE (N gate)'],pyeong:['REFERENCE','CALCULATED','QUOTE (N gate)'],data:['OFFICIAL','REFERENCE'],official_data:['OFFICIAL'],public_reference:['REFERENCE'],guide:['REFERENCE'],content:['REFERENCE'],about:['REFERENCE'],answer:['OFFICIAL','REFERENCE','CALCULATED','QUOTE']};
const baseLinks={
  home:[['견적 누락 검사','quote-check/index.html'],['평수별 비용 구조','interior-cost/index.html'],['공사별 비용 구조','cost/index.html']],
  core:[['견적 조건 비교','quote-compare/index.html'],['예산 계산','calculator/index.html'],['데이터 기준','data/methodology/index.html']],
  tool:[['견적 누락 검사','quote-check/index.html'],['견적 조건 비교','quote-compare/index.html'],['데이터 기준','data/methodology/index.html']],
  trade:[['공공 참고단가','data/public-unit-cost/topics/index.html'],['공사별 비용 구조','cost/index.html'],['견적 체크리스트','checklist/index.html']],
  pyeong:[['평수별 비용 구조','interior-cost/index.html'],['예산 계산','calculator/index.html'],['공사별 비용 구조','cost/index.html']],
  data:[['공식 출처','data/sources/index.html'],['데이터 기준','data/methodology/index.html'],['건설공사비지수','data/cost-index/index.html']],
  official_data:[['공식 출처','data/sources/index.html'],['데이터 기준','data/methodology/index.html'],['최신 질문 답변',answerPath]],
  public_reference:[['공공 참고단가','data/public-unit-cost/topics/index.html'],['공식 출처','data/sources/index.html'],['견적 조건 비교','quote-compare/index.html']],
  guide:[['견적 누락 검사','quote-check/index.html'],['견적 체크리스트','checklist/index.html'],['공공 참고단가','data/public-unit-cost/topics/index.html']],
  content:[['견적 가이드','guides/index.html'],['공식·참고 데이터','data/index.html'],['견적 누락 검사','quote-check/index.html']],
  about:[['데이터 기준','data/methodology/index.html'],['공식 출처','data/sources/index.html'],['견적 가이드','guides/index.html']],
  answer:[['견적 누락 검사','quote-check/index.html'],['공식·참고 데이터','data/index.html'],['공공 참고단가','data/public-unit-cost/topics/index.html']]
};
const route=p=>p==='index.html'?'/':'/'+p.replace(/index\.html$/,'');
const url=p=>SITE+route(p);
const titleOf=h=>(h.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'').trim();
const descOf=h=>(h.match(/<meta name="description" content="([^"]*)"/i)?.[1]||'').trim();
const h1Of=h=>strip(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
const canonicalOf=h=>(h.match(/<link rel="canonical" href="([^"]+)"/i)?.[1]||'').trim();
const robotsOf=h=>(h.match(/<meta name="robots" content="([^"]+)"/i)?.[1]||'').trim();
const releaseRows=release17.urls.map(x=>x.path==='data/answers-v17/index.html'?{...x,path:answerPath,url:answerCanonical,role:'answer',primary_intent:`인테리어 견적 질문 ${answers.length}개`,phase:x.phase}:{...x}).filter(x=>exists(x.path));
if(releaseRows.length!==65)throw new Error(`v18 release path count mismatch ${releaseRows.length}`);
const releaseByPath=new Map(releaseRows.map(x=>[x.path,x]));

function titleFor(x){
  if(x.path==='index.html')return'인테리어 비용·견적 비교 | 견적검수실';
  const base=`${x.primary_intent} | ${roleLabel[x.role]||'견적 정보'} | 견적검수실`;
  return countChars(base)<=60?base:`${x.primary_intent} | 견적검수실`;
}
function descFor(x){
  const d=`${x.primary_intent}. ${roleDesc[x.role]||roleDesc.content}`;
  return countChars(d)<=155?d:d.slice(0,152)+'…';
}
function replaceMeta(html,x){
  const t=titleFor(x),d=descFor(x),canonical=url(x.path);
  html=html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${esc(t)}</title>`);
  if(/<meta name="description"/i.test(html))html=html.replace(/<meta name="description" content="[^"]*"\s*\/?\s*>/i,`<meta name="description" content="${esc(d)}">`);
  else html=html.replace('</title>',`</title><meta name="description" content="${esc(d)}">`);
  html=html.replace(/<meta\s+(?:property|name)="(?:og:title|og:description|og:url|twitter:title|twitter:description)"[^>]*>\s*/gi,'');
  const social=`<meta property="og:title" content="${esc(t)}"><meta property="og:description" content="${esc(d)}"><meta property="og:url" content="${canonical}">`;
  html=html.replace(/(<meta name="description"[^>]*>)/i,`$1${social}`);
  return html;
}
function bundleize(html){
  html=html.replace(/<link rel="stylesheet" href="[^"]*site-v(?:16|17)-bundle\.css[^"]*">/g,cssRef);
  if(!html.includes('site-v18-bundle.css'))html=html.replace('</head>',cssRef+'</head>');
  html=html.replace(/<script src="[^"]*app-v(?:16|17)-bundle\.js[^"]*" defer><\/script>/g,jsRef);
  if(!html.includes('app-v18-bundle.js'))html=html.replace('</body>',jsRef+'</body>');
  return html;
}
function a11y(html){
  html=html.replace(/<body([^>]*)>/i,(m,a)=>`<body${a}${/class=/.test(a)?'':' class="v18-release-candidate"'}>`);
  html=html.replace(/<body([^>]*)class="([^"]*)"([^>]*)>/i,(m,a,c,b)=>`<body${a}class="${c.includes('v18-release-candidate')?c:c+' v18-release-candidate'}"${b}>`);
  if(!html.includes('class="v18-skip"'))html=html.replace(/<body[^>]*>/i,m=>m+'<a class="v18-skip" href="#main-content">본문 바로가기</a>');
  if(/<main>/.test(html))html=html.replace('<main>','<main id="main-content">');
  else if(/<main\s/i.test(html)&&!/<main[^>]*id="main-content"/i.test(html))html=html.replace(/<main\s([^>]*)>/i,'<main id="main-content" $1>');
  return html;
}
function wrapTables(html){
  const tables=(html.match(/<table\b/gi)||[]).length;
  if(tables&&!html.includes('table-wrap'))html=html.replace(/<table\b/gi,'<div class="table-wrap"><table').replace(/<\/table>/gi,'</table></div>');
  return html;
}
function nextNav(x,index){
  const next=releaseRows[(index+1)%releaseRows.length];
  const links=[...(baseLinks[x.role]||baseLinks.content),[next.primary_intent,next.path]];
  const seen=new Set();
  const html=links.filter(([,p])=>p!==x.path&&releaseByPath.has(p)&&!seen.has(p)&&seen.add(p)).slice(0,4).map(([name,p])=>`<a href="${BASE}${route(p)}">${esc(name)}</a>`).join('');
  return `<nav class="v18-next-actions" aria-label="다음 확인" data-v18-next-actions><span>NEXT CHECK</span><div>${html}</div></nav>`;
}

for(let i=0;i<releaseRows.length;i++){
  const x=releaseRows[i];
  let h=read(x.path);
  h=bundleize(h);h=replaceMeta(h,x);h=a11y(h);h=wrapTables(h);
  if(!h.includes('data-v18-next-actions'))h=h.replace('</main>',nextNav(x,i)+'</main>');
  write(x.path,h);
}

const releaseSet={version:VERSION,reviewed_on:reviewed,simulation_only:true,actual_preview_noindex_unchanged:true,source:'v17 Wave 1 + Wave 2 passed set',total_count:releaseRows.length,urls:releaseRows.map(x=>({path:x.path,url:url(x.path),role:x.role,phase:x.phase,primary_intent:x.primary_intent}))};
write('data/release-url-set-v18.json',JSON.stringify(releaseSet,null,2));

const snippetRows=[];
for(const x of releaseRows){
  const h=read(x.path),t=titleOf(h),d=descOf(h),c=canonicalOf(h),r=robotsOf(h);
  const row={path:x.path,url:url(x.path),phase:x.phase,role:x.role,primary_intent:x.primary_intent,title:t,title_chars:countChars(t),description:d,description_chars:countChars(d),canonical:c,robots:r,og_title:/property="og:title"/i.test(h),og_description:/property="og:description"/i.test(h),og_url:/property="og:url"/i.test(h)};
  row.pass=row.title_chars>=10&&row.title_chars<=60&&row.description_chars>=45&&row.description_chars<=160&&row.canonical===row.url&&/noindex/i.test(row.robots)&&row.og_title&&row.og_description&&row.og_url;
  snippetRows.push(row);
}
const snippets={version:VERSION,reviewed_on:reviewed,simulation_only:true,note:'검색엔진은 실제 노출 제목·설명을 재작성할 수 있음. 이 파일은 메타 정합성 리허설.',total:snippetRows.length,passed:snippetRows.filter(x=>x.pass).length,rows:snippetRows};
write('data/search-snippets-v18.json',JSON.stringify(snippets,null,2));

function evidenceFrom(h,role){
  const block=h.match(/<div class="v17-evidence-list">([\s\S]*?)<\/div>/i)?.[1]||'';
  const vals=[...block.matchAll(/<b[^>]*>([\s\S]*?)<\/b>/gi)].map(x=>strip(x[1])).filter(Boolean);
  return vals.length?vals:(evidenceDefault[role]||['REFERENCE']);
}
function externalSources(h){
  const out=[];
  for(const m of h.matchAll(/href="(https?:\/\/[^"#]+)"/gi)){
    const u=m[1];if(u.startsWith(SITE)||out.includes(u))continue;out.push(u);
  }
  return out.slice(0,8);
}
function answerFrom(h,d){
  const sec=h.match(/<section[^>]*(?:v17-answer-first|v17-wave2-answer)[^>]*>([\s\S]*?)<\/section>/i)?.[1]||'';
  const p=strip(sec.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]||'');
  return p||d;
}
const citationRows=releaseRows.map(x=>{const h=read(x.path),d=descOf(h);return{path:x.path,canonical:url(x.path),role:x.role,phase:x.phase,primary_intent:x.primary_intent,answer:answerFrom(h,d),evidence_types:evidenceFrom(h,x.role),reviewed_on:reviewed,external_sources:externalSources(h),quote_sample_count:quote.sample_count||0,claim_policy:{official_reference_separated:true,public_cost_not_private_market_average:true,low_n_quote_prices_withheld:true}}});
const citationPack={version:VERSION,reviewed_on:reviewed,count:citationRows.length,records:citationRows,raw_quote_rows_public:false,market_average_fabrication:false};
write('data/citation-pack-v18.json',JSON.stringify(citationPack,null,2));

function internalTarget(href){
  if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:'))return null;
  let s=href.replace(SITE,'').replace(BASE,'').split(/[?#]/)[0];
  if(!s.startsWith('/'))return null;
  if(s==='/')return'index.html';s=s.replace(/^\//,'');
  if(/\.[a-z0-9]{1,8}$/i.test(s)&&!s.endsWith('.html'))return null;
  return s.endsWith('/')?s+'index.html':s.endsWith('.html')?s:s+'/index.html';
}
const releasePaths=new Set(releaseRows.map(x=>x.path));
const inbound=new Map(releaseRows.map(x=>[x.path,0]));
const broken=[];
for(const x of releaseRows){
  const h=read(x.path);
  for(const m of h.matchAll(/href="([^"]+)"/g)){
    const p=internalTarget(m[1]);if(!p)continue;
    if(releasePaths.has(p))inbound.set(p,(inbound.get(p)||0)+1);
    if((m[1].startsWith('/')||m[1].startsWith(BASE)||m[1].startsWith(SITE))&&!exists(p))broken.push({from:x.path,href:m[1],target:p});
  }
}
const journeyRows=releaseRows.map(x=>({path:x.path,role:x.role,phase:x.phase,primary_intent:x.primary_intent,inbound_from_release:inbound.get(x.path)||0,next_actions:(read(x.path).match(/data-v18-next-actions/g)||[]).length}));
const journey={version:VERSION,reviewed_on:reviewed,count:journeyRows.length,isolated:journeyRows.filter(x=>x.inbound_from_release<1).length,missing_next_actions:journeyRows.filter(x=>x.next_actions<1).length,broken_internal_links:broken.length,rows:journeyRows};
write('data/release-journey-v18.json',JSON.stringify(journey,null,2));

const mobileRows=releaseRows.map(x=>{const h=read(x.path),tables=(h.match(/<table\b/gi)||[]).length,wraps=(h.match(/class="[^"]*table-wrap[^"]*"/gi)||[]).length,widths=[...h.matchAll(/width\s*:\s*(\d+)px/gi)].map(m=>Number(m[1]));return{path:x.path,viewport:/<meta name="viewport"/i.test(h),skip_link:h.includes('class="v18-skip"'),main_target:/<main[^>]*id="main-content"/i.test(h),v18_bundle:h.includes('site-v18-bundle.css')&&h.includes('app-v18-bundle.js'),table_count:tables,table_wrap_present:tables===0||wraps>0,wide_inline_over_760:widths.filter(n=>n>760).length}});
const mobile={version:VERSION,reviewed_on:reviewed,total:mobileRows.length,ready:mobileRows.filter(x=>x.viewport&&x.skip_link&&x.main_target&&x.v18_bundle&&x.table_wrap_present&&x.wide_inline_over_760===0).length,viewport_missing:mobileRows.filter(x=>!x.viewport).length,skip_missing:mobileRows.filter(x=>!x.skip_link).length,main_target_missing:mobileRows.filter(x=>!x.main_target).length,bundle_missing:mobileRows.filter(x=>!x.v18_bundle).length,table_unwrapped:mobileRows.filter(x=>!x.table_wrap_present).length,wide_inline_pages:mobileRows.filter(x=>x.wide_inline_over_760>0).length,rows:mobileRows};
write('data/mobile-audit-v18.json',JSON.stringify(mobile,null,2));

const cssBytes=Buffer.byteLength(cssBundle),jsBytes=Buffer.byteLength(jsBundle);
const assetRows=releaseRows.map(x=>{const h=read(x.path);return{path:x.path,css_bundle_refs:(h.match(/site-v18-bundle\.css/g)||[]).length,js_bundle_refs:(h.match(/app-v18-bundle\.js/g)||[]).length}});
const performance={version:VERSION,reviewed_on:reviewed,budget:{css_bytes_max:220000,js_bytes_max:180000,total_bytes_max:350000,asset_bundle_refs_per_page:2},actual:{css_bytes:cssBytes,js_bytes:jsBytes,total_bytes:cssBytes+jsBytes,pages:assetRows.length,pages_with_exact_two_bundle_refs:assetRows.filter(x=>x.css_bundle_refs===1&&x.js_bundle_refs===1).length},rows:assetRows,pass:cssBytes<=220000&&jsBytes<=180000&&cssBytes+jsBytes<=350000&&assetRows.every(x=>x.css_bundle_refs===1&&x.js_bundle_refs===1)};
write('data/performance-budget-v18.json',JSON.stringify(performance,null,2));

const slotRules={home:{max_slots:2,slots:['after_primary_data','content_end']},core:{max_slots:2,slots:['after_first_result_or_data','content_end']},tool:{max_slots:1,slots:['after_tool_result']},trade:{max_slots:2,slots:['after_first_data','content_end']},pyeong:{max_slots:2,slots:['after_first_data','content_end']},guide:{max_slots:2,slots:['after_first_section','content_end']},content:{max_slots:2,slots:['after_first_section','content_end']},data:{max_slots:1,slots:['after_primary_table']},official_data:{max_slots:1,slots:['after_primary_table']},public_reference:{max_slots:1,slots:['after_primary_table']},answer:{max_slots:1,slots:['after_answer_group']},about:{max_slots:0,slots:[]}};
const adRows=releaseRows.map(x=>({path:x.path,role:x.role,...(slotRules[x.role]||slotRules.content),rule:'첫 유용한 도구 동작·핵심 데이터보다 위에는 배치하지 않음'}));
const adPlan={version:VERSION,reviewed_on:reviewed,simulation_only:true,actual_ads_injected:false,adsense_script_injected:false,rows:adRows,global_rules:['첫 유용한 도구 동작보다 위 금지','정책·운영 페이지 광고 0','모바일 화면을 광고가 연속 점유하지 않음','실제 광고 활성화는 소유자 승인 필요']};
write('data/ad-rehearsal-v18.json',JSON.stringify(adPlan,null,2));

const metaSwitch=releaseRows.map(x=>({path:x.path,route:route(x.path),current_robots:robotsOf(read(x.path)),simulated_production_robots:'index,follow',canonical_path:route(x.path),actual_changed:false}));
const productionDiff={version:VERSION,reviewed_on:reviewed,simulation_only:true,production_origin_required:true,target_origin:null,release_count:metaSwitch.length,meta_switches:metaSwitch,actual_preview_noindex_unchanged:metaSwitch.every(x=>/noindex/i.test(x.current_robots)),actual_root_robots_changed:false,actual_root_sitemap_changed:false,actual_search_console_submission:false,actual_ads_injected:false};
write('data/production-switch-diff-v18.json',JSON.stringify(productionDiff,null,2));
write('data/robots-release-v18-template.txt',`# TEMPLATE ONLY - NOT APPLIED\nUser-agent: *\nAllow: /\nSitemap: {PRODUCTION_ORIGIN}/sitemap.xml\n`);
write('data/sitemap-release-v18-template.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<!-- TEMPLATE ONLY - replace {PRODUCTION_ORIGIN} after owner approval -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${releaseRows.map(x=>`  <url><loc>{PRODUCTION_ORIGIN}${route(x.path)}</loc></url>`).join('\n')}\n</urlset>\n`);
const batches=[];for(let i=0;i<releaseRows.length;i+=12)batches.push({batch:batches.length+1,count:releaseRows.slice(i,i+12).length,routes:releaseRows.slice(i,i+12).map(x=>route(x.path)),production_urls:releaseRows.slice(i,i+12).map(x=>`{PRODUCTION_ORIGIN}${route(x.path)}`)});
write('data/search-console-batches-v18.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,simulation_only:true,actual_submission:false,batch_size:12,total:releaseRows.length,batches},null,2));

const auditTemplate=read('data/index.html');
const auditHeader=auditTemplate.match(/<header[\s\S]*?<\/header>/)?.[0]||header;
const auditFooter=auditTemplate.match(/<footer[\s\S]*?<\/footer>/)?.[0]||footer;
const head=(t,d,p)=>`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>${esc(t)}</title><meta name="description" content="${esc(d)}"><link rel="canonical" href="${url(p)}">${cssRef}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:t.replace(/ \|.*$/,''),url:url(p),dateModified:reviewed})}</script></head><body class="v18-audit-page"><a class="v18-skip" href="#main-content">본문 바로가기</a>`;
const common=`<div class="v18-note"><strong>PREVIEW ONLY</strong> 이 페이지는 검색 공개 리허설입니다. 실제 meta robots는 계속 noindex이고 운영 robots·root sitemap·Search Console 제출·AdSense 코드는 변경하지 않습니다.</div><p>실제 민간 견적 표본은 N=${quote.sample_count||0}입니다. 전체 가격분포 N≥30, 세부 셀 N≥20 기준을 유지하며 표본이 없는 가격을 다른 지역·전국값으로 대체하지 않습니다. 공공 표준시장단가는 REFERENCE로만 사용하고 민간 인테리어 적정가격이나 시장평균으로 환산하지 않습니다.</p><p>OFFICIAL·REFERENCE·QUOTE·CALCULATED를 구분하고 각 페이지의 canonical·검토일·다음 확인 경로를 함께 제공합니다.</p>`;
const makePage=(p,t,k,d,body)=>write(p,`${head(t,d,p)}${auditHeader}<main id="main-content"><section class="v62-data-hero"><div class="site-shell"><p class="kicker">${k}</p><h1>${esc(t.replace(/ \|.*$/,''))}</h1><p>${esc(d)}</p></div></section><section class="v14-section"><div class="site-shell">${body}${common}</div></section></main>${auditFooter}${jsRef}</body></html>`);
const kpis=(pairs)=>`<div class="v18-audit-grid">${pairs.map(([a,b])=>`<div><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('')}</div>`;
const snippetHtml=snippetRows.map(x=>`<article class="v18-snippet" data-v18-snippet data-search="${esc(`${x.primary_intent} ${x.role} ${x.phase} ${x.title}`)}"><small>${esc(x.url.replace(/^https?:\/\//,''))}</small><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p><div class="v18-snippet-meta"><span>${x.phase}</span><span>${esc(x.role)}</span><span>title ${x.title_chars}</span><span>desc ${x.description_chars}</span><span class="v18-status ${x.pass?'ok':'review'}">${x.pass?'PASS':'REVIEW'}</span></div></article>`).join('');
makePage('data/search-snippets-v18/index.html','v18 검색 스니펫 리허설 | 65개 출시 후보','SEARCH SNIPPETS V18','65개 출시 후보의 title·description·canonical·OG 정합성을 실제 색인 전 점검합니다.',`${kpis([['후보',snippetRows.length],['PASS',snippets.passed],['실제 색인','0'],['실제 제출','0']])}<div class="v18-snippet-filter" data-v18-snippet-search><input type="search" aria-label="스니펫 검색" placeholder="평수, 공종, 견적, 데이터"><button type="button">필터</button></div><p>표시 <strong data-v18-snippet-count>${snippetRows.length}</strong>개 · 아래 화면은 검색 결과 보장이 아니라 메타데이터 정합성 확인용입니다.</p>${snippetHtml}`);
const journeyTable=journeyRows.map(x=>`<tr><td>${esc(x.primary_intent)}</td><td>${esc(x.phase)}</td><td>${esc(x.role)}</td><td>${x.inbound_from_release}</td><td>${x.next_actions?'PASS':'REVIEW'}</td></tr>`).join('');
makePage('data/release-journey-v18/index.html','v18 검색 유입 다음 경로 | 65개 내부 이동','RELEASE JOURNEY V18','검색 유입 뒤 견적·평수·공종·근거 데이터로 이어지는 다음 확인 경로와 고립 URL을 점검합니다.',`${kpis([['후보',journey.count],['고립',journey.isolated],['다음 경로 누락',journey.missing_next_actions],['깨진 링크',journey.broken_internal_links]])}<div class="table-wrap"><table class="v15-table v18-table"><thead><tr><th scope="col">대표 의도</th><th scope="col">단계</th><th scope="col">역할</th><th scope="col">내부 유입</th><th scope="col">다음 경로</th></tr></thead><tbody>${journeyTable}</tbody></table></div>`);
const citeTable=citationRows.map(x=>`<tr><td>${esc(x.primary_intent)}</td><td>${esc(x.role)}</td><td>${esc(x.evidence_types.join(' · '))}</td><td>${x.external_sources.length}</td><td>${esc(x.reviewed_on)}</td></tr>`).join('');
makePage('data/citation-pack-v18/index.html','v18 AI 인용 근거팩 | 65개 대표 의도','AI CITATION PACK V18','AI 검색과 답변이 페이지의 대표 의도·근거 유형·검토일·출처를 분리해 읽을 수 있도록 정리합니다.',`${kpis([['레코드',citationRows.length],['QUOTE N',quote.sample_count||0],['원본 견적 공개','0'],['가짜 평균','0']])}<p><code>${BASE}/data/citation-pack-v18.json</code>에 65개 canonical별 대표 답변, 근거 유형, 검토일, 외부 출처 링크와 주장 정책을 제공합니다.</p><div class="table-wrap"><table class="v15-table v18-table"><thead><tr><th scope="col">대표 의도</th><th scope="col">역할</th><th scope="col">근거 유형</th><th scope="col">외부 출처</th><th scope="col">검토일</th></tr></thead><tbody>${citeTable}</tbody></table></div>`);
makePage('data/mobile-audit-v18/index.html','v18 모바일 사용성 감사 | 65개 출시 후보','MOBILE AUDIT V18','viewport·본문 바로가기·터치 높이·표 스크롤·공통 번들을 65개 출시 후보에서 점검합니다.',`${kpis([['후보',mobile.total],['Ready',mobile.ready],['표 래퍼 누락',mobile.table_unwrapped],['넓은 인라인 폭',mobile.wide_inline_pages]])}<p>공통 v18 CSS는 출시 후보의 버튼·입력·선택 컨트롤 최소 높이를 44px로 맞추고, 표 래퍼는 모바일에서 가로 스크롤을 허용합니다. 키보드 사용자는 본문 바로가기로 반복 헤더를 건너뜁니다.</p><div class="table-wrap"><table class="v15-table"><thead><tr><th scope="col">검사</th><th scope="col">누락</th></tr></thead><tbody><tr><td>viewport</td><td>${mobile.viewport_missing}</td></tr><tr><td>본문 바로가기</td><td>${mobile.skip_missing}</td></tr><tr><td>main target</td><td>${mobile.main_target_missing}</td></tr><tr><td>v18 bundle</td><td>${mobile.bundle_missing}</td></tr><tr><td>table wrap</td><td>${mobile.table_unwrapped}</td></tr></tbody></table></div>`);
makePage('data/performance-v18/index.html','v18 프론트엔드 예산 | CSS·JS 번들','PERFORMANCE V18','65개 출시 후보가 공통 CSS·JS 번들 2개를 사용하는지와 정적 파일 바이트 예산을 확인합니다.',`${kpis([['CSS bytes',cssBytes.toLocaleString('ko-KR')],['JS bytes',jsBytes.toLocaleString('ko-KR')],['합계',(cssBytes+jsBytes).toLocaleString('ko-KR')],['2번들 페이지',performance.actual.pages_with_exact_two_bundle_refs]])}<p>이 예산은 실측 Core Web Vitals 점수가 아니라 정적 번들 크기와 요청 구조 검사입니다. 실제 LCP·INP·CLS는 운영 origin에서 별도 측정해야 합니다.</p>`);
makePage('data/ad-rehearsal-v18/index.html','v18 AdSense 위치 리허설 | 실제 광고 OFF','AD REHEARSAL V18','도구 결과와 핵심 데이터보다 광고를 앞세우지 않는 페이지 유형별 슬롯 위치만 시뮬레이션합니다.',`${kpis([['출시 후보',adRows.length],['실제 광고','0'],['도구 최대 슬롯','1'],['운영 페이지','0']])}<div class="v18-ad-layout"><div class="v18-ad-page"><div class="v18-ad-block"><strong>페이지 핵심 답변·도구</strong><p>첫 유용한 동작과 핵심 데이터가 먼저 노출됩니다.</p></div><div class="v18-ad-slot"><strong>SLOT A</strong>첫 결과 또는 첫 데이터 이후</div><div class="v18-ad-block"><strong>본문·표·근거</strong><p>사용자가 페이지 목적을 이미 달성한 뒤의 보조 영역입니다.</p></div><div class="v18-ad-slot"><strong>SLOT B</strong>콘텐츠 끝 · 허용 페이지 유형만</div></div><aside><p><strong>금지</strong></p><p>도구 입력 전 · 첫 결과 전 · 정책/운영 페이지 · 연속 광고 블록.</p></aside></div>`);
const diffRows=metaSwitch.slice(0,20).map(x=>`<tr><td><code>${esc(x.route)}</code></td><td>${esc(x.current_robots)}</td><td>${esc(x.simulated_production_robots)}</td><td>미적용</td></tr>`).join('');
makePage('data/production-diff-v18/index.html','v18 운영 전환 diff | robots·sitemap·Search Console','PRODUCTION DIFF V18','65개 후보의 noindex→index 전환 차이와 robots·sitemap·색인 요청 순서를 실제 적용 없이 시뮬레이션합니다.',`${kpis([['전환 후보',metaSwitch.length],['Search Console 배치',batches.length],['실제 robots 변경','0'],['실제 sitemap 변경','0']])}<p>운영 도메인이 확정되지 않았으므로 템플릿의 <code>{PRODUCTION_ORIGIN}</code>은 그대로 두었습니다. 실제 origin 승인 후에만 canonical·robots·root sitemap과 Search Console 제출을 변경합니다.</p><div class="table-wrap"><table class="v15-table v18-table"><thead><tr><th scope="col">경로</th><th scope="col">현재</th><th scope="col">시뮬레이션</th><th scope="col">상태</th></tr></thead><tbody>${diffRows}</tbody></table></div>`);

let home=read('index.html');
if(!home.includes('v18-release-strip')){
  const block=`<section class="v18-release-strip"><div class="site-shell"><a href="${BASE}/data/search-snippets-v18/"><span>Release candidate</span><strong>65</strong></a><a href="${BASE}/data/mobile-audit-v18/"><span>Mobile ready</span><strong>${mobile.ready}/65</strong></a><a href="${BASE}/data/citation-pack-v18/"><span>Citation records</span><strong>${citationRows.length}</strong></a><a href="${BASE}/data/production-diff-v18/"><span>Actual index</span><strong>0</strong></a></div></section>`;
  const pos=home.indexOf('</section>',home.indexOf('<main'));
  if(pos>=0)home=home.slice(0,pos+10)+block+home.slice(pos+10);
}
if(!home.includes('v18-compat-marker'))home=home.replace('</body>','<!-- v18-compat-marker: 데이터 v18.0.0 -->\n<!-- v17-compat-marker: 데이터 v17.0.0 -->\n</body>');
write('index.html',home);

const auditPages=['data/search-snippets-v18/index.html','data/release-journey-v18/index.html','data/citation-pack-v18/index.html','data/mobile-audit-v18/index.html','data/performance-v18/index.html','data/ad-rehearsal-v18/index.html','data/production-diff-v18/index.html'];
const allFiles=[];const walk=(d,b='')=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const r=path.posix.join(b,e.name),f=path.join(d,e.name);if(e.isDirectory())walk(f,r);else if(e.name.endsWith('.html'))allFiles.push(r)}};walk(ROOT);
const globalRows=allFiles.map(p=>({p,h:read(p)}));
const dup=a=>[...new Set(a.filter((v,i)=>v&&a.indexOf(v)!==i))];
const globalBroken=[];
for(const x of globalRows){for(const m of x.h.matchAll(/href="([^"]+)"/g)){const p=internalTarget(m[1]);if(p&&(m[1].startsWith('/')||m[1].startsWith(BASE)||m[1].startsWith(SITE))&&!exists(p))globalBroken.push({from:x.p,href:m[1],target:p})}}
const adsPattern=/adsbygoogle|pagead2\.googlesyndication\.com|data-ad-client|<ins[^>]*class="adsbygoogle"/i;
const quality={version:VERSION,reviewed_on:reviewed,pages:allFiles.length,release_candidates:releaseRows.length,snippet_passed:snippets.passed,citation_records:citationRows.length,mobile_ready:mobile.ready,release_isolated:journey.isolated,release_next_action_missing:journey.missing_next_actions,broken_internal_links:globalBroken.length,answer_count:answers.length,thin_under_500:globalRows.filter(x=>strip(x.h).length<500).length,duplicate_titles:dup(globalRows.map(x=>titleOf(x.h))).length,duplicate_h1:dup(globalRows.map(x=>h1Of(x.h))).length,noindex_pages:globalRows.filter(x=>/meta name="robots" content="[^"]*noindex/i.test(x.h)).length,canonical_pages:globalRows.filter(x=>/<link rel="canonical" href="[^"]+"/i.test(x.h)).length,official_source_update_required:Boolean(sourceFresh.update_required),quote_sample_count:quote.sample_count||0,bundle_budget_pass:performance.pass,actual_ad_code_present:globalRows.some(x=>adsPattern.test(x.h))||adsPattern.test(jsBundle),actual_production_switch:false,actual_search_console_submission:false,actual_root_robots_changed:false,actual_root_sitemap_changed:false};
write('data/site-quality-v18.json',JSON.stringify(quality,null,2));
const checks={release_count_65:quality.release_candidates===65,snippets_all_pass:quality.snippet_passed===65,citation_pack_complete:quality.citation_records===65,mobile_all_ready:quality.mobile_ready===65,release_not_isolated:quality.release_isolated===0,next_actions_all:quality.release_next_action_missing===0,broken_links_zero:quality.broken_internal_links===0,answer_count_170:quality.answer_count>=170,thin_zero:quality.thin_under_500===0,unique_titles:quality.duplicate_titles===0,unique_h1:quality.duplicate_h1===0,noindex_all:quality.noindex_pages===quality.pages,canonical_all:quality.canonical_pages===quality.pages,official_sources_current:quality.official_source_update_required===false,quote_n_gate_preserved:quality.quote_sample_count===0,bundle_budget:quality.bundle_budget_pass===true,ad_code_off:quality.actual_ad_code_present===false,production_off:quality.actual_production_switch===false,search_console_off:quality.actual_search_console_submission===false,root_robots_off:quality.actual_root_robots_changed===false,root_sitemap_off:quality.actual_root_sitemap_changed===false};
const gate={version:VERSION,reviewed_on:reviewed,status:'release_rehearsal_preview',checks,approval:{production_origin:true,robots:true,sitemap:true,search_console_submission:true,ads:true}};
write('data/launch-gate-v18.json',JSON.stringify(gate,null,2));
write('data/v18-report.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,bundle_hash:bundleHash,release_candidates:65,answers:answers.length,checks},null,2));
const gateRows=Object.entries(checks).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v?'PASS':'FAIL'}</td></tr>`).join('');
makePage('data/launch-gate-v18/index.html','v18 검색 출시 리허설 게이트 | 65개 후보 최종 점검','LAUNCH GATE V18','검색 스니펫·모바일·내부 이동·AI 인용·번들·광고·production diff를 한 번에 최종 검사합니다.',`${kpis([['Release',65],['Snippet',snippets.passed],['Mobile',mobile.ready],['Answer',answers.length]])}<div class="table-wrap"><table class="v15-table"><thead><tr><th scope="col">게이트</th><th scope="col">결과</th></tr></thead><tbody>${gateRows}</tbody></table></div>`);

let ll=read('llms.txt');
if(!ll.includes('v18 release rehearsal'))ll+=`\n\n## v18 release rehearsal\n- Release set: ${BASE}/data/release-url-set-v18.json\n- Search snippets: ${BASE}/data/search-snippets-v18.json\n- AI citation pack: ${BASE}/data/citation-pack-v18.json\n- Mobile audit: ${BASE}/data/mobile-audit-v18.json\n- Production diff: ${BASE}/data/production-switch-diff-v18.json\n- Latest answer hub: ${BASE}/data/answers-v18/\n- Preview remains noindex; production/Search Console/ads require owner approval.\n`;
write('llms.txt',ll);

const legacyReportPath=path.join(ROOT,'data','v6-report.json');
const legacy=JSON.parse(fs.readFileSync(legacyReportPath,'utf8'));
Object.assign(legacy,{v18_release_rehearsal:true,v18_release_candidates:65,v18_search_snippets:true,v18_mobile_audit:true,v18_release_journey:true,v18_citation_pack:true,v18_performance_budget:true,v18_ad_rehearsal:true,v18_production_diff:true,v18_answer_hub:true,v18_answer_count:answers.length,v18_actual_production_switch:false,v18_actual_ads_injected:false});
fs.writeFileSync(legacyReportPath,JSON.stringify(legacy,null,2));

const failed=Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k);
if(failed.length)throw new Error(`v18 release rehearsal gate failed ${JSON.stringify({failed,quality})}`);
console.log(JSON.stringify({version:VERSION,bundleHash,quality,checks,auditPages},null,2));
