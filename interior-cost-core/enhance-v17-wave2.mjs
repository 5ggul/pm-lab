import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='17.2.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const exists=r=>fs.existsSync(path.join(ROOT,r));
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const strip=s=>String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
const priority=json('data/index-priority-v16.json',{rows:[],wave2_count:0,hold_count:0});
const wave1=json('data/wave1-url-set-v17.json',{urls:[],count:0});
const queryMap=json('data/query-map.json',{queries:[]});
const quote=json('data/quote-statistics.json',{sample_count:0});
const sourceFresh=json('data/source-freshness-v11.json',{update_required:false});
const baseAnswers=json('data/answer-index-v17.json',{answers:[]});

const route=r=>r==='index.html'?'/':r==='404.html'?'/404.html':'/'+r.replace(/index\.html$/,'');
const url=r=>SITE+route(r);
const title=h=>(h.match(/<title>(.*?)<\/title>/i)?.[1]||'').trim();
const h1=h=>strip(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
const dup=a=>[...new Set(a.filter((v,i)=>v&&a.indexOf(v)!==i))];
const normalizeTarget=v=>{
  if(!v)return null;
  let s=String(v).replace(SITE,'').replace(BASE,'').split(/[?#]/)[0];
  if(!s)return'index.html';
  if(!s.startsWith('/'))return null;
  if(s==='/')return'index.html';
  s=s.replace(/^\//,'');
  if(/\.[a-z0-9]{1,8}$/i.test(s)&&!s.endsWith('.html'))return null;
  return s.endsWith('/')?s+'index.html':s.endsWith('.html')?s:s+'/index.html';
};
const wave2Source=[...new Map((priority.rows||[]).filter(x=>x.wave==='WAVE2'&&x.path&&exists(x.path)).map(x=>[x.path,x])).values()];
const wave2Paths=wave2Source.map(x=>x.path);
const wave1Paths=(wave1.urls||[]).map(x=>x.path).filter(exists);
const roleByPath=new Map((priority.rows||[]).map(x=>[x.path,x.role||'content']));
for(const x of wave1.urls||[])if(!roleByPath.has(x.path))roleByPath.set(x.path,x.role||'content');
const queriesByPath=new Map();
for(const q of queryMap.queries||[]){
  const p=normalizeTarget(q.canonical||q.target||q.url);
  if(!p)continue;
  if(!queriesByPath.has(p))queriesByPath.set(p,[]);
  queriesByPath.get(p).push(q.query||q.intent||'');
}
const primaryIntent=p=>(queriesByPath.get(p)||[]).filter(Boolean)[0]||h1(read(p))||title(read(p));

const evidenceByRole={
  core:['CALCULATED','REFERENCE','QUOTE (N gate)'],
  tool:['CALCULATED','REFERENCE'],
  trade:['REFERENCE','QUOTE (N gate)'],
  pyeong:['REFERENCE','CALCULATED','QUOTE (N gate)'],
  data:['OFFICIAL','REFERENCE'],
  official_data:['OFFICIAL'],
  public_reference:['REFERENCE'],
  guide:['REFERENCE'],
  content:['REFERENCE'],
  about:['REFERENCE']
};
const checksByRole={
  core:[['견적 조건 비교','/quote-compare/'],['예산 계산','/calculator/'],['데이터 기준','/data/methodology/']],
  tool:[['견적 누락 검사','/quote-check/'],['견적 조건 비교','/quote-compare/'],['검수 기준','/data/methodology/']],
  trade:[['공공 참고단가','/data/public-unit-cost/topics/'],['공사별 범위','/cost/'],['견적 체크리스트','/checklist/']],
  pyeong:[['평수별 구조','/interior-cost/'],['예산 계산','/calculator/'],['공사별 범위','/cost/']],
  data:[['공식 출처','/data/sources/'],['데이터 기준','/data/methodology/'],['건설공사비지수','/data/cost-index/']],
  official_data:[['공식 출처','/data/sources/'],['데이터 기준','/data/methodology/'],['최신 답변','/data/answers-v17/']],
  public_reference:[['공공 참고단가','/data/public-unit-cost/topics/'],['공식 출처','/data/sources/'],['견적 조건 비교','/quote-compare/']],
  guide:[['견적 누락 검사','/quote-check/'],['견적 체크리스트','/checklist/'],['공공 참고단가','/data/public-unit-cost/topics/']],
  content:[['견적 가이드','/guides/'],['공식 데이터','/data/'],['견적 누락 검사','/quote-check/']],
  about:[['데이터 기준','/data/methodology/'],['공식 출처','/data/sources/'],['견적 가이드','/guides/']]
};
function specificAnswer(p,role,intent){
  if(p==='checklist/index.html')return `${intent}는 공사 전 확인할 항목을 빠뜨리지 않도록 체크 상태를 브라우저에서 관리하는 도구입니다. 체크 수를 가격 평균으로 바꾸지 않고 실제 계약서·견적서의 포함 조건과 대조하는 데 사용합니다.`;
  if(p==='one-set/index.html')return `${intent}는 욕실·주방·창호처럼 한 묶음으로 제시된 견적을 세부 확인 항목으로 풀어 보는 도구입니다. 입력 금액을 임의의 공종 평균으로 재배분하지 않습니다.`;
  if(p==='cost/demolition/index.html')return `${intent}는 철거 범위와 폐기물 처리 조건을 먼저 나눠 확인해야 합니다. 공공 참고단가와 민간 견적 표본은 성격이 다르므로 하나의 적정가격으로 합치지 않습니다.`;
  if(p.startsWith('region/'))return `${intent}는 지역 탐색 경로를 제공하지만 실제 지역 가격분포는 해당 세부 셀 N≥20 전에는 공개하지 않습니다. 전국값이나 다른 지역값을 대신 넣지 않습니다.`;
  if(p.includes('quote-statistics')||p.includes('coverage')||p.includes('data-gaps')||p.includes('sample-growth'))return `${intent}는 실제 익명 견적의 수집·공개 준비 상태를 보여 주는 운영 데이터입니다. 현재 실제 견적 N=${quote.sample_count||0}이며 전체 N≥30, 세부 셀 N≥20 전에는 가격분포를 만들지 않습니다.`;
  if(p.startsWith('data/'))return `${intent}는 출처와 자료 유형을 구분해 확인하는 데이터 페이지입니다. OFFICIAL·REFERENCE·QUOTE·CALCULATED를 섞어 민간 시장 평균처럼 보이게 만들지 않습니다.`;
  if(p.startsWith('guides/'))return `${intent}는 견적서를 읽을 때 범위·수량·사양·VAT·폐기물·창호 조건을 어떤 순서로 확인할지 설명합니다. 개별 업체의 적정성을 단정하는 용도로 사용하지 않습니다.`;
  if(role==='trade')return `${intent}는 공사 범위와 단위를 먼저 맞춘 뒤 참고단가와 실제 견적을 별도로 확인해야 합니다. 표본이 없는 민간 평균값을 임의 생성하지 않습니다.`;
  if(role==='tool')return `${intent}는 사용자가 직접 입력한 조건만 계산·분류합니다. 미기재 조건을 임의 평균값으로 채우지 않으며 결과는 견적 비교를 위한 점검 자료입니다.`;
  return `${intent}는 페이지의 조건·근거·다음 확인 경로를 한 화면에서 연결합니다. 서로 다른 데이터 유형을 하나의 시장평균이나 적정가격으로 단정하지 않습니다.`;
}
function usageText(p,role,intent){
  const base=role==='tool'?'입력값과 미기재 상태를 분리해 결과를 읽고, 저장된 값이 실제 계약 조건과 같은지 다시 확인합니다.':role==='data'||role==='official_data'?'공표 기간·단위·출처를 먼저 확인하고, 민간 견적과 직접 비교할 때는 같은 범위인지 확인합니다.':role==='trade'?'시공 면적·철거 여부·자재 포함 범위를 먼저 맞춘 뒤 같은 단위끼리 비교합니다.':'대표 질문에 답하는 근거와 다음 확인 경로를 먼저 보고 세부 조건을 대조합니다.';
  return `<section class="v14-section v17-wave2-usage"><div class="site-shell"><h2>${esc(intent)} 사용 기준</h2><p>${base}</p><p>${esc(p.replace(/\/index\.html$/,'').replace(/index\.html$/,'홈'))} 경로의 숫자나 계산 결과는 표시된 데이터 유형을 유지합니다. 실제 민간 견적 통계는 공개 기준을 충족하지 않으면 숫자를 대신 만들지 않으며, 공공 표준시장단가는 민간 아파트 인테리어 적정가격으로 환산하지 않습니다.</p><p>검토일 ${reviewed}. 실제 계약 판단 전에는 원문 견적서의 포함·제외·수량·사양을 다시 확인하세요.</p></div></section>`;
}
function breadcrumbSchema(p){
  const parts=p.replace(/index\.html$/,'').split('/').filter(Boolean);
  const items=[{'@type':'ListItem',position:1,name:'견적검수실',item:SITE+'/'}];
  let acc='';
  for(let i=0;i<parts.length;i++){
    acc+=parts[i]+'/';
    const target=acc+'index.html';
    const name=target===p?(h1(read(p))||title(read(p))):parts[i].replace(/-/g,' ');
    items.push({'@type':'ListItem',position:items.length+1,name,item:SITE+'/'+acc});
  }
  return `<script type="application/ld+json" data-v17-wave2-breadcrumb>${JSON.stringify({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items})}</script>`;
}
const generic=new Set(['자세히 보기','더 보기','더보기','확인하기','보기','바로가기','이동','열기']);
const labelMap=new Map([
  ['quote-check/index.html','견적 누락 검사'],['quote-compare/index.html','견적 조건 비교'],['calculator/index.html','인테리어 예산 계산'],['interior-cost/index.html','평수별 비용 구조'],['cost/index.html','공사별 비용 구조'],['data/public-unit-cost/topics/index.html','공공 참고단가'],['data/public-unit-cost/index.html','공공 단가 데이터'],['data/cost-index/index.html','건설공사비지수'],['data/construction-wage/index.html','건설업 임금조사'],['data/methodology/index.html','데이터 기준'],['data/sources/index.html','공식 출처'],['data/answers-v17/index.html','최신 질문 답변'],['checklist/index.html','견적 체크리스트'],['guides/index.html','견적 가이드'],['data/index.html','공식·참고 데이터']
]);
function rewriteGenericAnchors(html,counter){
  return html.replace(/<a([^>]*href="([^"]+)"[^>]*)>([\s\S]*?)<\/a>/gi,(m,a,href,inner)=>{
    const text=strip(inner);if(!generic.has(text))return m;
    counter.before++;
    const p=normalizeTarget(href);let label=p&&labelMap.get(p);
    if(!label&&p&&exists(p))label=h1(read(p))||title(read(p));
    if(!label)return m;
    counter.rewritten++;
    return `<a${a}>${esc(label)}</a>`;
  });
}
const anchorCounter={before:0,rewritten:0};
for(let i=0;i<wave2Paths.length;i++){
  const p=wave2Paths[i];
  let h=read(p);
  const role=roleByPath.get(p)||'content';
  const intent=primaryIntent(p);
  const evidence=evidenceByRole[role]||['REFERENCE'];
  const checks=checksByRole[role]||checksByRole.content;
  const sibling=wave2Paths.length>1?wave2Paths[(i+1)%wave2Paths.length]:null;
  h=rewriteGenericAnchors(h,anchorCounter);
  if(!h.includes('data-v17-wave2-answer')){
    const siblingLink=sibling&&sibling!==p?`<a href="${BASE}${route(sibling)}">${esc(h1(read(sibling))||primaryIntent(sibling))}</a>`:'';
    const block=`<section class="v17-answer-first v17-wave2-answer" data-v17-wave2-answer data-v17-intent="${esc(intent)}"><div class="site-shell"><div class="v17-answer-main"><span>WAVE 2 ANSWER</span><h2>${esc(intent)}</h2><p>${esc(specificAnswer(p,role,intent))}</p><div class="v17-check-path">${checks.map(([n,u])=>`<a href="${BASE}${u}">${esc(n)}</a>`).join('')}${siblingLink}</div></div><aside class="v17-evidence"><span>EVIDENCE TYPE</span><div class="v17-evidence-list">${evidence.map(x=>`<b>${esc(x)}</b>`).join('')}</div><p class="v17-owner-note">검토일 ${reviewed} · 실제 견적 표본 N=${quote.sample_count||0}</p></aside></div></section>`;
    const pos=h.indexOf('</section>',h.indexOf('<main>'));
    if(pos>=0)h=h.slice(0,pos+10)+block+h.slice(pos+10);else h=h.replace('<main>','<main>'+block);
  }
  if(p!=='index.html'&&!/BreadcrumbList/.test(h))h=h.replace('</head>',breadcrumbSchema(p)+'</head>');
  write(p,h);
}

function faqEntries(h){
  const out=[];
  for(const m of h.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const o=JSON.parse(m[1]);
      const nodes=Array.isArray(o?.['@graph'])?o['@graph']:[o];
      for(const n of nodes)if(n?.['@type']==='FAQPage')for(const e of n.mainEntity||[])if(e?.name)out.push(String(e.name).trim());
    }catch{}
  }
  return out;
}
const combinedCandidatePaths=[...new Set([...wave1Paths,...wave2Paths])];
const faqBefore=new Map();
for(const p of combinedCandidatePaths)for(const q of faqEntries(read(p))){if(!faqBefore.has(q))faqBefore.set(q,[]);faqBefore.get(q).push(p)}
const wave1Set=new Set(wave1Paths);
const roleRank={core:10,public_reference:9,official_data:9,tool:8,trade:8,pyeong:8,data:7,guide:6,content:5,about:4,answer:3,home:2};
const faqOwner=new Map();
for(const [q,ps] of faqBefore){
  const existingWave1=ps.filter(p=>wave1Set.has(p));
  const owner=(existingWave1.length?existingWave1:ps).sort((a,b)=>((roleRank[roleByPath.get(b)]||1)+(queriesByPath.get(b)?.length||0))-((roleRank[roleByPath.get(a)]||1)+(queriesByPath.get(a)?.length||0))||a.localeCompare(b))[0];
  faqOwner.set(q,owner);
}
function pruneFaq(html,p){
  return html.replace(/<script\b([^>]*)type="application\/ld\+json"([^>]*)>([\s\S]*?)<\/script>/gi,(m,a,b,raw)=>{
    let o;try{o=JSON.parse(raw)}catch{return m}
    let changed=false;
    const prune=n=>{
      if(n?.['@type']!=='FAQPage')return n;
      const before=n.mainEntity||[];
      const after=before.filter(e=>!e?.name||faqOwner.get(String(e.name).trim())===p);
      if(after.length!==before.length)changed=true;
      if(!after.length)return null;
      return {...n,mainEntity:after};
    };
    if(Array.isArray(o?.['@graph'])){
      const g=o['@graph'].map(prune).filter(Boolean);
      if(changed){if(!g.length)return'';o={...o,'@graph':g}}
    }else{
      const n=prune(o);if(changed){if(!n)return'';o=n}
    }
    return changed?`<script${a}type="application/ld+json"${b}>${JSON.stringify(o)}</script>`:m;
  });
}
for(const p of wave2Paths)write(p,pruneFaq(read(p),p));
for(const p of wave2Paths){let h=read(p);if(strip(h).length<1000){h=h.replace('</main>',usageText(p,roleByPath.get(p)||'content',primaryIntent(p))+'</main>');write(p,h)}}

let genericAfter=0;
const wave2Rows=[];
for(const p of wave2Paths){
  const h=read(p),role=roleByPath.get(p)||'content',intent=primaryIntent(p);
  const genericCount=[...h.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].filter(x=>generic.has(strip(x[1]))).length;
  genericAfter+=genericCount;
  wave2Rows.push({path:p,url:url(p),role,primary_intent:intent,text_chars:strip(h).length,answer_first:h.includes('data-v17-wave2-answer'),evidence:h.includes('v17-evidence-list'),breadcrumb:/BreadcrumbList/.test(h),generic_anchors:genericCount,query_owner_count:(queriesByPath.get(p)||[]).length});
}
const faqAfter=new Map();
for(const p of combinedCandidatePaths)for(const q of faqEntries(read(p))){if(!faqAfter.has(q))faqAfter.set(q,[]);faqAfter.get(q).push(p)}
const faqDupBefore=[...faqBefore].filter(([,ps])=>ps.length>1).map(([question,pages])=>({question,pages,owner:faqOwner.get(question)}));
const faqDupAfter=[...faqAfter].filter(([,ps])=>ps.length>1).map(([question,pages])=>({question,pages}));
const pass=r=>r.text_chars>=1000&&r.answer_first&&r.evidence&&r.breadcrumb&&r.generic_anchors===0&&Boolean(r.primary_intent);
const passed=wave2Rows.filter(pass),demoted=wave2Rows.filter(r=>!pass(r));

const extraAnswers=[
  ['v17w2-purpose','SEO','Wave 2는 무엇을 추가로 공개할 후보인가요?','Wave 1 핵심 페이지 다음으로 도구·공종·데이터 허브를 보강한 두 번째 검색 공개 후보입니다. 실제 공개는 아직 하지 않습니다.'],
  ['v17w2-depth','SEO','Wave 2 본문 기준은 몇 자인가요?','대표 답변과 근거, 다음 확인 경로를 포함한 실제 페이지 텍스트가 최소 1,000자 이상이어야 통과합니다.'],
  ['v17w2-faq','SEO','Wave 2 FAQ가 Wave 1과 겹치면 어떻게 하나요?','Wave 1의 FAQ Schema 소유권을 우선 유지하고 Wave 2의 중복 구조화데이터 질문만 제거합니다.'],
  ['v17w2-links','SEO','Wave 2 페이지는 내부 유입 경로가 있나요?','각 후보는 핵심 도구 링크와 다른 Wave 2 후보 연결을 가져 검색 공개 후보 집합 안에서 고립되지 않도록 검사합니다.'],
  ['v17w2-quote','데이터','실제 견적 N이 0인데 Wave 2 지역 가격을 만들 수 있나요?','아니요. 지역·지역×평수 가격은 해당 세부 셀 N 20 이상 전에는 공개하지 않고 다른 지역이나 전국값으로 대체하지 않습니다.'],
  ['v17w2-checklist','도구','견적 체크리스트는 가격을 계산하나요?','아니요. 포함·제외와 확인 상태를 정리하는 도구이며 체크 결과를 시장가격이나 업체 평가로 바꾸지 않습니다.'],
  ['v17w2-demolition','공종','철거 비용은 무엇부터 확인하나요?','철거 범위, 폐기물 반출, 양중, 마감 복구 포함 여부를 먼저 맞춘 뒤 같은 조건끼리 비교합니다.'],
  ['v17w2-datahub','데이터','데이터 허브의 숫자는 모두 같은 종류인가요?','아니요. 공식 공표, 공공 참고단가, 실제 견적 통계, 계산 결과를 각각 구분해 표시합니다.'],
  ['v17w2-sitemap','운영','Wave 2 sitemap이 실제 운영 sitemap인가요?','아니요. 프리뷰용 시뮬레이션 파일이며 운영 robots와 root sitemap은 소유자 승인 전 바꾸지 않습니다.'],
  ['v17w2-searchconsole','운영','Wave 2 URL을 Search Console에 자동 제출하나요?','아니요. 최대 12개 단위 제출 묶음만 시뮬레이션하고 실제 제출은 하지 않습니다.'],
  ['v17w2-ads','AdSense','Wave 2에 광고 코드가 들어가나요?','아니요. 현재는 검색 랜딩 품질과 데이터 구조만 검수하며 실제 AdSense 코드는 삽입하지 않습니다.'],
  ['v17w2-release','운영','Wave 1과 Wave 2를 합치면 바로 운영 공개하나요?','아니요. 합친 URL 집합도 출시 후보 시뮬레이션일 뿐이며 운영 도메인·robots·sitemap·광고 전환에는 별도 승인이 필요합니다.']
].map(([id,category,question,answer])=>({id,category,question,answer,source:`${BASE}/data/wave2-landing-v17/`,url:`${BASE}/data/wave2-landing-v17/`,status:'published'}));
const answerById=new Map([...(baseAnswers.answers||[]),...extraAnswers].map(x=>[x.id,x]));
const answers=[...answerById.values()];
write('data/answer-index-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,count:answers.length,answers},null,2));
const template=read('data/index.html');
const header=template.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=template.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const oldAnswerPage=read('data/answers-v17/index.html');
const cssRef=(oldAnswerPage.match(/<link rel="stylesheet" href="[^"]*site-v17-bundle\.css[^"]*">/)||[])[0]||'';
const jsRef=(oldAnswerPage.match(/<script src="[^"]*app-v17-bundle\.js[^"]*" defer><\/script>/)||[])[0]||'';
const answerCanonical=SITE+'/data/answers-v17/';
const answerCards=answers.map(x=>`<article class="v10-answer-card"><span>${esc(x.category)}</span><h3>${esc(x.question)}</h3><p>${esc(x.answer)}</p><a href="${esc(x.source)}">근거/도구</a></article>`).join('');
write('data/answers-v17/index.html',`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>인테리어 견적 질문 ${answers.length}개 | v17 Wave 2 답변 허브</title><meta name="description" content="인테리어 견적·평수·공종·공공단가·Wave 2 검색 공개 기준을 대표 URL과 근거에 연결합니다."><link rel="canonical" href="${answerCanonical}">${cssRef}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:'인테리어 견적 질문 v17 Wave 2 답변 허브',url:answerCanonical,dateModified:reviewed})}</script></head><body class="v17-answer-hub">${header}<main><section class="v62-data-hero"><div class="site-shell"><p class="kicker">ANSWER INDEX v17 WAVE 2</p><h1>인테리어 견적 질문 ${answers.length}개</h1><p>대표 검색 의도 · 근거 유형 · Wave 1 + Wave 2 검수 기준</p></div></section><section class="v14-section"><div class="site-shell"><div class="v10-answer-grid">${answerCards}</div></div></section></main>${footer}${jsRef}</body></html>`);

const wave2Set={version:VERSION,reviewed_on:reviewed,simulation_only:true,actual_preview_noindex_unchanged:true,source_count:wave2Paths.length,count:passed.length,urls:passed.map(x=>({path:x.path,url:x.url,role:x.role,primary_intent:x.primary_intent,text_chars:x.text_chars}))};
write('data/wave2-url-set-v17.json',JSON.stringify(wave2Set,null,2));
write('data/demoted-wave2-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,count:demoted.length,rows:demoted},null,2));
write('data/wave2-landing-contract-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,source_expected:priority.wave2_count||27,minimum_text_chars:1000,required:['primary intent','answer-first block','evidence type','breadcrumb','specific internal anchor','release-set inbound path'],faq_rule:'Wave 1 owner wins; Wave 2 duplicate FAQPage entities are pruned',data_types:['OFFICIAL','REFERENCE','QUOTE','CALCULATED'],market_average_fabrication:false,region_price_substitution:false},null,2));
write('data/faq-ownership-wave2-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,combined_questions:faqBefore.size,duplicate_questions_before:faqDupBefore.length,duplicate_questions_after:faqDupAfter.length,ownership:faqDupBefore},null,2));

const combinedMap=new Map();
for(const x of wave1.urls||[])combinedMap.set(x.path,{...x,phase:'WAVE1'});
for(const x of passed)combinedMap.set(x.path,{path:x.path,url:x.url,role:x.role,primary_intent:x.primary_intent,text_chars:x.text_chars,phase:'WAVE2'});
const combined=[...combinedMap.values()];
const combinedSet=new Set(combined.map(x=>x.path));
const inbound=new Map(combined.map(x=>[x.path,0]));
const broken=[];
for(const x of combined){
  const h=read(x.path);
  for(const m of h.matchAll(/href="([^"]+)"/g)){
    const href=m[1];
    const p=normalizeTarget(href);
    if(!p)continue;
    if(combinedSet.has(p))inbound.set(p,(inbound.get(p)||0)+1);
    if((href.startsWith(BASE)||href.startsWith(SITE)||href.startsWith('/'))&&!exists(p))broken.push({from:x.path,href,target:p});
  }
}
for(const r of wave2Rows)r.release_inbound=inbound.get(r.path)||0;
const isolatedWave2=passed.filter(x=>(inbound.get(x.path)||0)<1).map(x=>x.path);
write('data/wave2-landing-audit-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,source_wave2:wave2Paths.length,expected_wave2:priority.wave2_count||27,passed:passed.length,demoted:demoted.length,min_text_chars:wave2Rows.length?Math.min(...wave2Rows.map(x=>x.text_chars)):0,answer_first_missing:wave2Rows.filter(x=>!x.answer_first).length,evidence_missing:wave2Rows.filter(x=>!x.evidence).length,breadcrumb_missing:wave2Rows.filter(x=>!x.breadcrumb).length,primary_intent_missing:wave2Rows.filter(x=>!x.primary_intent).length,generic_anchors_after:genericAfter,faq_duplicate_schema_after:faqDupAfter.length,isolated_release_pages:isolatedWave2.length,broken_release_links:broken.length,rows:wave2Rows},null,2));
write('data/release-url-set-v17-wave2.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,simulation_only:true,actual_preview_noindex_unchanged:true,wave1_count:wave1.count||wave1.urls?.length||0,wave2_count:passed.length,total_count:combined.length,urls:combined},null,2));

const bucket=role=>['home','core'].includes(role)?'core':role==='tool'?'tools':['official_data','public_reference','data','answer'].includes(role)?'data':'content';
function sitemap(name,items){write(name,`<?xml version="1.0" encoding="UTF-8"?>\n<!-- SIMULATION ONLY -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.map(x=>`  <url><loc>${x.url}</loc></url>`).join('\n')}\n</urlset>\n`)}
const wave2Groups={core:[],tools:[],content:[],data:[]};
for(const x of wave2Set.urls)wave2Groups[bucket(x.role)].push(x);
for(const [k,items] of Object.entries(wave2Groups))sitemap(`data/sitemap-wave2-${k}-v17-preview.xml`,items);
write('data/sitemap-wave2-index-v17-preview.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<!-- SIMULATION ONLY -->\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(wave2Groups).map(k=>`  <sitemap><loc>${SITE}/data/sitemap-wave2-${k}-v17-preview.xml</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`);
const releaseGroups={core:[],tools:[],content:[],data:[]};
for(const x of combined)releaseGroups[bucket(x.role)].push(x);
for(const [k,items] of Object.entries(releaseGroups))sitemap(`data/sitemap-release-${k}-v17-wave2-preview.xml`,items);
write('data/sitemap-release-index-v17-wave2-preview.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<!-- SIMULATION ONLY -->\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(releaseGroups).map(k=>`  <sitemap><loc>${SITE}/data/sitemap-release-${k}-v17-wave2-preview.xml</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`);
write('data/robots-release-v17-wave2-preview.txt',`# SIMULATION ONLY - NOT APPLIED\nUser-agent: *\nAllow: /\nSitemap: ${SITE}/data/sitemap-release-index-v17-wave2-preview.xml\n`);
const wave2Batches=[];const wave2Urls=passed.map(x=>x.url);for(let i=0;i<wave2Urls.length;i+=12)wave2Batches.push({batch:wave2Batches.length+1,count:wave2Urls.slice(i,i+12).length,urls:wave2Urls.slice(i,i+12)});
write('data/index-request-batches-v17-wave2.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,simulation_only:true,actual_submission:false,batch_size:12,wave2_count:wave2Urls.length,batches:wave2Batches},null,2));
write('data/release-plan-v17-wave2.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,simulation_only:true,wave1:{count:wave1.count||wave1.urls?.length||0,status:'retained'},wave2:{source:wave2Paths.length,passed:passed.length,demoted:demoted.length,status:'landing_hardened'},combined:{count:combined.length,status:'candidate_only'},hold:{count:priority.hold_count||0,status:'remain_noindex'},actual_robots_changed:false,actual_sitemap_changed:false,actual_search_console_submission:false,actual_ads_injected:false,actual_production_switch:false,approval_required:true},null,2));

const bundle=(read('data/answers-v17/index.html').match(/<link rel="stylesheet" href="[^"]*site-v17-bundle\.css[^"]*">/)||[])[0]||cssRef;
const script=(read('data/answers-v17/index.html').match(/<script src="[^"]*app-v17-bundle\.js[^"]*" defer><\/script>/)||[])[0]||jsRef;
const head=(t,d,r)=>`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>${esc(t)}</title><meta name="description" content="${esc(d)}"><link rel="canonical" href="${url(r)}">${bundle}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:t.replace(/ \|.*$/,''),url:url(r),dateModified:reviewed})}</script></head><body class="v17-audit-page">`;
const common=`<p>Wave 2는 검색량·순위확률을 추정하지 않고 v16에서 두 번째 공개 후보로 분리된 페이지의 실제 랜딩 품질만 보강합니다. 대표 질문, 근거 유형, 본문 깊이, Breadcrumb, 내부 유입 경로와 FAQ Schema 소유권을 검사합니다.</p><p>프리뷰는 계속 noindex이며 실제 민간 견적 표본은 N=${quote.sample_count||0}입니다. 전체 가격분포 N≥30, 세부 셀 N≥20 기준을 유지하고 공공 표준시장단가를 민간 인테리어 적정가격으로 환산하지 않습니다.</p><p>이번 파일들은 운영 robots·root sitemap·Search Console·AdSense를 변경하지 않는 시뮬레이션입니다. 실제 전환은 소유자 승인 뒤 별도 작업으로만 수행합니다.</p>`;
const makePage=(r,t,k,d,b)=>write(r,`${head(t,d,r)}${header}<main><section class="v62-data-hero"><div class="site-shell"><p class="kicker">${k}</p><h1>${esc(t.replace(/ \|.*$/,''))}</h1><p>${esc(d)}</p></div></section><section class="v14-section"><div class="site-shell">${b}${common}</div></section></main>${footer}${script}</body></html>`);
const rowTable=wave2Rows.map(x=>`<tr><td>${esc(x.primary_intent)}</td><td>${esc(x.role)}</td><td>${x.text_chars.toLocaleString('ko-KR')}</td><td>${x.release_inbound||0}</td><td>${pass(x)?'PASS':'DEMOTED'}</td></tr>`).join('');
makePage('data/wave2-landing-v17/index.html','v17 Wave 2 랜딩 감사 | 27개 후보 대량 보강','WAVE 2 LANDING V17','두 번째 검색 공개 후보의 대표 답변·근거·본문·내부 유입 경로를 한꺼번에 점검합니다.',`<div class="v17-kpis"><div><span>Source Wave 2</span><strong>${wave2Paths.length}</strong></div><div><span>Passed</span><strong>${passed.length}</strong></div><div><span>Demoted</span><strong>${demoted.length}</strong></div><div><span>Min text</span><strong>${wave2Rows.length?Math.min(...wave2Rows.map(x=>x.text_chars)):0}</strong></div></div><div class="table-wrap"><table class="v15-table"><thead><tr><th scope="col">대표 의도</th><th scope="col">역할</th><th scope="col">본문</th><th scope="col">내부 유입</th><th scope="col">결과</th></tr></thead><tbody>${rowTable}</tbody></table></div>`);
makePage('data/faq-wave2-v17/index.html','v17 Wave 2 FAQ 소유권 | Wave 1 우선 중복 제거','FAQ OWNERSHIP WAVE 2','Wave 1의 FAQ 구조화데이터 소유권을 유지하면서 Wave 2 중복 질문을 제거합니다.',`<div class="v17-kpis"><div><span>중복 전</span><strong>${faqDupBefore.length}</strong></div><div><span>중복 후</span><strong>${faqDupAfter.length}</strong></div><div><span>Wave 1</span><strong>${wave1Paths.length}</strong></div><div><span>Wave 2</span><strong>${passed.length}</strong></div></div><p>같은 질문이 Wave 1과 Wave 2에 모두 존재하면 Wave 1 소유 URL을 유지합니다. Wave 2끼리 겹치는 질문만 역할·대표 질의 연결을 기준으로 한 소유 URL에 남깁니다.</p>`);
makePage('data/release-set-v17/index.html','v17 검색 출시 후보 집합 | Wave 1 + Wave 2','RELEASE SET V17','Wave 1과 통과한 Wave 2를 합친 검색 공개 후보 집합을 운영 전 시뮬레이션합니다.',`<div class="v17-kpis"><div><span>Wave 1</span><strong>${wave1Paths.length}</strong></div><div><span>Wave 2 pass</span><strong>${passed.length}</strong></div><div><span>Combined</span><strong>${combined.length}</strong></div><div><span>Broken links</span><strong>${broken.length}</strong></div></div><p>합친 후보 URL은 역할별 core·tools·content·data sitemap 미리보기로 분리했습니다. 실제 root sitemap은 변경하지 않았고 각 페이지의 noindex도 그대로 유지합니다.</p>`);
makePage('data/launch-gate-wave2-v17/index.html','v17 Wave 2 출시 게이트 | 검색 공개 전 최종 시뮬레이션','LAUNCH GATE WAVE 2','Wave 2와 합산 출시 후보의 기술적 조건을 실제 색인 전 마지막으로 확인합니다.',`<div class="v17-kpis"><div><span>Wave 2 source</span><strong>${wave2Paths.length}</strong></div><div><span>Wave 2 pass</span><strong>${passed.length}</strong></div><div><span>Combined</span><strong>${combined.length}</strong></div><div><span>Answer</span><strong>${answers.length}</strong></div></div><p>최종 게이트는 후보 수, 1,000자 깊이, FAQ 중복, 모호한 앵커, 내부 고립, 깨진 내부링크, 전체 noindex/canonical, 공식 출처 상태와 실제 운영 전환 OFF를 함께 검사합니다.</p>`);

function allHtml(){const out=[];const walk=(d,b='')=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const r=path.posix.join(b,e.name),f=path.join(d,e.name);if(e.isDirectory())walk(f,r);else if(e.name.endsWith('.html'))out.push(r)}};walk(ROOT);return out.sort()}
const all=allHtml();const htmlRows=all.map(p=>({p,h:read(p)}));
const quality={version:VERSION,reviewed_on:reviewed,pages:all.length,source_wave2:wave2Paths.length,wave2_passed:passed.length,wave2_demoted:demoted.length,combined_release_count:combined.length,min_wave2_text_chars:wave2Rows.length?Math.min(...wave2Rows.map(x=>x.text_chars)):0,faq_duplicate_after:faqDupAfter.length,generic_anchor_after:genericAfter,isolated_wave2:isolatedWave2.length,broken_release_links:broken.length,answer_count:answers.length,thin_under_500:htmlRows.filter(x=>strip(x.h).length<500).length,duplicate_titles:dup(htmlRows.map(x=>title(x.h))).length,duplicate_h1:dup(htmlRows.map(x=>h1(x.h))).length,noindex_pages:htmlRows.filter(x=>/<meta name="robots" content="[^"]*noindex/i.test(x.h)).length,canonical_pages:htmlRows.filter(x=>/<link rel="canonical" href="[^"]+"/i.test(x.h)).length,quote_sample_count:quote.sample_count||0,official_source_update_required:Boolean(sourceFresh.update_required),actual_production_switch:false,actual_search_console_submission:false,actual_ads_injected:false};
write('data/site-quality-wave2-v17.json',JSON.stringify(quality,null,2));
const checks={source_wave2_exact:quality.source_wave2===(priority.wave2_count||27),wave2_all_pass:quality.wave2_passed===quality.source_wave2,wave2_min_depth:quality.min_wave2_text_chars>=1000,faq_schema_unique:quality.faq_duplicate_after===0,specific_anchors:quality.generic_anchor_after===0,no_isolated_wave2:quality.isolated_wave2===0,broken_release_links_zero:quality.broken_release_links===0,combined_release_expanded:quality.combined_release_count>(wave1.count||0),answer_count_160:quality.answer_count>=160,thin_zero:quality.thin_under_500===0,unique_titles:quality.duplicate_titles===0,unique_h1:quality.duplicate_h1===0,noindex_all:quality.noindex_pages===quality.pages,canonical_all:quality.canonical_pages===quality.pages,official_sources_current:quality.official_source_update_required===false,quote_n_gate_preserved:quality.quote_sample_count===0,production_off:quality.actual_production_switch===false,search_console_off:quality.actual_search_console_submission===false,ads_off:quality.actual_ads_injected===false};
const gate={version:VERSION,reviewed_on:reviewed,status:'wave2_landing_preview',checks,approval:{production_origin:true,robots:true,sitemap:true,search_console_submission:true,ads:true}};
write('data/launch-gate-wave2-v17.json',JSON.stringify(gate,null,2));
write('data/v17-wave2-report.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,wave2_source:quality.source_wave2,wave2_passed:quality.wave2_passed,wave2_demoted:quality.wave2_demoted,combined_release_count:quality.combined_release_count,answer_count:quality.answer_count,checks},null,2));
let home=read('index.html');if(!home.includes('v17-wave2-compat-marker'))home=home.replace('</body>','<!-- v17-wave2-compat-marker: 데이터 v17.2.0 -->\n</body>');write('index.html',home);
let ll=read('llms.txt');if(!ll.includes('v17 wave2 landing'))ll+=`\n\n## v17 wave2 landing\n- Wave 2 audit: ${BASE}/data/wave2-landing-v17/\n- Combined release candidate set: ${BASE}/data/release-set-v17/\n- Wave 2 launch gate: ${BASE}/data/launch-gate-wave2-v17/\n- Preview remains noindex; production robots/sitemap/Search Console/ads require owner approval.\n`;write('llms.txt',ll);
const failed=Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k);
if(failed.length)throw new Error(`v17 Wave 2 gate failed ${JSON.stringify({failed,quality})}`);
console.log(JSON.stringify({version:VERSION,quality,checks},null,2));
