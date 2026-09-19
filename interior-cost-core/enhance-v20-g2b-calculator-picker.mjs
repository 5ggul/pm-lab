import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const VERSION='20.4.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const ROWS={
  demolition:{label:'철거',keywords:['철거','해체','철거공']},
  waste:{label:'폐기물',keywords:['폐기물','폐기','반출']},
  waterproof:{label:'방수',keywords:['방수','도막방수','시트방수']},
  bathroom:{label:'욕실',keywords:['욕실','화장실','위생','타일']},
  kitchen:{label:'주방',keywords:['주방','싱크','싱크대','주방가구']},
  wallpaper:{label:'도배',keywords:['도배','벽지']},
  flooring:{label:'바닥',keywords:['바닥','마루','장판','타일','바닥재']},
  carpentry:{label:'목공',keywords:['목공','합판','각재','석고보드','목재']},
  electrical:{label:'전기',keywords:['전기','배선','전선','조명','배관배선']},
  window:{label:'샷시',keywords:['샷시','창호','창문','창틀']},
  management:{label:'현장관리비',keywords:['현장관리','관리비','현장관리비']}
};
const matches=(text,keywords)=>{
  const hay=String(text||'').toLowerCase();
  return keywords.filter(k=>hay.includes(String(k).toLowerCase()));
};

const dataPath='data/g2b-calculator-reference-v20.json';
const auditPath='data/g2b-calculator-reference-audit-v20.json';
const data=json(dataPath,{});
if(!data.same_unit_only||!data.category_keyword_gate||data.scope_equivalence_assumed||data.automatic_price_judgment||data.private_market_average)throw new Error('calculator picker requires guarded v20.3 reference payload');
if(!Array.isArray(data.references)||data.references.length<20)throw new Error('calculator picker reference payload missing');

const enriched=data.references.map(r=>{
  const row=ROWS[r.row_key]||{keywords:[]};
  const found=matches([r.item_label,r.detail].filter(Boolean).join(' '),row.keywords);
  return {...r,matched_keywords:found,match_basis_label:`동일 단위 ${r.unit_key||'-'} · 공종 키워드 ${found.join(' · ')||'원문 매칭'}`};
});
const byRowUnit={};
for(const r of enriched){
  const key=`${r.row_key}|${r.unit_key}`;
  if(!byRowUnit[key])byRowUnit[key]={row_key:r.row_key,unit_key:r.unit_key,procurement:0,standard:0,keywords:new Set()};
  if(r.source==='standard')byRowUnit[key].standard+=1;
  else if(r.source==='market'||r.source==='material')byRowUnit[key].procurement+=1;
  for(const k of r.matched_keywords||[])byRowUnit[key].keywords.add(k);
}
const candidateGroups=Object.values(byRowUnit).map(x=>({...x,keywords:[...x.keywords]})).sort((a,b)=>String(a.row_key).localeCompare(String(b.row_key))||String(a.unit_key).localeCompare(String(b.unit_key),'ko'));
const multiCandidateGroups=candidateGroups.filter(x=>x.procurement>1||x.standard>1).length;
const payload={...data,version:VERSION,references:enriched,candidate_groups:candidateGroups,manual_candidate_selection:true,automatic_reference_selection:'suggestion_only',match_keywords_exposed:true,client_choice_persisted:false,candidate_limit_per_source_unit:3};
write(dataPath,JSON.stringify(payload,null,2));
const oldAudit=json(auditPath,{});
write(auditPath,JSON.stringify({...oldAudit,version:VERSION,reference_count:enriched.length,candidate_group_count:candidateGroups.length,multi_candidate_group_count:multiCandidateGroups,manual_candidate_selection:true,automatic_reference_selection:'suggestion_only',match_keywords_exposed:true,client_choice_persisted:false,same_unit_only:true,category_keyword_gate:true,scope_equivalence_assumed:false,automatic_price_judgment:false,private_market_average:false,user_input_persisted:false,preview_noindex:true,production_switch:false,note:'동일 단위+공종 키워드 후보를 자동 제안하되 복수 후보는 사용자가 직접 바꿀 수 있음. 규격·공사범위·VAT·납품/설치 조건의 동등성 및 가격 적정성은 판정하지 않음.'},null,2));

const calcPath='calculator/index.html';
let page=read(calcPath);
if(!page.includes('data-v20-calc-public-compare')||!page.includes('data-v20-calc-public-script'))throw new Error('calculator picker requires v20.3 calculator integration');
if(!/noindex,nofollow/.test(page))throw new Error('calculator picker requires preview noindex');
const embedded=JSON.stringify(payload).replace(/</g,'\\u003c');
page=page.replace(/(<script type="application\/json" data-v20-calc-public-data>)[\s\S]*?(<\/script>)/,`$1${embedded}$2`);
page=page.replace('data-v20-calc-public-judgment="none"','data-v20-calc-public-judgment="none" data-v20-calc-public-manual-selection="true"');

const pickerStyle=`<style data-v20-calc-public-picker-style>
.v20-calc-public-picker{display:grid;gap:5px;margin:9px 0 10px}.v20-calc-public-picker span{font-size:11px;font-weight:800;color:#5a6472}.v20-calc-public-picker select{width:100%;min-width:0;border:1px solid #cbd3dc;background:#fff;padding:8px 9px;font:inherit;font-size:12px;color:#17243a}.v20-calc-public-match{display:block;margin-top:7px;padding-top:7px;border-top:1px solid #edf0f3;font-size:11px;color:#566173;line-height:1.45}.v20-calc-public-mode{display:inline-block;margin-left:5px;font-weight:800;color:#1b3a6b}.v20-calc-public-card[data-v20-calc-public-choice="manual"]{box-shadow:inset 0 2px 0 #1b3a6b}@media(max-width:760px){.v20-calc-public-picker select{font-size:16px}}
</style>`;
if(!page.includes('data-v20-calc-public-picker-style'))page=page.replace('</head>',pickerStyle+'</head>');

const pickerScript=`<script data-v20-calc-public-script>(()=>{'use strict';const root=document.querySelector('[data-v20-calc-public-compare]'),builder=document.querySelector('[data-budget-builder]');if(!root||!builder)return;let data={references:[],rows:{}};try{data=JSON.parse(root.querySelector('[data-v20-calc-public-data]')?.textContent||'{}')}catch{}const refs=Array.isArray(data.references)?data.references:[],choice={};const results=root.querySelector('[data-v20-calc-public-results]'),state=root.querySelector('[data-v20-calc-public-state]');const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));const money=v=>finite(v)?Number(v).toLocaleString('ko-KR',{maximumFractionDigits:0})+'원':'-';const html=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');const unitNorm=u=>{const raw=String(u??'').trim();return ['㎡','m2','M2','m²','M²','m^2','M^2'].includes(raw)?'㎡':raw};const sorted=list=>[...list].sort((a,b)=>(b.match_score-a.match_score)||(b.record_count-a.record_count)||String(a.item_label||'').localeCompare(String(b.item_label||''),'ko'));const candidates=(rowKey,kind,unit)=>sorted(refs.filter(r=>r.row_key===rowKey&&r.unit_key===unit&&(kind==='standard'?r.source==='standard':(r.source==='market'||r.source==='material')))).sort((a,b)=>kind==='procurement'?((a.source==='market'?0:1)-(b.source==='market'?0:1))||((b.match_score||0)-(a.match_score||0))||((b.record_count||0)-(a.record_count||0)):((b.match_score||0)-(a.match_score||0))||((b.record_count||0)-(a.record_count||0)));const chosen=(rowKey,kind,list)=>{if(!list.length)return null;const id=choice[rowKey+'|'+kind];return list.find(r=>r.id===id)||list[0]};const componentText=r=>{if(!r)return'';const bits=[['재료',r.material_cost_krw],['노무',r.labor_cost_krw],['경비',r.expense_krw]].filter(([,v])=>finite(v));return bits.length?'공개 구성 중앙값 · '+bits.map(([k,v])=>k+' '+money(v)).join(' · '):''};const picker=(rowKey,kind,list,selected)=>{if(!list.length)return'';const key=rowKey+'|'+kind,manual=Boolean(choice[key]&&list.some(r=>r.id===choice[key]));if(list.length===1)return '<span class="v20-calc-public-mode">후보 1개</span>';const label=kind==='standard'?'공공 공사 후보':'공공 조달 후보';return '<label class="v20-calc-public-picker"><span>'+label+' '+list.length+'개 · 직접 선택 가능</span><select data-v20-calc-public-picker data-v20-calc-public-picker-row="'+html(rowKey)+'" data-v20-calc-public-picker-kind="'+html(kind)+'">'+list.map(r=>'<option value="'+html(r.id)+'"'+(selected&&r.id===selected.id?' selected':'')+'>'+html(r.source_label)+' · '+html(r.item_label)+' · '+money(r.median_krw)+'/'+html(r.unit_key)+' · N='+Number(r.record_count||0).toLocaleString('ko-KR')+'</option>').join('')+'</select></label><span class="v20-calc-public-mode">'+(manual?'직접 선택':'자동 제안')+'</span>'};const refCard=(title,rowKey,kind,list,r,qty)=>{if(!r)return '<div class="v20-calc-public-card"><span>'+html(title)+'</span><b>-</b><small class="v20-calc-public-empty">비교 가능한 공공 참고값 없음</small></div>';const key=rowKey+'|'+kind,manual=Boolean(choice[key]&&list.some(x=>x.id===choice[key])),total=finite(qty)&&Number(qty)>0?Number(r.median_krw)*Number(qty):null,comp=componentText(r),match=(r.matched_keywords||[]).join(' · ')||'원문 매칭';return '<div class="v20-calc-public-card" data-v20-calc-public-card data-v20-calc-public-source="'+html(r.source)+'" data-v20-calc-public-choice="'+(manual?'manual':'suggested')+'">'+picker(rowKey,kind,list,r)+'<span>'+html(title)+'</span><b>'+money(r.median_krw)+' / '+html(r.unit_key)+'</b><small>'+html(r.source_label)+' · '+html(r.item_label)+'<br>'+html(r.date||'게시일 미기재')+' · N='+Number(r.record_count||0).toLocaleString('ko-KR')+' · '+html(r.coverage_label)+(finite(total)?'<br>수량 합계 '+money(total):'')+(comp?'<div class="v20-calc-public-components">'+html(comp)+'</div>':'')+'<span class="v20-calc-public-match">매칭 키워드 '+html(match)+' · 동일 단위 '+html(r.unit_key)+' · 규격/범위 미확인</span></small></div>'};const render=()=>{const entered=[];for(const row of builder.querySelectorAll('[data-budget-row]')){const key=row.getAttribute('data-budget-row')||'',included=row.querySelector('[data-included]')?.value!=='no',priceMan=Number(row.querySelector('[data-unit-price]')?.value||0),qtyRaw=row.querySelector('[data-qty]')?.value??'',qty=finite(qtyRaw)?Number(qtyRaw):null,unit=unitNorm(row.querySelector('[data-unit]')?.value||'');if(!included||!Number.isFinite(priceMan)||priceMan<=0)continue;const userPrice=priceMan*10000,pList=unit?candidates(key,'procurement',unit):[],sList=unit?candidates(key,'standard',unit):[],procurement=chosen(key,'procurement',pList),standard=chosen(key,'standard',sList);entered.push({key,label:data.rows?.[key]?.label||key,unit,qty,userPrice,pList,sList,procurement,standard})}root.dataset.v20CalcPublicHasInput=entered.length?'true':'false';if(!entered.length){state.textContent='단가를 입력하면 같은 단위의 공공 참고값을 확인합니다.';results.innerHTML='';return}const matched=entered.reduce((n,x)=>n+(x.procurement?1:0)+(x.standard?1:0),0),multi=entered.reduce((n,x)=>n+(x.pList.length>1?1:0)+(x.sList.length>1?1:0),0);state.textContent='입력 공종 '+entered.length+'개 · 동일 단위 공공 참고값 '+matched+'개 · 복수 후보 '+multi+'곳은 직접 바꿀 수 있습니다.';results.innerHTML=entered.map(x=>{const userTotal=finite(x.qty)&&x.qty>0?x.userPrice*x.qty:null,barItems=[{name:'내 견적',v:x.userPrice},x.procurement&&{name:'공공 조달',v:x.procurement.median_krw},x.standard&&{name:'공공 공사',v:x.standard.median_krw}].filter(Boolean),max=Math.max(1,...barItems.map(b=>Number(b.v)||0)),bars=barItems.map(b=>'<div class="v20-calc-public-bar"><span>'+html(b.name)+'</span><div class="v20-calc-public-track"><i style="width:'+Math.max(2,Math.round(Number(b.v)/max*100))+'%"></i></div><strong>'+money(b.v)+'</strong></div>').join('');return '<article class="v20-calc-public-row" data-v20-calc-public-row="'+html(x.key)+'"><div class="v20-calc-public-rowhead"><strong>'+html(x.label)+'</strong><span>'+html(x.unit||'단위 미입력')+(finite(x.qty)&&x.qty>0?' · 수량 '+html(x.qty):'')+'</span></div><div class="v20-calc-public-grid"><div class="v20-calc-public-card" data-v20-calc-public-user><span>내 견적 단가</span><b>'+money(x.userPrice)+(x.unit?' / '+html(x.unit):'')+'</b><small>'+(finite(userTotal)?'수량 합계 '+money(userTotal):'수량을 입력하면 합계를 표시합니다.')+'</small></div>'+refCard('공공 조달 참고',x.key,'procurement',x.pList,x.procurement,x.qty)+refCard('공공 공사 참고',x.key,'standard',x.sList,x.standard,x.qty)+'</div><div class="v20-calc-public-bars">'+bars+'</div></article>'}).join('')};builder.addEventListener('input',render);builder.addEventListener('change',render);root.addEventListener('change',e=>{const el=e.target.closest?.('[data-v20-calc-public-picker]');if(!el)return;choice[(el.dataset.v20CalcPublicPickerRow||'')+'|'+(el.dataset.v20CalcPublicPickerKind||'')]=el.value;render()});render()})();</script>`;
page=page.replace(/<script data-v20-calc-public-script>[\s\S]*?<\/script>/,pickerScript);
if(!page.includes('data-v20-calc-public-picker'))throw new Error('calculator picker injection failed');
write(calcPath,page);

console.log(`v20 calculator picker: ${enriched.length} refs / ${candidateGroups.length} row-unit groups / ${multiCandidateGroups} multi-candidate groups`);
