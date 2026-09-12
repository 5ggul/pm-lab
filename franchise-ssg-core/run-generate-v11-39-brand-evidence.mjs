import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const cssPath=path.join(out,'assets/site.css');
const manifestPath=path.join(out,'route-manifest.json');
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const won=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'미공개';
const num=v=>finite(v)?Math.round(Number(v)).toLocaleString('ko-KR'):'미공개';
const pct=v=>finite(v)?`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%`:'미공개';
const norm=r=>r==='/'?'/':`/${String(r||'').split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`;
const fileFor=r=>path.join(out,...norm(r).split('/').filter(Boolean),'index.html');
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
if(snap.brand_count!==136||snap.category_count!==20||candidates.length!==184)throw new Error(`v11.39 baseline ${snap.brand_count}/${snap.category_count}/${candidates.length}`);

const medianSentence=(label,value,median,formatter=won)=>{
  if(!finite(value)||!finite(median))return `${label}은 비교 가능한 공개값이 없어 업종 중앙값 차이를 계산하지 않았습니다.`;
  const d=Number(value)-Number(median),p=Number(median)!==0?d/Number(median)*100:null;
  return `${label}은 ${formatter(value)}로 업종 중앙값 ${formatter(median)}보다 ${Math.abs(d).toLocaleString('ko-KR',{maximumFractionDigits:1})}${label==='가맹점'?'개':'만원'} ${d===0?'같고':d<0?'낮으며':'높으며'}${finite(p)?` 비율 차이는 ${p>=0?'+':''}${p.toFixed(1)}%입니다.`:'.'}`;
};
const td=v=>`<td>${esc(v)}</td>`;
const th=v=>`<th scope="row">${esc(v)}</th>`;

function componentsInfo(b){
  const parts=[['가맹비',b.components?.franchise],['교육비',b.components?.education],['보증금',b.components?.deposit],['기타',b.components?.etc]];
  const total=parts.reduce((s,[,v])=>s+(finite(v)?Number(v):0),0);
  const largest=[...parts].filter(([,v])=>finite(v)).sort((a,z)=>Number(z[1])-Number(a[1]))[0]||null;
  const rows=parts.map(([name,value])=>{const share=finite(value)&&total>0?Number(value)/total*100:null;return `<tr>${th(name)}${td(won(value))}${td(finite(share)?`${share.toFixed(1)}%`:'—')}</tr>`}).join('');
  const text=largest?`공개비용 구성에서 가장 큰 항목은 ${largest[0]} ${won(largest[1])}이며 공개비용 구성 합계 ${won(total)}의 ${(Number(largest[1])/Math.max(1,total)*100).toFixed(1)}%입니다. 가맹비·교육비·보증금의 0원 공개값은 누락으로 바꾸지 않고 공시된 값 그대로 보존합니다.`:'비용구성 세부 공개값이 충분하지 않아 최대 구성 항목을 계산하지 않았습니다.';
  return {rows,text,total};
}
function metricRows(b,c){
  const defs=[
    ['공개 창업비용',b.cost,c.cost,won],
    ['가맹점 수',b.stores,c.stores,v=>finite(v)?`${num(v)}개`:'미공개'],
    ['가맹점 연간 평균매출',b.sales,c.sales,won],
    ['3.3㎡당 연간 평균매출',b.salesPerArea,c.salesPerArea,won]
  ];
  return defs.map(([label,value,s,fmt])=>`<tr>${th(label)}${td(fmt(value))}${td(fmt(s?.median))}${td(`${fmt(s?.p25)} ~ ${fmt(s?.p75)}`)}${td(`${s?.count??0}개`)}</tr>`).join('');
}
function historyInfo(b){
  const rows=(b.history||[]).filter(x=>finite(x.year)&&finite(x.stores)).slice(-3);
  const tableRows=rows.length?rows.map(x=>`<tr>${th(String(x.year))}${td(`${num(x.stores)}개`)}${td(finite(x.newStores)?`${num(x.newStores)}개`:'미공개')}${td(finite(x.contractEnd)?`${num(x.contractEnd)}개`:'미공개')}${td(finite(x.contractCancel)?`${num(x.contractCancel)}개`:'미공개')}</tr>`).join(''):`<tr><th scope="row">공개 이력</th><td colspan="4">비교 가능한 점포 이력이 없습니다.</td></tr>`;
  let text='비교 가능한 점포 이력이 없어 기준연도 간 점포 수 변화를 계산하지 않았습니다.';
  if(rows.length>=2){const first=rows[0],last=rows.at(-1),d=Number(last.stores)-Number(first.stores),rate=Number(first.stores)>0?d/Number(first.stores)*100:null;text=`${first.year}년 ${num(first.stores)}개에서 ${last.year}년 ${num(last.stores)}개로 ${Math.abs(d).toLocaleString('ko-KR')}개 ${d===0?'변화가 없었고':d>0?'늘었고':'줄었고'}${finite(rate)?` 해당 구간 변화율은 ${rate>=0?'+':''}${rate.toFixed(1)}%입니다.`:'.'} 신규·계약종료·계약해지는 각 기준연도 공개값을 별도 열로 유지합니다.`}
  return {tableRows,text,count:rows.length};
}
function evidence(b){
  const c=snap.categories?.[b.categorySlug];if(!c)throw new Error(`v11.39 category missing ${b.slug}`);
  const comp=componentsInfo(b),hist=historyInfo(b);
  const costText=medianSentence('공개 창업비용',b.cost,c.cost?.median,won);
  const storeText=medianSentence('가맹점',b.stores,c.stores?.median,v=>finite(v)?`${num(v)}개`:'미공개');
  const salesText=positive(b.sales)?medianSentence('가맹점 연간 평균매출',b.sales,c.sales?.median,won):'가맹점 연간 평균매출은 양수 공개값이 확인되지 않아 0원 매출로 해석하지 않고 미공개로 처리했으며, 업종 평균매출 순위와 분포 표본에서도 제외했습니다.';
  const areaText=positive(b.salesPerArea)?medianSentence('3.3㎡당 연간 평균매출',b.salesPerArea,c.salesPerArea?.median,won):finite(b.salesPerArea)&&Number(b.salesPerArea)===0?'3.3㎡당 평균매출 원자료는 0으로 공개되어 원자료 표에는 그대로 남기되, 양수값을 사용하는 업종 분포와 순위 계산에서는 제외했습니다.':'3.3㎡당 평균매출은 비교 가능한 공개값이 없어 업종 분포 비교를 계산하지 않았습니다.';
  return `<!-- v11.39 brand evidence --><section class="v35-panel v39-evidence" id="evidence" data-v39-evidence="1"><div class="v35-section-head"><h2>공개자료 상세</h2><span>${esc(b.categoryName)} · 공정위 ${esc(b.sourceYear)}</span></div><div class="v39-summary"><p>${esc(costText)} ${esc(storeText)}</p><p>${esc(salesText)} ${esc(areaText)}</p><p>${esc(hist.text)} ${esc(comp.text)}</p></div><h3>핵심지표와 업종 분포</h3><div class="v39-table-wrap"><table class="data-table v39-table" data-v39-table="metrics"><thead><tr><th>지표</th><th>브랜드</th><th>업종 중앙</th><th>P25 ~ P75</th><th>표본</th></tr></thead><tbody>${metricRows(b,c)}</tbody></table></div><h3>공개 창업비용 구성</h3><div class="v39-table-wrap"><table class="data-table v39-table v39-compact" data-v39-table="components"><thead><tr><th>항목</th><th>공개값</th><th>구성비</th></tr></thead><tbody>${comp.rows}</tbody></table></div><h3>기준연도별 점포 이력</h3><div class="v39-table-wrap"><table class="data-table v39-table" data-v39-table="history"><thead><tr><th>기준연도</th><th>가맹점</th><th>신규</th><th>계약종료</th><th>계약해지</th></tr></thead><tbody>${hist.tableRows}</tbody></table></div><div class="v39-reading"><h3>표를 읽을 때</h3><p>업종 중앙값과 P25·P75는 이 사이트의 동일한 신뢰 스냅샷에서 같은 업종으로 분류된 브랜드만 사용합니다. 각 지표의 표본 수는 공개 여부가 달라 서로 다를 수 있으며, 누락값을 0으로 채우지 않습니다. 평균매출은 가맹점의 공개 매출 지표이지 영업이익이나 점주 순수익이 아니며, 창업비용은 정보공개서 공개 범위이므로 임대보증금·권리금·철거·전기증설·냉난방·추가장비·운전자금 등의 실제 부담 범위는 계약 전 별도로 확인해야 합니다.</p><p>점포 수 증감과 신규·종료·해지 이력은 과거 공개실적의 변화만 보여주며 미래 수익성이나 출점 성공률을 예측하는 점수로 사용하지 않습니다. 브랜드 간 비교는 동일 지표·동일 기준연도·동일 단위를 맞춘 뒤 확인하는 용도이며, 본사 제공 최신 개설비가 별도로 있는 브랜드는 공정위 공개비용과 기준시점 및 포함항목이 다를 수 있습니다.</p></div></section><!-- v11.39 brand evidence end -->`;
}

let patched=0,metricsTables=0,componentTables=0,historyTables=0;
for(const b of snap.brands){
  const file=fileFor(b.route);let html=await fs.readFile(file,'utf8');
  html=html.replace(/<!-- v11\.39 brand evidence -->[\s\S]*?<!-- v11\.39 brand evidence end -->/g,'');
  const anchor='<!-- v11.35 brand workspace end -->';if(!html.includes(anchor))throw new Error(`v11.39 workspace anchor missing ${b.slug}`);
  html=html.replace(anchor,`${evidence(b)}${anchor}`);
  if(html.includes('<a href="#raw-data">원자료</a>')&&!html.includes('<a href="#evidence">상세표</a>'))html=html.replace('<a href="#raw-data">원자료</a>','<a href="#raw-data">원자료</a><a href="#evidence">상세표</a>');
  await fs.writeFile(file,html,'utf8');patched++;metricsTables++;componentTables++;historyTables++;
}

let css=await fs.readFile(cssPath,'utf8');
css=css.replace(/\/\* v11\.39 brand evidence \*\/[\s\S]*?\/\* v11\.39 brand evidence end \*\//g,'').trimEnd();
css+=`\n/* v11.39 brand evidence */\n.v39-evidence{border-top:2px solid var(--ink,#171717)}.v39-summary{max-width:980px;margin-bottom:22px}.v39-summary p,.v39-reading p{margin:8px 0;line-height:1.72;color:var(--muted,#68655f);font-size:13px}.v39-evidence h3{margin:24px 0 9px;font-size:15px}.v39-table-wrap{max-width:100%;overflow-x:auto;overscroll-behavior:contain}.v39-table{min-width:720px}.v39-table th,.v39-table td{padding:10px 9px;font-size:12px;vertical-align:middle}.v39-table th:first-child,.v39-table td:first-child{min-width:150px}.v39-compact{min-width:520px;max-width:720px}.v39-reading{margin-top:22px;padding-top:4px;border-top:1px solid var(--line,#d8d5cf)}@media(max-width:760px){.v39-table{min-width:680px}.v39-compact{min-width:500px}.v39-summary p,.v39-reading p{font-size:12px;line-height:1.68}}\n/* v11.39 brand evidence end */\n`;
await fs.writeFile(cssPath,css,'utf8');

const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.39';manifest.v11_39={brandEvidence:true,brandPages:patched,tablesPerBrand:3,trustedSnapshotOnly:true,noSyntheticValues:true,candidateSetChanged:false,indexPolicyChanged:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
const report={schemaVersion:1,uiVersion:'11.39',generatedAt:new Date().toISOString(),snapshot:snap.snapshot_id,brandPages:patched,metricsTables,componentTables,historyTables,totalTables:metricsTables+componentTables+historyTables,policy:'TRUSTED_SNAPSHOT_ONLY;THREE_EVIDENCE_TABLES_PER_BRAND;MISSING_NOT_ZERO;NO_RECOMMENDATION_SCORE;NO_CANDIDATE_CHANGE;NO_INDEX_CHANGE',productionDeployed:false};
await fs.writeFile(path.join(out,'v11-39-brand-evidence.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_39BrandEvidence:'PASS',brandPages:patched,totalTables:report.totalTables,productionDeployed:false},null,2));
