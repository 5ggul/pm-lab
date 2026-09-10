import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const dataTool=JSON.parse(await fs.readFile(path.join(out,'v11-26-data-tool.json'),'utf8'));
const core=JSON.parse(await fs.readFile(path.join(out,'v11-26-core-surfaces.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const norm=r=>r==='/'?'/':`/${String(r).split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`;
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(norm);
const file=r=>r==='/'?path.join(out,'index.html'):path.join(out,...norm(r).split('/').filter(Boolean),'index.html');
const read=r=>fs.readFile(file(r),'utf8');
const count=(h,re)=>(h.match(re)||[]).length;
const won=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'—';
if(snap.uiVersion!=='11.26'||snap.schemaVersion!==2)err.push('snapshot version');
if(snap.brand_count!==136||candidates.length!==184||core.productionCandidateCount!==184||dataTool.productionCandidateCount!==184)err.push('candidate/trusted count');
if(snap.metrics?.salesPerArea?.sourceField!=='averageSalesPerArea10k'||!String(snap.metrics?.salesPerArea?.basis||'').includes('3.3㎡'))err.push('per-area semantics');
if(core.candidateSetChanged!==false||core.productionDeployed!==false||!String(dataTool.policy||'').includes('NO_NEW_HTML_ROUTE'))err.push('release policy');
if(dataTool.regionalSales?.status!=='DEFERRED_NOT_IN_CANONICAL_SNAPSHOT')err.push('regional status');
const positive=snap.brands.filter(b=>Number.isFinite(Number(b.salesPerArea))&&Number(b.salesPerArea)>0);
if(core.perAreaPositiveBrands!==positive.length||dataTool.areaSales?.positiveBenchmarkCount!==positive.length||positive.length<50)err.push(`per-area coverage ${positive.length}`);
const brandRoutes=candidates.filter(r=>/^\/brands\/[^/]+\/$/.test(r));if(brandRoutes.length!==136||core.brandPages!==136)err.push(`brand routes ${brandRoutes.length}/${core.brandPages}`);
for(const b of snap.brands){const h=await read(b.route);if(count(h,/data-v26-brand-area="1"/g)!==1)err.push('brand area '+b.route);if(!h.includes(won(b.salesPerArea)))err.push('brand value '+b.route);if(!h.includes(won(b.category?.salesPerAreaMedian)))err.push('brand median '+b.route);if(!h.includes('3.3㎡당 평균매출'))err.push('brand sentence '+b.route)}
const catRoutes=candidates.filter(r=>/^\/categories\/[^/]+\/$/.test(r));let expectedCats=0;for(const r of catRoutes){const slug=r.split('/').filter(Boolean).at(-1),c=snap.categories?.[slug];if(!c?.salesPerArea?.count)continue;expectedCats++;const h=await read(r);if(count(h,/data-v26-category-area="1"/g)!==1)err.push('category area '+r);if(!h.includes(won(c.salesPerArea.median)))err.push('category median '+r);if(!h.includes(`표본 ${c.salesPerArea.count}`))err.push('category sample '+r)}if(core.categoryPages!==expectedCats)err.push(`category pages ${core.categoryPages}/${expectedCats}`);
const startup=await read('/tools/startup-cost/');if(!startup.includes('data-v26-startup="1"')||!startup.includes('3.3㎡당매출')||!startup.includes('"salesPerArea"'))err.push('startup per-area');
const compare=await read('/compare/');if(!compare.includes('data-v26-compare="1"')||!compare.includes('"salesPerArea"'))err.push('compare per-area');
const ranking=await read('/rankings/');if(!ranking.includes('data-v26-ranking="1"')||!ranking.includes('3.3㎡당매출'))err.push('ranking per-area');for(const x of ['공개 창업비용이 낮은 순으로 보면?','가맹점 수가 많은 순으로 보면?','평균매출 공개지표가 높은 순으로 보면?'])if(ranking.includes(x))err.push('ranking copy '+x);if(ranking.includes('<div class="stat-grid">'))err.push('ranking legacy cards');
const tools=await read('/tools/');if(!tools.includes('data-v26-area-link="1"')||!tools.includes('<strong>면적당매출</strong>'))err.push('tools area link');if(tools.includes('<strong>지역매출</strong>')||/href="[^"]*\/areas\//.test(tools))err.push('unverified regional UI');
const areaTool=await read('/tools/category-median/');if(!areaTool.includes('data-v26-area-sales="1"')||!areaTool.includes('면적(3.3㎡)당 연간 평균매출'))err.push('area tool');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8'),app=await fs.readFile(path.join(out,'assets/app.js'),'utf8');if(!css.includes('/* v11.26 data-tool */')||!css.includes('/* v11.26 core-surfaces */'))err.push('css');if(!app.includes('/* v11.26 core-surfaces */'))err.push('app');
for(const [name,h] of [['home',await read('/')],['startup',startup],['compare',compare],['ranking',ranking],['tools',tools]]){if(!h.includes('noindex,nofollow,noarchive,nosnippet'))err.push('preview noindex '+name);for(const x of ['한눈에','쉽고 빠르게','신뢰 비교','현명한 창업','스마트하게','합리적인 선택','도와드립니다'])if(h.includes(x))err.push(`${name} marketing ${x}`)}
if(candidates.some(r=>/^\/areas\//.test(r)||/^\/brands\/[^/]+\/[^/]+\/$/.test(r)))err.push('unexpected fanout candidate');
if(err.length){console.error(JSON.stringify({v11_26Validation:'FAIL',count:err.length,errors:err.slice(0,160)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_26Validation:'PASS',trusted:136,candidates:184,perAreaPositiveBrands:positive.length,categoryPages:expectedCats,regionalSales:'DEFERRED',coreSurfaces:['brand','category','startup','compare','rankings','tools'],productionDeployed:false},null,2));
