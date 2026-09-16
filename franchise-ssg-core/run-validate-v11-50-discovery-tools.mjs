import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-50-discovery-tools.json'),'utf8'));
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const js=await fs.readFile(path.join(out,'assets/v50-discovery-tools.js'),'utf8');
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');
const snapshotDate=String(snap.snapshot_id||'').match(/(\d{4}-\d{2}-\d{2})$/)?.[1]||String(snap.fetched_at||'').slice(0,10);

const ui=Number(manifest.uiVersion);
if(!Number.isFinite(ui)||ui<11.50)err.push(`manifest ${manifest.uiVersion}`);
for(const k of ['trustedBrandFilter','categoryDecisionRails','rankingsExploreHandoff','toolContextCompletion','mobileDiscoveryReadability','v42VisualLanguagePreserved'])if(manifest.v11_50?.[k]!==true)err.push(`flag ${k}`);
if(manifest.v11_50?.candidateSetChanged!==false||manifest.v11_50?.indexPolicyChanged!==false||manifest.v11_50?.dataSemanticsChanged!==false||manifest.v11_50?.productionDeployed!==false||report.productionDeployed!==false)err.push('immutable contracts');
if(Number(snap.brand_count)!==136||Number(snap.category_count)!==20||candidates.length!==184)err.push(`counts ${snap.brand_count}/${snap.category_count}/${candidates.length}`);
for(const [k,v] of [['brandFilterCards',136],['categoryActionRails',16],['toolContextPages',7],['candidatePages',184]])if(Number(report[k])!==v)err.push(`report ${k}=${report[k]}`);
if(report.rankingsPatched!==true||report.explorePatched!==true)err.push('ranking/explore flags');

for(const token of ['/* v11.50 discovery tools */','/* v11.50 discovery tools end */','.v50-category-actions','.v50-decision-links','.v50-explore-state','.v50-tool-context','@media(max-width:430px)'])if(!css.includes(token))err.push(`css ${token}`);
for(const token of ['data-v50-explore-state','data-budget-form','data-v50-tool-context','queueMicrotask'])if(!js.includes(token))err.push(`js ${token}`);

const filter=await fs.readFile(fileFor('/tools/brand-filter/'),'utf8');
if(!filter.includes('data-v50-trusted-filter="1"'))err.push('trusted filter flag');
if(!filter.includes('<b id="conditionCount">136개</b>'))err.push('trusted filter count');
const box=filter.match(/<div id="conditionResults" class="brand-grid">([\s\S]*?)<\/div><\/section><section class="block"><h2>이 도구가 하지 않는 것<\/h2>/);
if(!box)err.push('filter result boundary');
else{
  const cards=(box[1].match(/data-v50-trusted-card="1"/g)||[]).length;
  if(cards!==136)err.push(`filter cards ${cards}`);
  const hrefs=[...box[1].matchAll(/<a href="([^"]+)"><h3>/g)].map(m=>m[1].replace('/pm-lab/franchise-ssg-preview',''));
  const expected=new Set((snap.brands||[]).map(b=>b.route));const actual=new Set(hrefs);
  if(actual.size!==expected.size||[...expected].some(r=>!actual.has(r))||[...actual].some(r=>!expected.has(r)))err.push(`filter trusted routes expected=${expected.size} actual=${actual.size}`);
}
if(/conditionCount">170개/.test(filter))err.push('legacy 170 filter count');

const candidateCats=candidates.map(r=>String(r).match(/^\/categories\/([^/]+)\/$/)?.[1]).filter(Boolean);
let categoryRails=0;
for(const slug of candidateCats){const h=await fs.readFile(fileFor(`/categories/${slug}/`),'utf8');if(h.includes('data-v50-category-actions="1"')&&h.includes(`/explore/?cat=${slug}#finder`)&&h.includes(`/rankings/${slug}/`))categoryRails++;else err.push(`category rail ${slug}`)}
if(categoryRails!==16)err.push(`category rails ${categoryRails}`);

const rankings=await fs.readFile(fileFor('/rankings/'),'utf8');
if(!rankings.includes('data-v50-ranking-actions="1"'))err.push('ranking actions');
if(!rankings.includes(`<span>갱신</span><strong>${snapshotDate}</strong>`))err.push('ranking freshness');
const explore=await fs.readFile(fileFor('/explore/'),'utf8');
for(const t of ['data-v50-explore-state-wrap','data-v50-explore-state','assets/v50-discovery-tools.js'])if(!explore.includes(t))err.push(`explore ${t}`);

const toolRoutes=['/tools/brand-filter/','/tools/break-even/','/tools/category-median/','/tools/disclosure-decoder/','/tools/monthly-fixed-cost/','/tools/monthly-profit-simulator/','/tools/open-close-rate/'];
let toolContexts=0;
for(const r of toolRoutes){const h=await fs.readFile(fileFor(r),'utf8');if(h.includes('data-v50-tool-context="1"')&&h.includes('계산·누락값 기준')&&h.includes('assets/v50-discovery-tools.js'))toolContexts++;else err.push(`tool context ${r}`)}
if(toolContexts!==7)err.push(`tool contexts ${toolContexts}`);

let v49Brands=0;for(const b of snap.brands||[]){const h=await fs.readFile(fileFor(b.route),'utf8');if(h.includes('data-v49-cost-checks="1"')&&h.includes('data-v48-brand-distinct="1"'))v49Brands++;else err.push(`v49 brand lost ${b.slug}`)}
if(v49Brands!==136)err.push(`v49 brands ${v49Brands}`);
const compare=await fs.readFile(fileFor('/compare/'),'utf8');if(!compare.includes('data-v49-compare-live'))err.push('v49 compare lost');
const startup=await fs.readFile(fileFor('/tools/startup-cost/'),'utf8');if(!startup.includes('data-v49-startup-summary'))err.push('v49 startup lost');

let noindex=0;for(const r of candidates){const h=await fs.readFile(fileFor(r),'utf8');if(h.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))noindex++;else err.push(`noindex ${r}`)}if(noindex!==184)err.push(`noindex ${noindex}`);

if(err.length){console.error(JSON.stringify({v11_50DiscoveryToolsValidation:'FAIL',count:err.length,currentUiVersion:manifest.uiVersion,categoryRails,toolContexts,v49Brands,noindex,errors:err.slice(0,220)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_50DiscoveryToolsValidation:'PASS',currentUiVersion:manifest.uiVersion,trustedFilterBrands:136,categoryRails,toolContexts,rankings:true,explore:true,v49Brands,noindex,candidates:184,v42VisualLanguagePreserved:true,productionDeployed:false},null,2));
