import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const snapshot=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-45-public-freshness.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const brandCount=Number(snapshot.brand_count),categoryCount=Number(snapshot.category_count);
const snapshotDate=String(snapshot.snapshot_id||'').match(/(\d{4}-\d{2}-\d{2})$/)?.[1]||String(snapshot.fetched_at||'').slice(0,10);
const htmlFiles=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}await walk(out);
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');
const ui=Number(manifest.uiVersion);
if(!Number.isFinite(ui)||ui<11.45||manifest.v11_45?.publicMetadataFreshness!==true||manifest.v11_45?.trustedSnapshotCountSync!==true||manifest.v11_45?.homeFreshnessSync!==true)err.push(`manifest ${manifest.uiVersion}`);
if(manifest.v11_45?.brandCount!==brandCount||manifest.v11_45?.categoryCount!==categoryCount||manifest.v11_45?.snapshotDate!==snapshotDate)err.push('snapshot manifest mismatch');
if(manifest.v11_45?.candidateSetChanged!==false||manifest.v11_45?.indexPolicyChanged!==false||manifest.v11_45?.dataSemanticsChanged!==false||manifest.v11_45?.visualSystemChanged!==false)err.push('immutable contracts');
if(manifest.v11_45?.productionDeployed!==false||report.productionDeployed!==false)err.push('production flag');
if(candidates.length!==184||brandCount!==136||categoryCount!==20)err.push(`counts ${candidates.length}/${brandCount}/${categoryCount}`);
if(report.allHtmlPages!==htmlFiles.length||report.bodyCoverage!==htmlFiles.length)err.push(`coverage ${report.bodyCoverage}/${htmlFiles.length}`);
if(report.staleBrandCountPhrasesAfter!==0)err.push(`stale phrases ${report.staleBrandCountPhrasesAfter}`);
let bodyCoverage=0,noindex=0,v44Coverage=0;
for(const f of htmlFiles){const h=await fs.readFile(f,'utf8');if(/<body\b[^>]*data-v45-public-freshness="1"/i.test(h))bodyCoverage++;if(/\bv44-v42-refined\b/.test(h)&&h.includes('/assets/v44-refinement.js'))v44Coverage++;}
if(bodyCoverage!==htmlFiles.length)err.push(`body coverage ${bodyCoverage}/${htmlFiles.length}`);
if(v44Coverage!==htmlFiles.length)err.push(`v44 preserved ${v44Coverage}/${htmlFiles.length}`);
for(const r of candidates){const h=await fs.readFile(fileFor(r),'utf8');if(/<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/i.test(h))noindex++;else err.push(`noindex ${r}`)}
if(noindex!==184)err.push(`noindex ${noindex}`);
const home=await fs.readFile(fileFor('/'),'utf8');
const expectedMeta=`<meta name="description" content="${brandCount}개 프랜차이즈 브랜드의 창업비용, 가맹점 수, 가맹점 증감, 평균매출을 같은 기준으로 비교하고 계산할 수 있습니다.">`;
if(!home.includes(expectedMeta))err.push('home meta');
if(!home.includes(`<span>갱신</span><strong>${snapshotDate}</strong>`))err.push('home freshness rail');
if(!/<h1 class="v44-home-title">[^<]+<\/h1>/.test(home))err.push('v44 home title');
if(home.includes('170개 프랜차이즈')||home.includes('170개 브랜드'))err.push('home stale count');
if(err.length){console.error(JSON.stringify({v11_45PublicFreshnessValidation:'FAIL',count:err.length,htmlPages:htmlFiles.length,bodyCoverage,v44Coverage,noindex,errors:err.slice(0,160)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_45PublicFreshnessValidation:'PASS',htmlPages:htmlFiles.length,bodyCoverage,v44Coverage,candidates:184,noindex,brandCount,categoryCount,snapshotDate,v44VisualSystemPreserved:true,productionDeployed:false},null,2));
