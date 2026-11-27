import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const VERSION='20.7.0';
const BASE='/pm-lab/interior-cost-preview';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const data=json('data/g2b-calculator-reference-v20.json',{}),refs=Array.isArray(data.references)?data.references:[];
if(refs.length<20||!data.same_unit_only||!data.category_keyword_gate||data.automatic_price_judgment||data.private_market_average)throw new Error('workflow batch3 requires guarded official reference payload');
const preview=(h,n)=>{if(!/noindex,nofollow/.test(h))throw new Error(`${n} must remain noindex`)};

const rowKeys=['demolition','waste','waterproof','bathroom','kitchen','wallpaper','flooring','carpentry','electrical','window','management'];
const coverage=rowKeys.map(key=>{
  const list=refs.filter(r=>r.row_key===key),units=[...new Set(list.map(r=>r.unit_key).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ko')),sources=[...new Set(list.map(r=>r.source))];
  return {row_key:key,label:data.rows?.[key]?.label||key,reference_count:list.length,units,sources,multi_candidate_units:units.filter(u=>list.filter(r=>r.unit_key===u).length>1)};
});
const coveragePayload={version:VERSION,reviewed_on:data.reviewed_on||null,rows:coverage,total_reference_count:refs.length,covered_rows:coverage.filter(x=>x.reference_count>0).length,same_unit_only:true,category_keyword_gate:true,scope_equivalence_assumed:false,automatic_price_judgment:false,private_market_average:false,session_handoff_only:true,server_transmission:false,production_switch:false};
write('data/g2b-workflow-coverage-v20.json',JSON.stringify(coveragePayload,null,2));

const style=`<style data-v20-qb3-style>
.v20-qb3-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.v20-qb3-actions button,.v20-qb3-actions a{border:1px solid #aeb9c4;background:#fff;color:#173252;padding:9px 11px;font:inherit;font-size:12px;font-weight:800;text-decoration:none;cursor:pointer}.v20-qb3-note{padding:10px 12px;border-left:3px solid #1b3a6b;background:#f7f9fa;color:#4f5c69;font-size:12px;line-height:1.55;margin:12px 0}.v20-qb3-coverage{margin:22px 0;padding:18px 0;border-top:2px solid #17243a;border-bottom:1px solid #d3d9df}.v20-qb3-coverage h2{margin:0 0 8px}.v20-qb3-covergrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#d8dee4;border:1px solid #d8dee4}.v20-qb3-cover{background:#fff;padding:12px;min-width:0}.v20-qb3-cover strong{display:block;margin-bottom:4px}.v20-qb3-cover span{display:block;font-size:11px;color:#5e6975;line-height:1.45}.v20-qb3-handoff{margin:12px 0;padding:11px 12px;border:1px solid #b9c5cf;background:#f8fafb;color:#344455;font-size:12px;line-height:1.55}.v20-qb3-handoff strong{color:#173252}.v20-qb3-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid #d4dbe1;background:#fff;margin:12px 0}.v20-qb3-summary>div{padding:11px;border-right:1px solid #d4dbe1}.v20-qb3-summary>div:last-child{border-right:0}.v20-qb3-summary span{display:block;font-size:11px;color:#65717c}.v20-qb3-summary strong{display:block;font-size:18px;color:#17243a;margin-top:2px}
@media(max-width:760px){.v20-qb3-covergrid{grid-template-columns:1fr 1fr}.v20-qb3-summary{grid-template-columns:1fr 1fr}.v20-qb3-summary>div:nth-child(2){border-right:0}.v20-qb3-summary>div:nth-child(-n+2){border-bottom:1px solid #d4dbe1}}
@media(max-width:430px){.v20-qb3-covergrid,.v20-qb3-summary{grid-template-columns:1fr}.v20-qb3-summary>div{border-right:0;border-bottom:1px solid #d4dbe1}.v20-qb3-summary>div:last-child{border-bottom:0}}
</style>`;
const injectStyle=h=>h.includes('data-v20-qb3-style')?h:h.replace('</head>',style+'</head>');

// 1) quote-paste -> quote-check handoff. Amount/category only; qty/unit/spec remain blank.
{
  const rel='quote-paste/index.html';let page=read(rel);preview(page,'quote-paste');
  if(!page.includes('data-v20-qb2-paste')||!page.includes('data-v10-paste-tool'))throw new Error('quote-paste batch3 anchors missing');
  const actions=`<div class="v20-qb3-actions" data-v20-qb3-paste-actions><button type="button" data-v20-qb3-send-check>분류 금액을 견적 검사로 보내기</button><span class="v20-qb3-note">공종과 금액만 세션으로 넘깁니다. 수량·단위·사양은 견적 검사에서 직접 확인해야 공식 참고단가 비교가 열립니다.</span></div>`;
  if(!page.includes('data-v20-qb3-paste-actions'))page=page.replace('<div class="v20-qb2-summary" data-v20-qb2-paste-state>',actions+'<div class="v20-qb2-summary" data-v20-qb2-paste-state>');
  page=injectStyle(page);
  const script=`<script data-v20-qb3-paste-script>(()=>{'use strict';const tool=document.querySelector('[data-v10-paste-tool]'),btn=document.querySelector('[data-v20-qb3-send-check]');if(!tool||!btn)return;btn.addEventListener('click',()=>{const rows=(tool._v10Rows||[]).filter(r=>r&&r.key&&r.key!=='unmatched'&&r.key!=='vat'&&Number.isFinite(Number(r.amount_manwon))),map={};for(const r of rows)map[r.key]=(map[r.key]||0)+Number(r.amount_manwon);const items=Object.entries(map).map(([row_key,amount_manwon])=>({row_key,amount_manwon,source_label:'견적 붙여넣기 분류'}));if(!items.length){btn.textContent='먼저 견적 텍스트를 분류하세요';return}sessionStorage.setItem('interior-v20-quote-handoff',JSON.stringify({version:'20.7.0',source:'quote-paste',items}));location.href='${BASE}/quote-check/#v20-handoff'})})();</script>`;
  if(!page.includes('data-v20-qb3-paste-script'))page=page.replace('</body>',script+'</body>');write(rel,page);
}

// 2) one-set -> quote-check handoff. One-set total is carried as amount only, never converted to unit price.
{
  const rel='one-set/index.html';let page=read(rel);preview(page,'one-set');
  if(!page.includes('data-v20-qb2-one')||!page.includes('data-one-set-amount'))throw new Error('one-set batch3 anchors missing');
  const actions=`<div class="v20-qb3-actions" data-v20-qb3-one-actions><button type="button" data-v20-qb3-one-send>1식 금액을 견적 검사로 보내기</button><span class="v20-qb3-note">1식 총액만 옮기며 수량·단위는 자동 가정하지 않습니다.</span></div>`;
  if(!page.includes('data-v20-qb3-one-actions'))page=page.replace('<div class="v20-qb2-one-controls">',actions+'<div class="v20-qb2-one-controls">');
  page=injectStyle(page);
  const script=`<script data-v20-qb3-one-script>(()=>{'use strict';const tool=document.querySelector('[data-one-set]'),btn=document.querySelector('[data-v20-qb3-one-send]');if(!tool||!btn)return;btn.addEventListener('click',()=>{const type=tool.querySelector('[data-one-set-type]')?.value||'',amount=Number(tool.querySelector('[data-one-set-amount]')?.value||0);if(!['bathroom','kitchen','window'].includes(type)||!Number.isFinite(amount)||amount<=0){btn.textContent='먼저 1식 금액을 입력하세요';return}sessionStorage.setItem('interior-v20-quote-handoff',JSON.stringify({version:'20.7.0',source:'one-set',items:[{row_key:type,amount_manwon:amount,source_label:'1식 해체'}]}));location.href='${BASE}/quote-check/#v20-handoff'})})();</script>`;
  if(!page.includes('data-v20-qb3-one-script'))page=page.replace('</body>',script+'</body>');write(rel,page);
}

// 3) quote-check receives local-session handoff. It never invents quantity/unit/spec.
{
  const rel='quote-check/index.html';let page=read(rel);preview(page,'quote-check');
  if(!page.includes('data-quote-form')||!page.includes('data-v20-qb-check'))throw new Error('quote-check batch3 anchors missing');
  const host=`<div class="v20-qb3-handoff" data-v20-qb3-handoff hidden><strong>이전 도구에서 가져온 견적</strong><span data-v20-qb3-handoff-text></span></div>`;
  if(!page.includes('data-v20-qb3-handoff'))page=page.replace('<form data-quote-form>',host+'<form data-quote-form>');
  page=injectStyle(page);
  const script=`<script data-v20-qb3-check-script>(()=>{'use strict';const apply=()=>{const host=document.querySelector('[data-v20-qb3-handoff]'),text=host?.querySelector('[data-v20-qb3-handoff-text]');let payload=null;try{payload=JSON.parse(sessionStorage.getItem('interior-v20-quote-handoff')||'null')}catch{}if(!payload||payload.version!=='20.7.0'||!Array.isArray(payload.items)||!payload.items.length)return;let applied=0;for(const item of payload.items){const row=document.querySelector('[data-qrow="'+CSS.escape(String(item.row_key||''))+'"]');if(!row)continue;const amount=row.querySelector('[data-q-amount]'),memo=row.querySelector('[data-q-memo]'),included=row.querySelector('[name="state-'+CSS.escape(String(item.row_key||''))+'"][value="included"]');if(amount&&Number.isFinite(Number(item.amount_manwon))){amount.value=String(item.amount_manwon);amount.dispatchEvent(new Event('input',{bubbles:true}));applied++}if(memo&&!memo.value)memo.value=String(item.source_label||'이전 도구에서 가져옴');if(included){included.checked=true;included.dispatchEvent(new Event('change',{bubbles:true}))}}sessionStorage.removeItem('interior-v20-quote-handoff');if(applied&&host&&text){host.hidden=false;text.textContent=' · '+applied+'개 공종의 금액만 반영했습니다. 수량·단위·사양을 입력하기 전에는 공식 단가와 비교하지 않습니다.'}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply()})();</script>`;
  if(!page.includes('data-v20-qb3-check-script'))page=page.replace('</body>',script+'</body>');write(rel,page);
}

// 4) Checklist gets a coverage map instead of fabricated prices.
{
  const rel='checklist/index.html';let page=read(rel);preview(page,'checklist');
  if(!page.includes('data-checklist'))throw new Error('checklist anchor missing');
  const covered=coverage.filter(x=>x.reference_count>0),cards=covered.map(x=>`<div class="v20-qb3-cover"><strong>${esc(x.label)}</strong><span>공식 후보 ${x.reference_count}개</span><span>단위 ${esc(x.units.join(' · '))}</span></div>`).join('');
  const block=`<section class="v20-qb3-coverage" data-v20-qb3-checklist><h2>공식 참고 데이터 연결 범위</h2><p class="v20-qb3-note">체크리스트는 계약 항목 누락을 확인하는 도구입니다. 아래 숫자는 가격이 아니라 현재 연결 가능한 공식 후보 수이며, 실제 견적 비교는 동일 공종·동일 단위에서만 진행합니다.</p><div class="v20-qb3-summary"><div><span>연결 공종</span><strong>${covered.length}</strong></div><div><span>공식 후보</span><strong>${refs.length}</strong></div><div><span>자동 적정가 판정</span><strong>없음</strong></div><div><span>민간 시장평균 대체</span><strong>안 함</strong></div></div><div class="v20-qb3-covergrid">${cards}</div><div class="v20-qb3-actions"><a href="${BASE}/quote-check/">받은 견적 검사</a><a href="${BASE}/data/g2b-quote-compare/">공식 항목 직접 비교</a></div></section>`;
  if(!page.includes('data-v20-qb3-checklist'))page=page.replace('<article class="tool-article">',block+'<article class="tool-article">');page=injectStyle(page);write(rel,page);
}

// 5) Scope-combination tool gets official-reference coverage, but still no cross-unit summation.
{
  const rel='cost-combination/index.html';let page=read(rel);preview(page,'cost-combination');
  if(!page.includes('data-v10-combo-tool'))throw new Error('cost-combination anchor missing');
  const bySource={material:refs.filter(r=>r.source==='material').length,market:refs.filter(r=>r.source==='market').length,standard:refs.filter(r=>r.source==='standard').length};
  const block=`<section class="v20-qb3-coverage" data-v20-qb3-combination><h2>공종 범위와 공식 참고자료</h2><p class="v20-qb3-note">공종 조합은 누락 범위를 확인하는 기능입니다. 공식 후보 ${refs.length}개가 연결되어 있지만 서로 다른 규격·단위·공사범위의 값을 합산해 총공사비로 만들지 않습니다.</p><div class="v20-qb3-summary"><div><span>시설공통자재 후보</span><strong>${bySource.material}</strong></div><div><span>시장시공가격 후보</span><strong>${bySource.market}</strong></div><div><span>표준시장단가 후보</span><strong>${bySource.standard}</strong></div><div><span>동일 단위 원칙</span><strong>필수</strong></div></div><div class="v20-qb3-actions"><a href="${BASE}/data/g2b-quote-compare/">동일 단위 공식 비교</a><a href="${BASE}/calculator/">예산 설계</a></div></section>`;
  if(!page.includes('data-v20-qb3-combination'))page=page.replace('</main>',block+'</main>');page=injectStyle(page);write(rel,page);
}

write('data/g2b-workflow-batch3-audit-v20.json',JSON.stringify({version:VERSION,reviewed_on:data.reviewed_on||null,reference_count:refs.length,covered_rows:coverage.filter(x=>x.reference_count>0).length,quote_paste_to_quote_check:true,one_set_to_quote_check:true,handoff_amount_only:true,handoff_quantity_inferred:false,handoff_unit_inferred:false,handoff_spec_inferred:false,session_handoff_only:true,checklist_coverage:true,cost_combination_coverage:true,same_unit_only:true,category_keyword_gate:true,scope_equivalence_assumed:false,automatic_price_judgment:false,private_market_average:false,server_transmission:false,preview_noindex:true,production_switch:false,search_console_submission:false,ads_injected:false},null,2));
console.log(`v20 workflow batch3: ${refs.length} refs / ${coverage.filter(x=>x.reference_count>0).length} covered rows / local handoff + checklist + combination`);
