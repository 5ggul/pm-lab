import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const VERSION='20.9.0';
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const coreJson=(name,f={})=>{try{return JSON.parse(fs.readFileSync(path.join(CORE,'data',name),'utf8'))}catch{return f}};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('ko-KR'):'-';
const iso=v=>{const s=String(v||'');const d=new Date(s);return Number.isNaN(d.getTime())?s.slice(0,10):d.toISOString().slice(0,10)};

const evidence=json('data/g2b-evidence-index-v20.json',{});
if(evidence.version!=='20.8.0'||!Array.isArray(evidence.evidence)||evidence.evidence.length!==65)throw new Error('source health requires validated evidence batch4');
const snapshots={
  material:coreJson('g2b-building-materials.json'),
  market:coreJson('g2b-building-market-construction.json'),
  standard:coreJson('g2b-standard-market-unit-building.json')
};
const meta={
  material:{id:'PPS-G2B-PRICE-BUILDING-MATERIALS',label:'시설공통자재(건축)',page:`${BASE}/data/g2b-materials/`,operation:'getPriceInfoListFcltyCmmnMtrilBildng'},
  market:{id:'PPS-G2B-MARKET-CONSTRUCTION-BUILDING',label:'건축 시장시공가격',page:`${BASE}/data/g2b-market-construction/`,operation:'getPriceInfoListMrktCnstrctPcBildng'},
  standard:{id:'PPS-G2B-STANDARD-MARKET-UNIT-BUILDING',label:'건축공사 표준시장단가',page:`${BASE}/data/g2b-standard-market-unit/`,operation:'getStdMarkUprcinfoList'}
};
const statusLabel=s=>s==='live'?'정상 수집':s==='stale_fallback'?'최근 정상 스냅샷 사용':'상태 확인 필요';
const dateRange=list=>{const a=list.map(x=>String(x.date||'').slice(0,10)).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort();return {from:a[0]||null,to:a.at(-1)||null,missing:list.length-a.length}};
const countRecords=(key,s)=>{
  if(Array.isArray(s.records))return s.records.length;
  if(Number.isFinite(Number(s.record_count)))return Number(s.record_count);
  if(key==='material'&&Array.isArray(s.groups))return s.groups.reduce((n,g)=>n+Number(g.captured_count||0),0);
  return null;
};
const sourceHealth=Object.entries(meta).map(([key,m])=>{
  const s=snapshots[key]||{};
  if(s.source_id!==m.id)throw new Error(`unexpected source snapshot ${key}`);
  const status=String(s.refresh_status||'');
  if(!['live','stale_fallback'].includes(status))throw new Error(`unsupported refresh status ${key}:${status}`);
  const ev=evidence.evidence.filter(x=>x.source===key);
  const range=dateRange(ev);
  const endpoint=String(s.endpoint||'');
  if(/serviceKey/i.test(endpoint))throw new Error(`secret query leaked in endpoint ${key}`);
  return {
    key,label:m.label,source_id:m.id,operation:m.operation,endpoint,source_page:m.page,
    refresh_status:status,status_label:statusLabel(status),uses_last_verified_snapshot:status==='stale_fallback',has_refresh_error:Boolean(s.refresh_error),
    source_collected_at:s.source_collected_at||s.collected_at||null,refresh_attempted_at:s.refresh_attempted_at||null,
    provider_total_count:Number.isFinite(Number(s.provider_total_count))?Number(s.provider_total_count):Number.isFinite(Number(s.total_count))?Number(s.total_count):countRecords(key,s),
    record_count:countRecords(key,s),group_count:Array.isArray(s.groups)?s.groups.length:0,
    query_term_count:Array.isArray(s.query_terms)?s.query_terms.length:null,fallback_term_count:Array.isArray(s.fallback_terms)?s.fallback_terms.length:null,
    evidence_count:ev.length,evidence_row_count:new Set(ev.map(x=>x.row_key)).size,evidence_unit_count:new Set(ev.map(x=>x.unit_key)).size,
    evidence_date_from:range.from,evidence_date_to:range.to,evidence_date_missing_count:range.missing
  };
});
const reviewed=evidence.reviewed_on||new Date().toISOString().slice(0,10);
const health={
  version:VERSION,reviewed_on:reviewed,provider:'조달청',dataset_id:'15129415',official_dataset_url:'https://www.data.go.kr/data/15129415/openapi.do',
  source_count:sourceHealth.length,all_sources_live:sourceHealth.every(x=>x.refresh_status==='live'),stale_fallback_count:sourceHealth.filter(x=>x.refresh_status==='stale_fallback').length,
  evidence_count:evidence.evidence_count,source_health:sourceHealth,
  semantics:{live:'이번 갱신에서 공급자 응답을 정상 수집',stale_fallback:'이번 갱신 실패 시 직전 정상 스냅샷 유지',freshness_threshold_assumed:false,private_market_average:false,automatic_price_judgment:false},
  same_unit_only:true,category_keyword_gate:true,scope_equivalence_assumed:false,user_input_persisted:false,server_transmission:false,production_switch:false,search_console_submission:false,ads_injected:false
};
const forbidden=/serviceKey|invstDeptTelNo|invstOfclNm|cntrctCorpTelNo/i;
if(forbidden.test(JSON.stringify(health)))throw new Error('forbidden field leaked into source health');
write('data/g2b-source-health-v20.json',JSON.stringify(health,null,2));

const template=read('data/g2b-evidence/index.html');
const header=template.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=template.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const styles=[...template.matchAll(/<link rel="stylesheet" href="[^"]+">/g)].map(x=>x[0]).join('');
const scripts=[...template.matchAll(/<script src="[^"]+" defer><\/script>/g)].map(x=>x[0]).join('');
const cards=sourceHealth.map(s=>`<article class="v20-sh-card" data-v20-source-card="${esc(s.key)}"><div class="v20-sh-head"><span>${esc(s.label)}</span><strong data-status="${esc(s.refresh_status)}">${esc(s.status_label)}</strong></div><dl><div><dt>최근 정상 수집</dt><dd>${esc(s.source_collected_at||'-')}</dd></div><div><dt>최근 갱신 시도</dt><dd>${esc(s.refresh_attempted_at||'-')}</dd></div><div><dt>공급자 전체</dt><dd>${fmt(s.provider_total_count)}건</dd></div><div><dt>보관 레코드</dt><dd>${fmt(s.record_count)}건</dd></div><div><dt>그룹</dt><dd>${fmt(s.group_count)}개</dd></div><div><dt>근거 인덱스 연결</dt><dd>${fmt(s.evidence_count)}개</dd></div><div><dt>연결 공종 / 단위</dt><dd>${fmt(s.evidence_row_count)} / ${fmt(s.evidence_unit_count)}</dd></div><div><dt>근거 기준일 범위</dt><dd>${esc(s.evidence_date_from||'-')} ~ ${esc(s.evidence_date_to||'-')}</dd></div></dl>${s.uses_last_verified_snapshot?'<p class="v20-sh-warn">이번 갱신은 공급자 응답 문제로 직전 정상 스냅샷을 사용합니다. 새 자료로 갱신됐다고 표시하지 않습니다.</p>':'<p class="v20-sh-ok">이번 갱신에서 공급자 응답을 정상 수집했습니다.</p>'}<p class="v20-sh-op">API operation <code>${esc(s.operation)}</code></p><nav><a href="${esc(s.source_page)}">원천 데이터 보기</a><a href="${BASE}/data/g2b-evidence/">근거 인덱스 보기</a></nav></article>`).join('');
const style=`<style data-v20-source-health-style>.v20-sh-hero{padding:34px 0 20px;border-bottom:1px solid #d8dee4}.v20-sh-hero h1{margin:4px 0 8px;font-size:clamp(28px,5vw,44px);letter-spacing:-.05em}.v20-sh-hero p{max-width:900px;color:#536171;line-height:1.65}.v20-sh-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#d8dee4;border:1px solid #d8dee4;margin:22px 0}.v20-sh-summary div{background:#fff;padding:14px}.v20-sh-summary span{display:block;font-size:11px;font-weight:800;color:#65717e}.v20-sh-summary strong{display:block;font-size:20px;margin-top:4px}.v20-sh-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0 30px}.v20-sh-card{border:1px solid #d4dbe2;padding:16px;background:#fff;min-width:0}.v20-sh-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v20-sh-head span{font-size:16px;font-weight:900}.v20-sh-head strong{font-size:11px;padding:4px 7px;border:1px solid #bcc7d1;white-space:nowrap}.v20-sh-card dl{margin:14px 0}.v20-sh-card dl div{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #edf0f3}.v20-sh-card dt{font-size:11px;color:#64707d}.v20-sh-card dd{margin:0;font-size:11px;font-weight:800;text-align:right;overflow-wrap:anywhere}.v20-sh-ok,.v20-sh-warn,.v20-sh-op{font-size:11px;line-height:1.6;color:#536171}.v20-sh-card nav{display:flex;gap:12px;flex-wrap:wrap}.v20-sh-card nav a{font-size:11px;font-weight:800;text-decoration:underline;text-underline-offset:3px}.v20-sh-explain{margin:0 0 36px;padding:18px 0;border-top:2px solid #17243a;border-bottom:1px solid #d5dce3}.v20-sh-explain p{font-size:13px;color:#526071;line-height:1.7;max-width:900px}.v20-sh-strip{margin:20px 0;padding:12px 0;border-top:1px solid #d7dde3;border-bottom:1px solid #d7dde3;display:flex;justify-content:space-between;gap:16px;align-items:center}.v20-sh-strip span{font-size:12px;color:#5c6875}.v20-sh-strip a{font-size:12px;font-weight:800;text-decoration:underline;text-underline-offset:3px}@media(max-width:760px){.v20-sh-summary{grid-template-columns:1fr 1fr}.v20-sh-grid{grid-template-columns:1fr}.v20-sh-strip{align-items:flex-start;flex-direction:column}.v20-sh-card dl div{align-items:flex-start}}</style>`;
const statusText=health.stale_fallback_count?`${health.stale_fallback_count}개 원천은 최근 정상 스냅샷 사용`:'3개 원천 모두 이번 갱신 정상 수집';
const page=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><meta name="googlebot" content="noindex,nofollow,noarchive,nosnippet"><title>공식 데이터 수집 상태 | 견적검수실</title><meta name="description" content="조달청 시설공통자재, 건축 시장시공가격, 건축공사 표준시장단가의 최근 정상 수집 시각과 현재 갱신 상태, 보관 건수, 근거 연결 범위를 확인합니다."><link rel="canonical" href="${SITE}/data/g2b-source-health/">${styles}${style}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Dataset',name:'공식 데이터 수집 상태',url:`${SITE}/data/g2b-source-health/`,dateModified:reviewed,creator:{'@type':'Organization',name:'조달청'},isBasedOn:'https://www.data.go.kr/data/15129415/openapi.do'})}</script></head><body class="v20-source-health-ui">${header}<main id="main-content" data-v20-source-health-page><section class="v20-sh-hero"><div class="site-shell"><p class="kicker">SOURCE STATUS</p><h1>공식 데이터 수집 상태</h1><p>가격 수준의 적정성을 판정하는 화면이 아니라, 사이트가 어떤 공식 원천을 언제 정상 수집했고 공급자 장애 시 어떤 스냅샷을 유지하는지 확인하는 상태 페이지입니다.</p></div></section><div class="site-shell"><section class="v20-sh-summary"><div><span>공식 원천</span><strong>3개</strong></div><div><span>이번 갱신 정상</span><strong>${sourceHealth.filter(x=>x.refresh_status==='live').length}개</strong></div><div><span>최근 정상 스냅샷</span><strong>${health.stale_fallback_count}개</strong></div><div><span>연결 근거</span><strong>${fmt(health.evidence_count)}개</strong></div></section><p>${esc(statusText)}</p><section class="v20-sh-grid">${cards}</section><section class="v20-sh-explain"><h2>수집 상태를 읽는 기준</h2><p><strong>정상 수집</strong>은 이번 갱신에서 공급자 응답을 받아 스냅샷을 새로 만들었다는 뜻입니다. <strong>최근 정상 스냅샷 사용</strong>은 이번 갱신에 실패해 직전 정상 데이터를 유지한다는 뜻이며, 새 자료로 갱신됐다고 표시하지 않습니다. 별도의 임의 신선도 일수 기준은 만들지 않고 공식 자료의 실제 기준일과 수집 시각을 함께 제공합니다.</p><p>공식 조달·시설공사 가격은 민간 아파트 인테리어 시장평균이나 적정견적을 의미하지 않습니다. 같은 단위와 공종 키워드가 맞아도 규격·공사범위·VAT·납품·설치 조건은 별도로 확인해야 합니다.</p><a href="${BASE}/data/g2b-evidence/">65개 공식 참고값 근거 확인</a></section></div></main>${footer}${scripts}</body></html>`;
write('data/g2b-source-health/index.html',page);

const targets=['data/index.html','data/methodology/index.html','data/g2b-evidence/index.html','data/g2b-materials/index.html','data/g2b-market-construction/index.html','data/g2b-standard-market-unit/index.html'];
const stripStyle='<style data-v20-source-health-strip-style>.v20-sh-strip{margin:20px 0;padding:12px 0;border-top:1px solid #d7dde3;border-bottom:1px solid #d7dde3;display:flex;justify-content:space-between;gap:16px;align-items:center}.v20-sh-strip span{font-size:12px;color:#5c6875}.v20-sh-strip a{font-size:12px;font-weight:800;text-decoration:underline;text-underline-offset:3px}@media(max-width:760px){.v20-sh-strip{align-items:flex-start;flex-direction:column}}</style>';
const strip=`<div class="site-shell"><aside class="v20-sh-strip" data-v20-source-health-strip><span>${esc(statusText)} · 공식 원천 3개 · 근거 ${fmt(health.evidence_count)}개</span><a href="${BASE}/data/g2b-source-health/">공식 데이터 수집 상태</a></aside></div>`;
let injected=0;
for(const rel of targets){
  let h=read(rel);if(!/noindex,nofollow/.test(h))throw new Error(`${rel} lost preview noindex`);
  if(!h.includes('data-v20-source-health-strip-style'))h=h.replace('</head>',stripStyle+'</head>');
  if(!h.includes('data-v20-source-health-strip'))h=h.replace('</main>',strip+'</main>');
  write(rel,h);injected++;
}
try{const cat=json('data/dataset-catalog.json',{datasets:[]});cat.datasets=Array.isArray(cat.datasets)?cat.datasets:[];if(!cat.datasets.some(x=>x.id==='g2b-source-health-v20'))cat.datasets.push({id:'g2b-source-health-v20',type:'STATUS',name:'공식 데이터 수집 상태',status:'preview',scope:'조달청 3개 원천의 수집 상태·정상 스냅샷·근거 연결 범위',period:reviewed,page:`${BASE}/data/g2b-source-health/`,json:`${BASE}/data/g2b-source-health-v20.json`,source:'조달청 나라장터 가격정보현황서비스',not_for:'민간 인테리어 시장평균·가격 적정성 판정'});write('data/dataset-catalog.json',JSON.stringify(cat,null,2))}catch{}
try{const search=json('data/search-index.json',[]);if(Array.isArray(search)&&!search.some(x=>x.url===`${BASE}/data/g2b-source-health/`)){search.push({title:'공식 데이터 수집 상태',url:`${BASE}/data/g2b-source-health/`,type:'데이터',description:'조달청 가격정보 3개 원천의 최근 정상 수집·갱신 상태·근거 연결 범위',keywords:['공식 데이터 갱신','조달청 데이터 상태','공식 단가 기준일']});write('data/search-index.json',JSON.stringify(search,null,2))}}catch{}
try{let ll=read('llms.txt');if(!ll.includes('/data/g2b-source-health/'))ll+=`\n## Official source status\n- ${SITE}/data/g2b-source-health/ — collection status for three PPS/G2B sources, including last successful snapshot time and evidence coverage.\n- ${SITE}/data/g2b-source-health-v20.json — machine-readable source health summary. No arbitrary freshness threshold or private-market price judgment is applied.\n`;write('llms.txt',ll)}catch{}
const audit={version:VERSION,reviewed_on:reviewed,source_count:3,all_sources_live:health.all_sources_live,stale_fallback_count:health.stale_fallback_count,evidence_count:health.evidence_count,strip_target_count:targets.length,strip_injected_count:injected,strip_targets:targets,forbidden_fields:false,freshness_threshold_assumed:false,same_unit_only:true,category_keyword_gate:true,scope_equivalence_assumed:false,automatic_price_judgment:false,private_market_average:false,preview_noindex:true,production_switch:false,search_console_submission:false,ads_injected:false};
write('data/g2b-source-health-audit-v20.json',JSON.stringify(audit,null,2));
console.log(`v20 source health batch5: ${sourceHealth.length} sources / ${health.evidence_count} evidence / ${targets.length} linked surfaces / stale ${health.stale_fallback_count}`);
