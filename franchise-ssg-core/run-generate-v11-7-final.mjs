import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {brandSlugFor} from './routing-v3.mjs';
import {matchOfficialBrands} from './official-merge.mjs';
import {summarizeStoreHistorySuppression} from './official-history.mjs';

await import(`./run-generate-v11-6-final.mjs?v117=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');

async function loadClassic(file,expr){
  const code=await fs.readFile(file,'utf8');
  const ctx={console};
  vm.createContext(ctx);
  vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);
  return ctx.__EXPORT__;
}

const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
const official=JSON.parse(await fs.readFile(path.join(repo,'data/franchise/official/brands-2025.json'),'utf8'));
const matched=matchOfficialBrands(catalog.brands,official);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>finite(n)?Number(n).toLocaleString('ko-KR'):'정보 없음';

function coverageLabel(history){
  return history.length>=3?'최근 3개 기준년도':`확인 가능한 ${history.length}개 기준년도`;
}

function historySvg(name,history){
  const w=800,h=270,l=70,r=30,t=28,b=48;
  const values=history.map(x=>Number(x.stores));
  const max=Math.max(...values,1),min=Math.min(...values,0);
  const spread=Math.max(1,max-min);
  const pad=spread*.12;
  const lo=Math.max(0,min-pad),hi=max+pad;
  const sx=i=>history.length===1?(l+(w-l-r)/2):l+i*(w-l-r)/(history.length-1);
  const sy=v=>t+(hi-Number(v))/(hi-lo)*(h-t-b);
  const points=history.map((x,i)=>`${sx(i).toFixed(1)},${sy(x.stores).toFixed(1)}`).join(' ');
  const dots=history.map((x,i)=>`<circle cx="${sx(i).toFixed(1)}" cy="${sy(x.stores).toFixed(1)}" r="5"><title>${esc(x.year)} 기준 · ${fmt(x.stores)}개</title></circle><text x="${sx(i).toFixed(1)}" y="${h-18}" text-anchor="middle">${esc(x.year)}</text><text x="${sx(i).toFixed(1)}" y="${Math.max(16,sy(x.stores)-12).toFixed(1)}" text-anchor="middle">${fmt(x.stores)}</text>`).join('');
  const line=history.length>1?`<polyline points="${points}" fill="none" stroke="#2457D6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`:'';
  const label=coverageLabel(history);
  return `<svg class="chart-svg history-three-year" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(name)} ${esc(label)} 가맹점 추이"><title>${esc(name)} ${esc(label)} 가맹점 추이</title><desc>공정위 공개자료의 기준년도별 가맹점 수입니다. 신규점·계약종료·계약해지는 아래 표에서 함께 확인합니다.</desc>${line}${dots}</svg>`;
}

function historySection(name,record){
  const raw=Array.isArray(record?.storeHistory)?record.storeHistory:[];
  const {sanitized,suppressed}=summarizeStoreHistorySuppression(raw);
  const history=sanitized
    .filter(x=>finite(x?.stores)&&finite(x?.year))
    .sort((a,b)=>Number(a.year)-Number(b.year))
    .slice(-3);
  if(!history.length)return {html:null,suppressed,displayed:0};
  const rows=history.map(x=>`<tr><td data-label="공정위 기준년도">${esc(x.year)}</td><td data-label="가맹점" class="num">${fmt(x.stores)}개</td><td data-label="신규점" class="num">${finite(x.newStores)?`${fmt(x.newStores)}개`:'정보 없음'}</td><td data-label="계약종료" class="num">${finite(x.contractEnd??x.ended)?`${fmt(x.contractEnd??x.ended)}개`:'정보 없음'}</td><td data-label="계약해지" class="num">${finite(x.contractCancel??x.cancelled)?`${fmt(x.contractCancel??x.cancelled)}개`:'정보 없음'}</td></tr>`).join('');
  const note=suppressed.length?'<div class="chart-legend">핵심 지표가 모두 0으로 채워진 빈 이력 행은 실제 0으로 단정하지 않고 추이에서 제외했습니다.</div>':'<div class="chart-legend">각 숫자는 해당 공정위 공개자료의 기준년도 값입니다. 개별 점포의 순이익이나 향후 성과를 뜻하지 않습니다.</div>';
  const label=coverageLabel(history);
  return {html:`<section class="block" id="stores"><h2>${esc(name)} 가맹점은 ${esc(label)}에 어떻게 변했나요?</h2><p>한 시점의 점포 증감만으로 성장성·안정성·수익성을 단정하지 않습니다. 공정위 공개 기준년도별 가맹점 수와 신규점·계약종료·계약해지를 함께 확인합니다.</p>${historySvg(name,history)}<div class="table-scroll"><table class="data-table stack-mobile history-table"><thead><tr><th>공정위 기준년도</th><th class="num">가맹점</th><th class="num">신규점</th><th class="num">계약종료</th><th class="num">계약해지</th></tr></thead><tbody>${rows}</tbody></table></div>${note}</section>`,suppressed,displayed:history.length};
}

const findings=[];
const renderedLeaks=[];
let historyPagesPatched=0;
let shortHistoryPages=0;
for(const hit of matched.matches){
  const slug=brandSlugFor(hit.brand.name,hit.brand.slug);
  const file=path.join(out,'brands',slug,'index.html');
  const section=historySection(hit.brand.name,hit.record);
  if(section.suppressed.length){
    findings.push({
      name:hit.brand.name,
      slug,
      years:section.suppressed.map(row=>Number(row.year)).filter(Number.isFinite),
      suppressedRows:section.suppressed.length
    });
  }
  if(!section.html)continue;
  let html=await fs.readFile(file,'utf8');
  if(!/<section class="block" id="stores">[\s\S]*?<\/section>/.test(html))continue;
  html=html.replace(/<section class="block" id="stores">[\s\S]*?<\/section>/,section.html);
  await fs.writeFile(file,html,'utf8');
  historyPagesPatched++;
  if(section.displayed<3)shortHistoryPages++;
  for(const row of section.suppressed){
    const year=Number(row.year);
    if(!Number.isFinite(year))continue;
    const leak=`<td data-label="공정위 기준년도">${year}</td><td data-label="가맹점" class="num">0개</td>`;
    if(html.includes(leak))renderedLeaks.push({name:hit.brand.name,slug,year});
  }
}

const suppressedPlaceholderRows=findings.reduce((sum,item)=>sum+item.suppressedRows,0);
const report={
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  uiVersion:'11.7',
  policy:'ALL_CORE_HISTORY_METRICS_ZERO_WITH_POSITIVE_SIBLING_OBSERVATION_IS_NOT_TREATED_AS_FACTUAL_ZERO',
  matchedBrands:matched.matches.length,
  historyPagesPatched,
  shortHistoryPages,
  affectedBrands:findings.length,
  suppressedPlaceholderRows,
  findings,
  renderedPlaceholderLeaks
};
await fs.writeFile(path.join(out,'v11-7-history-trust.json'),JSON.stringify(report,null,2),'utf8');

const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.7';
manifest.v11_7={
  historyPlaceholderSuppression:true,
  matchedBrands:matched.matches.length,
  historyPagesPatched,
  affectedBrands:findings.length,
  suppressedPlaceholderRows,
  renderedPlaceholderLeaks:renderedLeaks.length
};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

if(renderedLeaks.length){
  console.error(JSON.stringify({v11_7:'FAIL',renderedLeaks},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_7:'PASS',matchedBrands:matched.matches.length,historyPagesPatched,affectedBrands:findings.length,suppressedPlaceholderRows,renderedPlaceholderLeaks:0},null,2));
