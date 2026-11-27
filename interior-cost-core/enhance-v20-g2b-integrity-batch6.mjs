import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const VERSION='20.10.0';
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const coreRead=r=>fs.readFileSync(path.join(CORE,r),'utf8');
const coreJson=r=>JSON.parse(coreRead(r));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('ko-KR'):'-';
const arr=v=>Array.isArray(v)?v:[];
const uniq=a=>[...new Set(a.filter(v=>v!==null&&v!==undefined&&String(v)!=='').map(v=>String(v)))];
const minmax=a=>{const s=uniq(a).sort();return {min:s[0]||null,max:s.at(-1)||null}};
const forbidden=/serviceKey|invstDeptTelNo|invstOfclNm|cntrctCorpTelNo/i;

const evidence=json('data/g2b-evidence-index-v20.json',{});
const health=json('data/g2b-source-health-v20.json',{});
if(evidence.evidence_count!==65||!Array.isArray(evidence.evidence)||health.source_count!==3||!Array.isArray(health.source_health))throw new Error('integrity batch requires evidence and source-health payloads');
if(evidence.private_market_average!==false||evidence.automatic_price_judgment!==false||health.semantics?.freshness_threshold_assumed!==false)throw new Error('integrity batch safety baseline missing');

const defs=[
  {key:'material',label:'시설공통자재(건축)',file:'data/g2b-building-materials.json',operation:'getPriceInfoListFcltyCmmnMtrilBildng',page:`${BASE}/data/g2b-materials/`},
  {key:'market',label:'건축 시장시공가격',file:'data/g2b-building-market-construction.json',operation:'getPriceInfoListMrktCnstrctPcBildng',page:`${BASE}/data/g2b-market-construction/`},
  {key:'standard',label:'건축공사 표준시장단가',file:'data/g2b-standard-market-unit-building.json',operation:'getStdMarkUprcinfoList',page:`${BASE}/data/g2b-standard-market-unit/`}
];

const integrity=[];
for(const d of defs){
  const raw=coreRead(d.file),snap=JSON.parse(raw),h=health.source_health.find(x=>x.key===d.key)||{};
  const ev=evidence.evidence.filter(x=>x.source===d.key);
  const recordCount=Number(snap.record_count??h.record_count??(Array.isArray(snap.records)?snap.records.length:0));
  const groupCount=Number((d.key==='material'?snap.unit_groups?.length:snap.groups?.length)??h.group_count??0);
  const providerTotal=Number(snap.provider_total_count??snap.total_count??h.provider_total_count??recordCount);
  const bytes=Buffer.byteLength(raw,'utf8');
  const dateRange=minmax(ev.map(x=>x.date));
  const units=uniq(ev.map(x=>x.unit_key)).sort((a,b)=>a.localeCompare(b,'ko'));
  const rows=uniq(ev.map(x=>x.row_label)).sort((a,b)=>a.localeCompare(b,'ko'));
  const evHash=hash(JSON.stringify(ev.map(x=>({evidence_id:x.evidence_id,ref_id:x.ref_id,unit_key:x.unit_key,median_krw:x.median_krw,low_krw:x.low_krw,high_krw:x.high_krw,record_count:x.record_count,date:x.date,operation:x.operation}))));
  const structural={schema_version_present:Boolean(snap.schema_version),status_valid:['live','stale_fallback'].includes(String(snap.refresh_status||h.refresh_status||'')),source_collected_at_present:Boolean(snap.source_collected_at||h.source_collected_at),refresh_attempted_at_present:Boolean(snap.refresh_attempted_at||h.refresh_attempted_at),record_count_positive:recordCount>0,group_count_positive:groupCount>0,evidence_connected:ev.length>0,operation_matches:String(h.operation||d.operation)===d.operation,forbidden_fields_absent:!forbidden.test(raw)};
  const structuralPass=Object.values(structural).every(Boolean);
  integrity.push({key:d.key,label:d.label,source_file:`interior-cost-core/${d.file}`,source_page:d.page,operation:d.operation,schema_version:String(snap.schema_version||''),refresh_status:String(snap.refresh_status||h.refresh_status||''),source_collected_at:snap.source_collected_at||h.source_collected_at||null,refresh_attempted_at:snap.refresh_attempted_at||h.refresh_attempted_at||null,provider_total_count:providerTotal,record_count:recordCount,group_count:groupCount,evidence_count:ev.length,row_count:rows.length,unit_count:units.length,rows,units,evidence_date_min:dateRange.min,evidence_date_max:dateRange.max,source_bytes:bytes,source_sha256:hash(raw),evidence_sha256:evHash,structural_checks:structural,structural_check_pass:structuralPass,content_change_semantics:'SHA-256 값이 달라지면 해당 정제 스냅샷 또는 연결 evidence 내용이 바뀌었다는 뜻이며 가격 상승·하락이나 적정성 판단을 뜻하지 않음'});
}
if(integrity.some(x=>!x.structural_check_pass))throw new Error('one or more G2B snapshots failed structural integrity checks');
if(forbidden.test(JSON.stringify(integrity)))throw new Error('forbidden field leaked into integrity manifest');

const manifest={version:VERSION,reviewed_on:evidence.reviewed_on||health.reviewed_on||new Date().toISOString().slice(0,10),dataset_id:'15129415',provider:'조달청',source_count:integrity.length,evidence_count:evidence.evidence_count,all_structural_checks_pass:true,hash_algorithm:'SHA-256',hash_scope:'sanitized committed snapshot bytes and selected evidence fields',freshness_threshold_assumed:false,automatic_price_judgment:false,private_market_average:false,scope_equivalence_assumed:false,server_transmission:false,production_switch:false,search_console_submission:false,ads_injected:false,integrity};
write('data/g2b-data-integrity-v20.json',JSON.stringify(manifest,null,2));

const template=read('data/g2b-source-health/index.html');
const header=template.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=template.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const styles=[...template.matchAll(/<link rel="stylesheet" href="[^"]+">/g)].map(x=>x[0]).join('');
const scripts=[...template.matchAll(/<script src="[^"]+" defer><\/script>/g)].map(x=>x[0]).join('');
const cards=integrity.map(x=>`<article class="v20-int-card" data-v20-integrity-card="${esc(x.key)}"><div class="v20-int-head"><span>${esc(x.label)}</span><strong>${x.structural_check_pass?'구조 검증 통과':'확인 필요'}</strong></div><dl><div><dt>수집 상태</dt><dd>${esc(x.refresh_status)}</dd></div><div><dt>보관 레코드</dt><dd>${fmt(x.record_count)}</dd></div><div><dt>그룹</dt><dd>${fmt(x.group_count)}</dd></div><div><dt>연결 근거</dt><dd>${fmt(x.evidence_count)}</dd></div><div><dt>근거 공종</dt><dd>${fmt(x.row_count)}</dd></div><div><dt>근거 단위</dt><dd>${fmt(x.unit_count)}</dd></div></dl><p>최근 정상 수집 ${esc(x.source_collected_at||'-')} · 최근 갱신 시도 ${esc(x.refresh_attempted_at||'-')}</p><p>근거 기준일 ${esc(x.evidence_date_min||'-')} ~ ${esc(x.evidence_date_max||'-')}</p><div class="v20-int-hash"><span>정제 스냅샷 SHA-256</span><code>${esc(x.source_sha256)}</code><span>연결 evidence SHA-256</span><code>${esc(x.evidence_sha256)}</code></div><p class="v20-int-note">해시 변경은 데이터 내용 변경 신호일 뿐 가격 방향·적정성 판단이 아닙니다.</p><nav><a href="${esc(x.source_page)}">원천 데이터 보기</a><a href="${BASE}/data/g2b-evidence/">근거 인덱스</a><a href="${BASE}/data/g2b-source-health/">수집 상태</a></nav></article>`).join('');
const pageStyle=`<style data-v20-integrity-style>
.v20-int-hero{padding:32px 0 18px;border-bottom:1px solid #d7dde3}.v20-int-hero h1{font-size:clamp(28px,5vw,44px);letter-spacing:-.05em;margin:4px 0 8px}.v20-int-hero p{max-width:900px;color:#526070;line-height:1.65}.v20-int-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#d9dfe5;border:1px solid #d9dfe5;margin:22px 0}.v20-int-summary div{background:#fff;padding:13px}.v20-int-summary span{display:block;font-size:11px;color:#66717e;font-weight:800}.v20-int-summary strong{display:block;font-size:20px;margin-top:4px}.v20-int-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0 26px}.v20-int-card{border:1px solid #d4dbe2;background:#fff;padding:16px;min-width:0}.v20-int-head{display:flex;justify-content:space-between;gap:12px;align-items:center;border-bottom:1px solid #e2e6ea;padding-bottom:9px}.v20-int-head span{font-weight:900}.v20-int-head strong{font-size:11px}.v20-int-card dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#e1e5e9;border:1px solid #e1e5e9;margin:12px 0}.v20-int-card dl div{background:#fff;padding:9px}.v20-int-card dt{font-size:10px;color:#68737f}.v20-int-card dd{margin:3px 0 0;font-weight:800}.v20-int-card p{font-size:11px;line-height:1.6;color:#5d6976}.v20-int-hash{display:grid;gap:4px;margin:12px 0;padding:10px;background:#f6f8fa;border:1px solid #e0e5e9}.v20-int-hash span{font-size:10px;font-weight:800;color:#5f6975}.v20-int-hash code{font-size:10px;overflow-wrap:anywhere}.v20-int-note{color:#354457!important}.v20-int-card nav{display:flex;gap:10px;flex-wrap:wrap}.v20-int-card nav a{font-size:11px;font-weight:800;text-decoration:underline;text-underline-offset:3px}.v20-int-method{border-top:2px solid #17243a;border-bottom:1px solid #d3dae1;padding:18px 0;margin:24px 0}.v20-int-method h2{margin-top:0}.v20-int-method li{margin:6px 0;line-height:1.55;color:#536171}
@media(max-width:900px){.v20-int-grid{grid-template-columns:1fr}.v20-int-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.v20-int-summary{grid-template-columns:1fr 1fr}.v20-int-card dl{grid-template-columns:1fr 1fr}}
</style>`;
const page=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><meta name="googlebot" content="noindex,nofollow,noarchive,nosnippet"><title>공식 데이터 무결성·재현성 | 견적검수실</title><meta name="description" content="조달청 공식 가격 스냅샷의 SHA-256, 레코드·그룹·근거 연결 수와 구조 검증 결과를 확인합니다."><link rel="canonical" href="${SITE}/data/g2b-data-integrity/">${styles}${pageStyle}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Dataset',name:'조달청 공식 가격 데이터 무결성 매니페스트',description:'정제 스냅샷과 근거 연결의 구조 검증 및 SHA-256 체크섬',url:`${SITE}/data/g2b-data-integrity/`,dateModified:manifest.reviewed_on,creator:{'@type':'Organization',name:'조달청'}})}</script></head><body class="v20-integrity-ui">${header}<main id="main-content" data-v20-integrity-page><section class="v20-int-hero"><div class="site-shell"><p class="kicker">DATA INTEGRITY</p><h1>공식 데이터 무결성·재현성</h1><p>현재 프리뷰가 어떤 정제 스냅샷을 사용했는지 SHA-256으로 식별하고, 레코드·그룹·근거 연결과 필수 메타데이터가 구조적으로 맞는지 확인합니다. 체크섬은 가격이 맞다거나 민간 견적이 적정하다는 보증이 아닙니다.</p><div class="v20-int-summary"><div><span>공식 원천</span><strong>${integrity.length}</strong></div><div><span>연결 evidence</span><strong>${manifest.evidence_count}</strong></div><div><span>구조 검증</span><strong>3 / 3 통과</strong></div><div><span>해시 알고리즘</span><strong>SHA-256</strong></div></div></div></section><div class="site-shell"><section class="v20-int-grid">${cards}</section><section class="v20-int-method"><h2>무엇을 검증하나요</h2><ul><li>정제 스냅샷 파일 바이트의 SHA-256을 기록해 같은 빌드가 같은 데이터를 사용했는지 확인합니다.</li><li>스키마 버전·수집 상태·수집 시각·레코드·그룹·evidence 연결·API operation·금지 필드 미포함을 검사합니다.</li><li>evidence 핵심 필드도 별도 SHA-256으로 기록해 공식 참고값 연결 내용의 변화를 구분합니다.</li><li>임의의 최신성 일수 기준은 만들지 않습니다. 실제 수집 상태와 공식 기준일은 수집 상태 페이지에서 따로 확인합니다.</li><li>체크섬 변경은 내용이 바뀌었다는 신호일 뿐 가격 상승·하락, 비쌈·쌈·적정 판단을 의미하지 않습니다.</li></ul><p><a href="${BASE}/data/g2b-data-integrity-v20.json">기계가독 무결성 매니페스트 JSON</a></p></section></div></main>${footer}${scripts}</body></html>`;
write('data/g2b-data-integrity/index.html',page);

const strip=`<aside class="v20-integrity-strip" data-v20-integrity-strip><strong>데이터 무결성</strong><span>현재 정제 스냅샷의 SHA-256·구조 검증·근거 연결 수를 확인합니다.</span><a href="${BASE}/data/g2b-data-integrity/">무결성 보기</a></aside>`;
const stripStyle=`<style data-v20-integrity-strip-style>.v20-integrity-strip{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:18px 0;padding:10px 12px;border-top:1px solid #cfd6dd;border-bottom:1px solid #cfd6dd;font-size:12px}.v20-integrity-strip strong{font-weight:900}.v20-integrity-strip span{color:#5b6674}.v20-integrity-strip a{margin-left:auto;font-weight:800;text-decoration:underline;text-underline-offset:3px}@media(max-width:620px){.v20-integrity-strip{align-items:flex-start;flex-direction:column}.v20-integrity-strip a{margin-left:0}}</style>`;
const targets=['data/index.html','data/methodology/index.html','data/g2b-evidence/index.html','data/g2b-source-health/index.html','data/g2b-materials/index.html','data/g2b-market-construction/index.html','data/g2b-standard-market-unit/index.html'];
let injected=0;
for(const rel of targets){
  let h=read(rel);if(!/noindex,nofollow/.test(h))throw new Error(`${rel} lost preview noindex`);
  if(!h.includes('data-v20-integrity-strip-style'))h=h.replace('</head>',stripStyle+'</head>');
  if(!h.includes('<aside class="v20-integrity-strip" data-v20-integrity-strip>'))h=h.replace('</main>',strip+'</main>');
  write(rel,h);if(h.includes('<aside class="v20-integrity-strip" data-v20-integrity-strip>'))injected++;
}

try{const cat=json('data/dataset-catalog.json',{datasets:[]});cat.datasets=arr(cat.datasets);if(!cat.datasets.some(x=>x.id==='g2b-integrity-v20'))cat.datasets.push({id:'g2b-integrity-v20',type:'INTEGRITY',name:'공식 데이터 무결성·재현성',status:'preview',scope:'3개 조달청 정제 스냅샷 SHA-256·구조 검증·evidence 연결',period:manifest.reviewed_on,page:`${BASE}/data/g2b-data-integrity/`,json:`${BASE}/data/g2b-data-integrity-v20.json`,source:'정제 G2B 스냅샷 + evidence index',not_for:'민간 적정가격 판정 또는 임의 최신성 판정'});write('data/dataset-catalog.json',JSON.stringify(cat,null,2))}catch{}
try{const search=json('data/search-index.json',[]);if(Array.isArray(search)&&!search.some(x=>x.url===`${BASE}/data/g2b-data-integrity/`)){search.push({title:'공식 데이터 무결성·재현성',url:`${BASE}/data/g2b-data-integrity/`,type:'데이터',description:'조달청 정제 스냅샷의 SHA-256과 구조 검증 결과',keywords:['공식 데이터 무결성','조달청 체크섬','데이터 출처 검증']});write('data/search-index.json',JSON.stringify(search,null,2))}}catch{}
try{let ll=read('llms.txt');if(!ll.includes('/data/g2b-data-integrity/'))ll+=`\n## Official data integrity\n- ${SITE}/data/g2b-data-integrity/ — SHA-256 identifiers and structural checks for the three sanitized PPS/G2B snapshots.\n- ${SITE}/data/g2b-data-integrity-v20.json — machine-readable reproducibility manifest. Checksums indicate content identity, not price direction or private-market fairness.\n`;write('llms.txt',ll)}catch{}

const audit={version:VERSION,reviewed_on:manifest.reviewed_on,source_count:integrity.length,evidence_count:manifest.evidence_count,all_structural_checks_pass:true,hash_algorithm:'SHA-256',unique_source_hashes:new Set(integrity.map(x=>x.source_sha256)).size,unique_evidence_hashes:new Set(integrity.map(x=>x.evidence_sha256)).size,strip_target_count:targets.length,strip_injected_count:injected,strip_targets:targets,freshness_threshold_assumed:false,automatic_price_judgment:false,private_market_average:false,scope_equivalence_assumed:false,forbidden_fields_absent:!forbidden.test(JSON.stringify(manifest)),preview_noindex:true,production_switch:false,search_console_submission:false,ads_injected:false};
write('data/g2b-data-integrity-audit-v20.json',JSON.stringify(audit,null,2));
console.log(`v20 integrity batch6: ${integrity.length} sources / ${manifest.evidence_count} evidence / ${injected} linked surfaces / SHA-256`);
