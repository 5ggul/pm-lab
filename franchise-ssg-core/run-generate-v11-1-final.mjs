import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {brandSlugFor} from './routing-v3.mjs';
import {matchOfficialBrands} from './official-merge.mjs';

await import(`./run-generate-v11-final.mjs?v111=${Date.now()}`);

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
const hitByName=new Map(matched.matches.map(x=>[x.brand.name,x]));
const brandBySlug=new Map(catalog.brands.map(b=>[brandSlugFor(b.name,b.slug),b]));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>finite(n)?Number(n).toLocaleString('ko-KR'):'정보 없음';

function historySvg(name,history){
  const w=800,h=270,l=70,r=30,t=28,b=48;
  const values=history.map(x=>Number(x.stores));
  const max=Math.max(...values,1),min=Math.min(...values,0);
  const spread=Math.max(1,max-min);
  const pad=spread*.12;
  const lo=Math.max(0,min-pad),hi=max+pad;
  const sx=i=>history.length===1?l:l+i*(w-l-r)/(history.length-1);
  const sy=v=>t+(hi-Number(v))/(hi-lo)*(h-t-b);
  const points=history.map((x,i)=>`${sx(i).toFixed(1)},${sy(x.stores).toFixed(1)}`).join(' ');
  const dots=history.map((x,i)=>`<circle cx="${sx(i).toFixed(1)}" cy="${sy(x.stores).toFixed(1)}" r="5"><title>${esc(x.year)} 기준 · ${fmt(x.stores)}개</title></circle><text x="${sx(i).toFixed(1)}" y="${(h-18)}" text-anchor="middle">${esc(x.year)}</text><text x="${sx(i).toFixed(1)}" y="${Math.max(16,sy(x.stores)-12).toFixed(1)}" text-anchor="middle">${fmt(x.stores)}</text>`).join('');
  return `<svg class="chart-svg history-three-year" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(name)} 최근 3개 공정위 공개 기준년도 가맹점 추이"><title>${esc(name)} 최근 3개 공정위 공개 기준년도 가맹점 추이</title><desc>공정위 공개자료의 기준년도별 가맹점 수입니다. 각 기준년도의 신규점·계약종료·계약해지는 아래 표에서 함께 확인합니다.</desc><polyline points="${points}" fill="none" stroke="#2457D6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
}

function historySection(name,record){
  const history=(record?.storeHistory||[])
    .filter(x=>finite(x?.stores)&&finite(x?.year))
    .sort((a,b)=>Number(a.year)-Number(b.year))
    .slice(-3);
  if(history.length<3)return null;
  const rows=history.map(x=>`<tr><td data-label="공정위 기준년도">${esc(x.year)}</td><td data-label="가맹점" class="num">${fmt(x.stores)}개</td><td data-label="신규점" class="num">${finite(x.newStores)?`${fmt(x.newStores)}개`:'정보 없음'}</td><td data-label="계약종료" class="num">${finite(x.contractEnd??x.ended)?`${fmt(x.contractEnd??x.ended)}개`:'정보 없음'}</td><td data-label="계약해지" class="num">${finite(x.contractCancel??x.cancelled)?`${fmt(x.contractCancel??x.cancelled)}개`:'정보 없음'}</td></tr>`).join('');
  return `<section class="block" id="stores"><h2>${esc(name)} 가맹점은 최근 3개 기준년도에 어떻게 변했나요?</h2><p>한 시점의 점포 증감만으로 성장성·안정성·수익성을 단정하지 않습니다. 공정위 공개 기준년도별 가맹점 수와 신규점·계약종료·계약해지를 함께 확인합니다.</p>${historySvg(name,history)}<div class="table-scroll"><table class="data-table stack-mobile history-table"><thead><tr><th>공정위 기준년도</th><th class="num">가맹점</th><th class="num">신규점</th><th class="num">계약종료</th><th class="num">계약해지</th></tr></thead><tbody>${rows}</tbody></table></div><div class="chart-legend">각 숫자는 해당 공정위 공개자료의 기준년도 값입니다. 개별 점포의 순이익이나 향후 성과를 뜻하지 않습니다.</div></section>`;
}

const brandRoot=path.join(out,'brands');
const entries=await fs.readdir(brandRoot,{withFileTypes:true});
let historyPatched=0;
for(const entry of entries){
  if(!entry.isDirectory())continue;
  const file=path.join(brandRoot,entry.name,'index.html');
  try{
    let html=await fs.readFile(file,'utf8');
    html=html
      .replace(/(\d{4})년 공개 창업비용 중앙값/g,'공정위 기준년도 $1 창업비용 중앙값')
      .replace(/(\d{4})년 공개 창업비용/g,'공정위 기준년도 $1 창업비용')
      .replace(/(\d{4})년 공개비용/g,'공정위 기준년도 $1 공개비용')
      .replace(/<small>(\d{4}) · 공식 공개합계<\/small>/g,'<small>공정위 기준년도 $1 · 공개합계</small>');
    const brand=brandBySlug.get(entry.name);
    const hit=brand?hitByName.get(brand.name):null;
    const section=brand&&hit?historySection(brand.name,hit.record):null;
    if(section&&/<section class="block" id="stores">[\s\S]*?<\/section>/.test(html)){
      html=html.replace(/<section class="block" id="stores">[\s\S]*?<\/section>/,section);
      historyPatched++;
    }
    await fs.writeFile(file,html,'utf8');
  }catch(err){if(err?.code!=='ENOENT')throw err}
}

// Apply the same reference-year wording to all generated HTML metadata and visible copy where the phrase is unambiguous.
const allHtml=[];
async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))allHtml.push(p)}}
await walk(out);
for(const file of allHtml){
  let html=await fs.readFile(file,'utf8');
  html=html
    .replace(/(\d{4})년 공개 창업비용 중앙값/g,'공정위 기준년도 $1 창업비용 중앙값')
    .replace(/(\d{4})년 공개 창업비용/g,'공정위 기준년도 $1 창업비용')
    .replace(/(\d{4})년 공개비용/g,'공정위 기준년도 $1 공개비용');
  await fs.writeFile(file,html,'utf8');
}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.1 history */')){
  css+=`\n/* v11.1 history */\n.history-three-year{margin-top:18px}.history-three-year text{font-size:12px;fill:#5f5952}.history-three-year circle{fill:#2457d6;stroke:#fff;stroke-width:2}.history-table{margin-top:10px}@media(max-width:720px){.history-three-year{min-width:620px}.history-table th:first-child,.history-table td:first-child{position:sticky;left:0;background:#fff;z-index:1}}\n`;
  await fs.writeFile(cssPath,css,'utf8');
}

const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.v11_1={referenceYearMetaCleanup:true,brandHistoryYearsDisplayed:3,historyPagesPatched:historyPatched};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const baseReport=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const report={schemaVersion:1,generatedAt:new Date().toISOString(),uiVersion:'11.1',previewMode:baseReport.previewMode,historyPagesPatched,brandHistoryYearsDisplayed:3,productionCandidates:baseReport.indexPolicy?.productionCandidateUrls?.length||0,strictEligibleBrands:(baseReport.strictBrands||[]).filter(x=>x.eligible).length,remainingProductionBlockers:baseReport.productionBlockers||[]};
await fs.writeFile(path.join(out,'v11-1-quality-report.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_1:'PASS',historyPagesPatched,productionCandidates:report.productionCandidates,strictEligibleBrands:report.strictEligibleBrands},null,2));
