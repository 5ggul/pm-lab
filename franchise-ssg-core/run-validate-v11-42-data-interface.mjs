import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const js=await fs.readFile(path.join(out,'assets/v42-interface.js'),'utf8');
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const reportPath=path.join(out,'v11-42-data-interface.json');
const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const htmlFiles=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}await walk(out);
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');

// Enforce visual cleanup idempotently. v11.41 is generated first, then v11.42 removes
// decorative photography/motion that competes with the data interface.
const removed={genericScenesRemoved:0,photoBreaksRemoved:0,insetPhotosRemoved:0,orbitsRemoved:0,detailIndexRemoved:0};
const count=(s,re)=>(s.match(re)||[]).length;
for(const f of htmlFiles){
  let h=await fs.readFile(f,'utf8');const before=h;
  removed.genericScenesRemoved+=count(h,/class="v41-generic-scene"/g);
  removed.photoBreaksRemoved+=count(h,/class="v41-photo-break"/g);
  removed.insetPhotosRemoved+=count(h,/class="v41-shot v41-shot-inset"/g);
  removed.orbitsRemoved+=count(h,/class="v41-orbit"/g);
  removed.detailIndexRemoved+=count(h,/class="v41-detail-index"/g);
  h=h.replace(/<section class="v41-generic-scene"[^>]*>[\s\S]*?<\/section>/g,'');
  h=h.replace(/<section class="v41-photo-break"[^>]*>[\s\S]*?<\/section>/g,'');
  h=h.replace(/<figure class="v41-shot v41-shot-inset"[^>]*>[\s\S]*?<\/figure>/g,'');
  h=h.replace(/<div class="v41-orbit"[^>]*>[\s\S]*?<\/div>/g,'');
  h=h.replace(/<div class="v41-detail-index"[^>]*>[\s\S]*?<\/div>/g,'');
  if(h!==before)await fs.writeFile(f,h,'utf8');
}
for(const k of Object.keys(removed))report[k]=Math.max(Number(report[k]||0),removed[k]);
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n','utf8');

if(manifest.uiVersion!=='11.42'||manifest.v11_42?.dataFirstInterface!==true)err.push(`manifest ${manifest.uiVersion}`);
for(const k of ['overlapGuard','photographyTrimmed','genericScenesRemoved','pointerParallaxRemoved','autoSectionNav','tableScanability'])if(manifest.v11_42?.[k]!==true)err.push(`flag ${k}`);
if(manifest.v11_42?.candidateSetChanged!==false||manifest.v11_42?.indexPolicyChanged!==false||manifest.v11_42?.dataSemanticsChanged!==false)err.push('immutable contracts');
if(manifest.v11_42?.productionDeployed!==false||report.productionDeployed!==false)err.push('production flag');
if(candidates.length!==184||snap.brand_count!==136)err.push(`data counts ${candidates.length}/${snap.brand_count}`);
if(report.allHtmlPages!==htmlFiles.length||report.patchedHtmlPages!==htmlFiles.length)err.push(`html report ${report.patchedHtmlPages}/${htmlFiles.length}`);
if(report.genericScenesRemoved<150||report.orbitsRemoved<300||report.detailIndexRemoved<130||report.photoBreaksRemoved<1||report.insetPhotosRemoved<1||report.parallaxAttrsRemoved<150)err.push(`cleanup counts ${JSON.stringify({generic:report.genericScenesRemoved,orbit:report.orbitsRemoved,detail:report.detailIndexRemoved,breaks:report.photoBreaksRemoved,inset:report.insetPhotosRemoved,parallax:report.parallaxAttrsRemoved})}`);
if((css.match(/\/\* v11\.42 data interface \*\//g)||[]).length!==1||(css.match(/\/\* v11\.42 data interface end \*\//g)||[]).length!==1)err.push('css markers');
for(const token of ['.v41-home-hero','.v41-detail-hero','.v41-category-scene','.v35-kpis','.v35-benchmarks','.v26-area-row','.v34-pickers','.v36-brandbar','.v42-jump','.v42-scrollable','@media(max-width:430px)'])if(!css.includes(token))err.push(`css ${token}`);
for(const token of ['v42-scrollable','v42-jump','IntersectionObserver','main h2','v42-section-'])if(!js.includes(token))err.push(`js ${token}`);

let classCount=0,scriptCount=0,noindex=0,brands=0,brandHero=0,categories=0,categoryScene=0;
for(const f of htmlFiles){
  const h=await fs.readFile(f,'utf8');const rel=path.relative(out,f);
  if(/<body\b[^>]*\bv42-data-ui\b[^>]*data-v42-interface="1"/i.test(h))classCount++;else err.push(`class ${rel}`);
  if(h.includes('/assets/v42-interface.js'))scriptCount++;else err.push(`script ${rel}`);
  for(const forbidden of ['v41-generic-scene','v41-photo-break','v41-shot-inset','v41-orbit','v41-detail-index','data-v41-parallax'])if(h.includes(forbidden))err.push(`${forbidden} ${rel}`);
  if(/class="[^"]*v25-brand/.test(h)){brands++;if(h.includes('v41-detail-hero')&&/images\.unsplash\.com/.test(h))brandHero++;else err.push(`brand hero ${rel}`)}
  if(/class="[^"]*v25-category/.test(h)){categories++;if(h.includes('v41-category-scene')&&/images\.unsplash\.com/.test(h))categoryScene++;else err.push(`category scene ${rel}`)}
}
if(classCount!==htmlFiles.length||scriptCount!==htmlFiles.length)err.push(`coverage ${classCount}/${scriptCount}/${htmlFiles.length}`);
if(brands!==136||brandHero!==136)err.push(`brands ${brandHero}/${brands}`);
if(categories<16||categoryScene!==categories)err.push(`categories ${categoryScene}/${categories}`);
for(const route of candidates){const h=await fs.readFile(fileFor(route),'utf8');if(/<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/i.test(h))noindex++;else err.push(`noindex ${route}`)}
if(noindex!==184)err.push(`noindex ${noindex}`);

const home=await fs.readFile(fileFor('/'),'utf8');
if(!home.includes('v41-home-hero')||!home.includes('v41-shot-main'))err.push('home hero');
if(home.includes('v41-shot-inset')||home.includes('v41-photo-break')||home.includes('v41-orbit'))err.push('home duplicate visuals');
const brand=await fs.readFile(fileFor('/brands/mega-mgc-coffee/'),'utf8');
if(!brand.includes('data-v39-evidence="1"')||!brand.includes('v41-detail-hero')||!brand.includes('v42-interface.js'))err.push('brand retained structure');
const missing=await fs.readFile(fileFor('/brands/666버거/'),'utf8');if(!missing.includes('data-v35-kpi="sales" data-v35-value="null"'))err.push('missing sales semantics');
const compare=await fs.readFile(fileFor('/compare/'),'utf8');if(compare.includes('v41-generic-scene')||!compare.includes('data-v34-workspace="hub"'))err.push('compare cleanup/workspace');
const tool=await fs.readFile(fileFor('/tools/startup-cost/'),'utf8');if(tool.includes('v41-generic-scene')||!tool.includes('data-v36-startup="1"'))err.push('tool cleanup/workspace');

if(err.length){console.error(JSON.stringify({v11_42DataInterfaceValidation:'FAIL',count:err.length,htmlPages:htmlFiles.length,classCount,scriptCount,brands,brandHero,categories,categoryScene,noindex,cleanup:removed,errors:err.slice(0,220)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_42DataInterfaceValidation:'PASS',htmlPages:htmlFiles.length,classCount,scriptCount,brands,brandHero,categories,categoryScene,candidates:184,noindex,cleanup:{genericScenesRemoved:report.genericScenesRemoved,orbitsRemoved:report.orbitsRemoved,detailIndexRemoved:report.detailIndexRemoved,photoBreaksRemoved:report.photoBreaksRemoved,insetPhotosRemoved:report.insetPhotosRemoved,parallaxAttrsRemoved:report.parallaxAttrsRemoved},productionDeployed:false},null,2));
