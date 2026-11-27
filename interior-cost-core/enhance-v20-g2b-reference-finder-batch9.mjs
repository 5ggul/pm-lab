import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve('docs/interior-cost-preview');
const VERSION='20.13.0';
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const norm=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ');
const unitNorm=u=>{const x=String(u??'').trim();return ['㎡','m2','M2','m²','M²','m^2','M^2'].includes(x)?'㎡':x};
const sha=s=>crypto.createHash('sha1').update(String(s)).digest('hex').slice(0,12);

const quote=json('data/g2b-quote-compare-v20.json',{});
const evidencePayload=json('data/g2b-evidence-index-v20.json',{});
const coverage=json('data/g2b-reference-coverage-v20.json',{});
const refs=Array.isArray(quote.references)?quote.references:[];
const evidence=Array.isArray(evidencePayload.evidence)?evidencePayload.evidence:[];
if(refs.length<300||!Array.isArray(quote.units)||quote.units.length<10)throw new Error('reference finder requires broad quote compare pool');
if(quote.same_unit_filter_only!==true||quote.scope_equivalence_assumed!==false||quote.automatic_price_judgment!==false||quote.user_input_persisted!==false)throw new Error('reference finder source safety contract changed');
if(evidence.length!==65)throw new Error('reference finder requires 65 mapped evidence rows');
if(coverage.summary?.core_total!==11||coverage.summary?.cost_total!==8)throw new Error('reference finder requires batch8 coverage contract');

const sourceMeta={
  material:{label:'시설공통자재',operation:'getPriceInfoListFcltyCmmnMtrilBildng',source_page:`${BASE}/data/g2b-materials/`},
  market:{label:'건축 시장시공가격',operation:'getPriceInfoListMrktCnstrctPcBildng',source_page:`${BASE}/data/g2b-market-construction/`},
  standard:{label:'건축공사 표준시장단가',operation:'getStdMarkUprcinfoList',source_page:`${BASE}/data/g2b-standard-market-unit/`}
};
const evidenceMap=new Map();
for(const e of evidence){
  for(const text of [e.item_label,e.detail].filter(Boolean)){
    const key=`${e.source}|${unitNorm(e.unit)}|${norm(text)}`;
    if(!evidenceMap.has(key))evidenceMap.set(key,new Set());
    evidenceMap.get(key).add(e.evidence_id);
  }
}
const linkedEvidence=r=>{
  const out=new Set();
  for(const text of [r.label,r.detail].filter(Boolean)){
    const set=evidenceMap.get(`${r.source}|${unitNorm(r.unit_key||r.unit)}|${norm(text)}`);
    if(set)for(const id of set)out.add(id);
  }
  return [...out].sort();
};
const candidates=refs.map(r=>{
  const meta=sourceMeta[r.source]||{};
  return {
    candidate_id:`g2b-candidate-${sha([r.source,r.id,r.label,r.detail,r.unit_key].join('|'))}`,
    source:r.source,source_label:r.source_label||meta.label||r.source,
    label:String(r.label||''),detail:String(r.detail||''),scope:String(r.scope||''),
    unit_key:unitNorm(r.unit_key||r.unit),record_count:Number(r.record_count||0),
    low_krw:r.low_krw??null,median_krw:r.median_krw??null,high_krw:r.high_krw??null,
    range_label:String(r.range_label||''),date:String(r.date||''),
    linked_evidence_ids:linkedEvidence(r),dataset_id:'15129415',operation:meta.operation||null,
    source_page:meta.source_page||null,official_dataset_url:'https://www.data.go.kr/data/15129415/openapi.do'
  };
});
const ids=new Set(candidates.map(x=>x.candidate_id));
if(ids.size!==candidates.length)throw new Error(`reference finder candidate id collision ${ids.size}/${candidates.length}`);
const units=[...new Set(candidates.map(x=>x.unit_key).filter(Boolean))].sort((a,b)=>a==='㎡'?-1:b==='㎡'?1:String(a).localeCompare(String(b),'ko'));
const sourceCounts=Object.fromEntries(Object.keys(sourceMeta).map(k=>[k,candidates.filter(x=>x.source===k).length]));
const linkedCount=candidates.filter(x=>x.linked_evidence_ids.length).length;
const payload={version:VERSION,reviewed_on:quote.reviewed_on||null,candidate_count:candidates.length,unit_count:units.length,units,source_counts:sourceCounts,evidence_linked_candidate_count:linkedCount,candidates,
  search_contract:{unit_required:true,keyword_required:true,minimum_keyword_length:2,lexical_all_tokens:true,fuzzy_matching:false,semantic_similarity:false,query_infers_unit:false,automatic_reference_selection:false,automatic_category_mapping:false},
  same_unit_only:true,scope_equivalence_assumed:false,automatic_price_judgment:false,private_market_average:false,user_input_persisted:false,server_transmission:false,preview_noindex:true,production_switch:false,search_console_submission:false,ads_injected:false};
write('data/g2b-reference-finder-v20.json',JSON.stringify(payload,null,2));

const template=read('quote-check/index.html');
const header=template.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=template.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const links=[...template.matchAll(/<link rel="stylesheet" href="[^"]+">/g)].map(m=>m[0]).join('');
const scripts=[...template.matchAll(/<script src="[^"]+" defer><\/script>/g)].map(m=>m[0]).join('');
if(!header||!footer)throw new Error('reference finder shell missing');
const options=units.map(u=>`<option value="${esc(u)}">${esc(u)} · ${candidates.filter(x=>x.unit_key===u).length}개</option>`).join('');
const embedded=JSON.stringify(payload).replace(/</g,'\\u003c');
const style=`<style data-v20-reference-finder-style>
.v20-find{padding:30px 0 56px}.v20-find h1{font-size:clamp(28px,5vw,42px);letter-spacing:-.04em}.v20-find-lead{max-width:930px;color:#536171;line-height:1.7}.v20-find-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#d9dfe5;border:1px solid #d9dfe5;margin:18px 0}.v20-find-summary div{background:#fff;padding:12px}.v20-find-summary span{display:block;font-size:11px;color:#687582}.v20-find-summary strong{display:block;margin-top:4px;font-size:18px}.v20-find-controls{display:grid;grid-template-columns:180px minmax(220px,1fr) 210px;gap:10px;padding:16px 0;border-top:2px solid #17243a;border-bottom:1px solid #d7dee5}.v20-find-controls label{display:grid;gap:5px;font-size:11px;font-weight:800;color:#5c6874}.v20-find-controls input,.v20-find-controls select{width:100%;min-width:0;border:1px solid #bfc9d2;background:#fff;padding:10px;font:inherit}.v20-find-state{padding:12px 0;color:#536171;font-size:12px}.v20-find .table-wrap{overflow:auto;border:1px solid #d7dee5}.v20-find table{width:100%;border-collapse:collapse;min-width:980px}.v20-find th,.v20-find td{padding:10px;border-bottom:1px solid #e0e5ea;text-align:left;vertical-align:top;font-size:12px}.v20-find th{background:#f5f7f9}.v20-find td strong,.v20-find td code{overflow-wrap:anywhere}.v20-find td small{display:block;margin-top:4px;color:#6b7783;line-height:1.5}.v20-find-id{font-size:10px;color:#6b7783}.v20-find-links{display:flex;gap:6px;flex-wrap:wrap}.v20-find-links a{font-size:11px;font-weight:700}.v20-find-boundary{margin-top:18px;border:1px solid #d7dee5;background:#fafbfc;padding:13px;color:#536171;font-size:12px;line-height:1.65}.v20-find-entry{margin:20px auto;padding:12px 0;border-top:1px solid #cfd7df;border-bottom:1px solid #cfd7df;font-size:12px;line-height:1.6;color:#566472}.v20-find-entry strong{color:#17243a}.v20-find-entry a{font-weight:800}.v20-find-unavailable-link{display:inline-block;margin-top:8px;font-weight:800}
@media(max-width:760px){.v20-find-summary{grid-template-columns:1fr 1fr}.v20-find-controls{grid-template-columns:1fr}.v20-find-controls input,.v20-find-controls select{font-size:16px}}
</style>`;
const pageScript=`<script data-v20-reference-finder-script>(()=>{'use strict';const root=document.querySelector('[data-v20-reference-finder]');if(!root)return;let data={candidates:[]};try{data=JSON.parse(root.querySelector('[data-v20-reference-finder-data]').textContent||'{}')}catch{}const all=Array.isArray(data.candidates)?data.candidates:[],unit=root.querySelector('[data-v20-find-unit]'),q=root.querySelector('[data-v20-find-query]'),source=root.querySelector('[data-v20-find-source]'),state=root.querySelector('[data-v20-find-state]'),body=root.querySelector('[data-v20-find-body]'),count=root.querySelector('[data-v20-find-count]');const h=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),money=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v).toLocaleString('ko-KR',{maximumFractionDigits:0})+'원':'-',norm=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' '),tokens=s=>norm(s).split(/[\s,\/|]+/).filter(Boolean),params=new URLSearchParams(location.search);const render=()=>{const u=unit.value||'',query=q.value.trim(),src=source.value||'';count.textContent='0';if(!u){state.textContent='단위를 먼저 선택하세요. 검색어만으로 단위를 추정하지 않습니다.';body.innerHTML='<tr><td colspan="9">단위 선택 대기</td></tr>';return}if(query.length<2){state.textContent='선택 단위 '+u+' · 품목 검색어를 2자 이상 입력하세요. 유사어·의미 검색은 사용하지 않습니다.';body.innerHTML='<tr><td colspan="9">검색어 입력 대기</td></tr>';return}const ts=tokens(query),found=all.filter(r=>r.unit_key===u&&(!src||r.source===src)&&ts.every(t=>norm([r.label,r.detail,r.scope].join(' ')).includes(t))).sort((a,b)=>({material:0,market:1,standard:2}[a.source]-({material:0,market:1,standard:2}[b.source]))||String(a.label).localeCompare(String(b.label),'ko'));count.textContent=String(found.length);state.textContent='선택 단위 '+u+' · 문자 일치 '+found.length+'개'+(found.length>100?' · 앞 100개 표시, 검색어를 더 좁혀주세요':'')+' · 자동 추천/적정성 판정 없음';const rows=found.slice(0,100);body.innerHTML=rows.length?rows.map(r=>'<tr data-v20-find-result data-unit="'+h(r.unit_key)+'" data-source="'+h(r.source)+'"><td><strong>'+h(r.source_label)+'</strong><small>'+h(r.scope)+'</small></td><td><strong>'+h(r.label||'-')+'</strong><small>'+h(r.detail||'')+'</small><code class="v20-find-id">'+h(r.candidate_id)+'</code></td><td>'+h(r.unit_key)+'</td><td><strong>'+money(r.median_krw)+'</strong><small>'+h(r.range_label||'')+' '+money(r.low_krw)+' ~ '+money(r.high_krw)+'</small></td><td>'+Number(r.record_count||0).toLocaleString('ko-KR')+'</td><td>'+h(r.date||'-')+'</td><td>'+(r.linked_evidence_ids?.length?r.linked_evidence_ids.map(x=>'<code>'+h(x)+'</code>').join('<br>'):'<small>기존 공종 매핑 evidence 없음</small>')+'</td><td><code>'+h(r.operation||'-')+'</code></td><td><div class="v20-find-links"><a href="'+h(r.source_page||'#')+'">원천 페이지</a><a href="'+h(r.official_dataset_url||'#')+'">공식 데이터셋</a></div></td></tr>').join(''):'<tr><td colspan="9">같은 단위에서 입력한 문자와 일치하는 후보가 없습니다.</td></tr>'};for(const el of [unit,q,source]){el.addEventListener('input',render);el.addEventListener('change',render)}if(params.get('unit')&&[...unit.options].some(o=>o.value===params.get('unit')))unit.value=params.get('unit');if(params.get('q'))q.value=params.get('q');if(params.get('source')&&[...source.options].some(o=>o.value===params.get('source')))source.value=params.get('source');render()})();</script>`;
const canonical=SITE+'/data/g2b-reference-finder/';
const page=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><meta name="googlebot" content="noindex,nofollow,noarchive,nosnippet"><title>공식 참고 항목 직접 찾기 | 견적검수실</title><meta name="description" content="조달청 공식 참고 후보를 사용자가 단위를 먼저 선택한 뒤 품목 문자로 직접 찾습니다. 자동 공종 매핑이나 가격 적정성 판정은 하지 않습니다."><link rel="canonical" href="${canonical}">${links}${style}</head><body>${header}<main id="main-content" class="v20-find" data-v20-reference-finder><div class="site-shell"><p class="kicker">MANUAL REFERENCE FINDER</p><h1>공식 참고 항목 직접 찾기</h1><p class="v20-find-lead">자동 연결 범위 밖의 항목도 공식 데이터 풀에서 직접 확인할 수 있습니다. 단위를 먼저 선택하고 공개 품목명에 포함된 문자를 검색합니다. 유사어 추정, 의미 검색, 공종 자동 분류, 가격 적정성 판정은 사용하지 않습니다.</p><div class="v20-find-summary"><div><span>검색 후보</span><strong>${candidates.length.toLocaleString('ko-KR')}</strong></div><div><span>단위</span><strong>${units.length}</strong></div><div><span>공식 원천</span><strong>3</strong></div><div><span>기존 evidence 연결 후보</span><strong>${linkedCount.toLocaleString('ko-KR')}</strong></div></div><div class="v20-find-controls"><label>단위 먼저 선택<select data-v20-find-unit><option value="">단위 선택</option>${options}</select></label><label>공개 품목 문자<input data-v20-find-query placeholder="예: 타일 · 배선 · 창호" autocomplete="off"></label><label>원천<select data-v20-find-source><option value="">전체 원천</option><option value="material">시설공통자재</option><option value="market">건축 시장시공가격</option><option value="standard">건축공사 표준시장단가</option></select></label></div><div class="v20-find-state" data-v20-find-state>단위를 먼저 선택하세요.</div><p class="v20-find-state">현재 결과 <strong data-v20-find-count>0</strong>개</p><div class="table-wrap"><table><thead><tr><th>원천</th><th>공개 품목</th><th>단위</th><th>공개 참고값</th><th>N</th><th>기준일</th><th>기존 evidence</th><th>API operation</th><th>출처</th></tr></thead><tbody data-v20-find-body><tr><td colspan="9">단위 선택 대기</td></tr></tbody></table></div><div class="v20-find-boundary"><strong>검색 결과 해석</strong><br>결과는 선택한 단위와 입력한 문자가 공개 품목명에 함께 존재한다는 뜻입니다. 규격·공사범위·VAT·납품·설치 조건이 같다는 뜻이 아니며, 결과 순서는 적합도·가격 순위가 아닙니다. 찾은 후보를 민간 아파트 시장평균이나 적정견적으로 자동 변환하지 않습니다.</div><p class="v20-find-state"><a href="${BASE}/data/g2b-reference-coverage/">자동 연결 범위</a> · <a href="${BASE}/data/g2b-evidence/">65개 매핑 근거 인덱스</a> · <a href="${BASE}/data/g2b-quote-compare/">동일 단위 직접 비교</a> · <a href="${BASE}/data/g2b-reference-finder-v20.json">finder JSON</a></p><script type="application/json" data-v20-reference-finder-data>${embedded}</script></div></main>${footer}${scripts}${pageScript}</body></html>`;
write('data/g2b-reference-finder/index.html',page);

const entryTargets=['data/index.html','data/g2b-reference-coverage/index.html','data/g2b-quote-compare/index.html','data/g2b-evidence/index.html','data/g2b-source-health/index.html','data/g2b-data-integrity/index.html'];
let entryInjected=0;
for(const rel of entryTargets){const f=path.join(ROOT,rel);if(!fs.existsSync(f))continue;let p=read(rel);if(!p.includes('data-v20-reference-finder-style'))p=p.replace('</head>',style+'</head>');if(!p.includes('data-v20-reference-finder-entry')){const block=`<section class="v20-find-entry site-shell" data-v20-reference-finder-entry><strong>공식 항목 직접 찾기</strong> · 단위를 먼저 선택하고 394개 공식 후보에서 품목 문자를 직접 검색 · <a href="${BASE}/data/g2b-reference-finder/">finder 열기</a></section>`;p=p.replace('</main>',block+'</main>');entryInjected++}write(rel,p)}

const slugQuery={bathroom:'욕실',kitchen:'주방',window:'창호',wallpaper:'도배',floor:'바닥',demolition:'철거',electrical:'전기',carpentry:'목공'};
let unavailableLinks=0;
for(const item of coverage.cost_pages||[]){if(item.status!=='unavailable')continue;const rel=`cost/${item.slug}/index.html`,f=path.join(ROOT,rel);if(!fs.existsSync(f))continue;let p=read(rel);if(!p.includes('data-v20-reference-finder-style'))p=p.replace('</head>',style+'</head>');if(!p.includes('data-v20-finder-unavailable-link')){const q=encodeURIComponent(slugQuery[item.slug]||item.slug);const link=`<p data-v20-finder-unavailable-link><a class="v20-find-unavailable-link" href="${BASE}/data/g2b-reference-finder/?q=${q}">공식 데이터 풀에서 품목 직접 찾기</a> · 단위는 직접 선택</p>`;p=p.replace(/(<section[^>]*data-v20-coverage-unavailable[^>]*>[\s\S]*?)(<\/section>)/,`$1${link}$2`);unavailableLinks++}write(rel,p)}

const audit={version:VERSION,reviewed_on:quote.reviewed_on||null,candidate_count:candidates.length,unit_count:units.length,source_counts:sourceCounts,evidence_linked_candidate_count:linkedCount,entry_target_count:entryTargets.length,entry_injected_count:entryInjected,unavailable_cost_count:(coverage.cost_pages||[]).filter(x=>x.status==='unavailable').length,unavailable_links_injected:unavailableLinks,unit_required:true,query_infers_unit:false,lexical_all_tokens:true,fuzzy_matching:false,semantic_similarity:false,automatic_reference_selection:false,automatic_category_mapping:false,same_unit_only:true,scope_equivalence_assumed:false,automatic_price_judgment:false,private_market_average:false,user_input_persisted:false,server_transmission:false,preview_noindex:true,production_switch:false,search_console_submission:false,ads_injected:false};
write('data/g2b-reference-finder-audit-v20.json',JSON.stringify(audit,null,2));
console.log(`v20 reference finder batch9: ${candidates.length} candidates / ${units.length} units / ${linkedCount} evidence-linked / ${entryTargets.length} entry surfaces`);
