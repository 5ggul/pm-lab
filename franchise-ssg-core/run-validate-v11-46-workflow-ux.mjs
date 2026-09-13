import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const snapshot=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-46-workflow-ux.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const js=await fs.readFile(path.join(out,'assets/v46-workflow-ux.js'),'utf8');
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const snapshotDate=String(snapshot.snapshot_id||'').match(/(\d{4}-\d{2}-\d{2})$/)?.[1]||String(snapshot.fetched_at||'').slice(0,10);
const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');

if(manifest.uiVersion!=='11.46')err.push(`manifest ${manifest.uiVersion}`);
for(const k of ['v42VisualLanguagePreserved','detailActionHandoff','compareQueryHydration','compareQuickAdd','compareDuplicateGuard','startupQueryHydration','startupLiveTotal','detailFreshnessSync'])if(manifest.v11_46?.[k]!==true)err.push(`flag ${k}`);
if(manifest.v11_46?.candidateSetChanged!==false||manifest.v11_46?.indexPolicyChanged!==false||manifest.v11_46?.dataSemanticsChanged!==false)err.push('immutable contracts');
if(manifest.v11_46?.productionDeployed!==false||report.productionDeployed!==false)err.push('production flag');
if(candidates.length!==184||Number(snapshot.brand_count)!==136||Number(snapshot.category_count)!==20)err.push(`counts ${candidates.length}/${snapshot.brand_count}/${snapshot.category_count}`);
if(report.allHtmlPages!==htmlFiles.length||report.brandPages!==136||report.brandActionsVerified!==136)err.push(`report coverage ${report.allHtmlPages}/${report.brandPages}/${report.brandActionsVerified}`);

if((css.match(/\/\* v11\.46 workflow ux \*\//g)||[]).length!==1||(css.match(/\/\* v11\.46 workflow ux end \*\//g)||[]).length!==1)err.push('v46 css markers');
for(const t of ['.v46-compare-add','.v46-live-total','@media(max-width:430px)','scroll-margin-top'])if(!css.includes(t))err.push(`css ${t}`);
for(const t of ['URLSearchParams','data-v46-compare-search','이미 선택한 브랜드입니다.','data-v46-input-reset','params.get(\'brand\')','history.replaceState'])if(!js.includes(t))err.push(`js ${t}`);

let bodyCoverage=0,scriptCoverage=0,noindex=0,v44Coverage=0,v45Coverage=0;
for(const f of htmlFiles){
  const h=await fs.readFile(f,'utf8');
  if(/<body\b[^>]*\bv46-workflow-ux\b[^>]*data-v46-workflow-ux="1"/i.test(h))bodyCoverage++;else err.push(`body ${path.relative(out,f)}`);
  if(h.includes('/assets/v46-workflow-ux.js'))scriptCoverage++;else err.push(`script ${path.relative(out,f)}`);
  if(/\bv44-v42-refined\b/.test(h)&&h.includes('/assets/v44-refinement.js'))v44Coverage++;
  if(/data-v45-public-freshness="1"/i.test(h))v45Coverage++;
}
if(bodyCoverage!==htmlFiles.length||scriptCoverage!==htmlFiles.length)err.push(`v46 coverage ${bodyCoverage}/${scriptCoverage}/${htmlFiles.length}`);
if(v44Coverage!==htmlFiles.length||v45Coverage!==htmlFiles.length)err.push(`inherited coverage ${v44Coverage}/${v45Coverage}/${htmlFiles.length}`);

for(const r of candidates){
  const h=await fs.readFile(fileFor(r),'utf8');
  if(/<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/i.test(h))noindex++;else err.push(`noindex ${r}`);
}
if(noindex!==184)err.push(`noindex ${noindex}`);

const compare=await fs.readFile(fileFor('/compare/'),'utf8');
for(const t of ['data-v34-workspace="hub"','data-v46-compare-add','data-v46-compare-search','data-v46-compare-add-button','data-v46-compare-note'])if(!compare.includes(t))err.push(`compare ${t}`);
if(!compare.includes('비교 브랜드 1')||!compare.includes('비교 브랜드 4'))err.push('compare labels');

const startup=await fs.readFile(fileFor('/tools/startup-cost/'),'utf8');
for(const t of ['data-v36-startup="1"','data-v46-live-total','data-v46-public','data-v46-extra','data-v46-total','data-v46-input-reset'])if(!startup.includes(t))err.push(`startup ${t}`);

let brandFresh=0,brandLinks=0,datasetFresh=0;
for(const b of snapshot.brands||[]){
  const h=await fs.readFile(fileFor(b.route||`/brands/${b.slug}/`),'utf8');
  if(h.includes(`<b>갱신</b> ${snapshotDate}`))brandFresh++;else err.push(`brand freshness ${b.slug}`);
  if(h.includes(`"dateModified":"${snapshotDate}"`))datasetFresh++;else err.push(`dataset date ${b.slug}`);
  const encodedSlug=encodeURIComponent(String(b.slug));
  const calc=`/tools/startup-cost/?brand=${encodedSlug}`;
  const comp=`/compare/?a=${encodedSlug}`;
  if(h.includes(calc)&&h.includes(comp))brandLinks++;else err.push(`brand handoff ${b.slug}`);
}
if(brandFresh!==136||datasetFresh!==136||brandLinks!==136)err.push(`brand coverage ${brandFresh}/${datasetFresh}/${brandLinks}`);

const home=await fs.readFile(fileFor('/'),'utf8');
if(!home.includes('<h1 class="v44-home-title">프랜차이즈 비교</h1>'))err.push('v44 home title');
if(!home.includes('136개 프랜차이즈 브랜드'))err.push('v45 home count');
if(err.length){
  console.error(JSON.stringify({v11_46WorkflowUxValidation:'FAIL',count:err.length,htmlPages:htmlFiles.length,bodyCoverage,scriptCoverage,v44Coverage,v45Coverage,noindex,brandFresh,datasetFresh,brandLinks,errors:err.slice(0,180)},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_46WorkflowUxValidation:'PASS',htmlPages:htmlFiles.length,bodyCoverage,scriptCoverage,candidates:184,noindex,brands:136,brandFresh,datasetFresh,brandLinks,v42VisualLanguagePreserved:true,productionDeployed:false},null,2));
