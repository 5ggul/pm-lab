import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const html=await fs.readFile(path.join(out,'compare/index.html'),'utf8');
const app=await fs.readFile(path.join(out,'assets/app.js'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const report=JSON.parse(await fs.readFile(path.join(out,'v11-22-universal-compare.json'),'utf8'));
const report14=JSON.parse(await fs.readFile(path.join(out,'v11-14-history-tiers.json'),'utf8'));
const report17=JSON.parse(await fs.readFile(path.join(out,'v11-17-compare-trust.json'),'utf8'));
const report21=JSON.parse(await fs.readFile(path.join(out,'v11-21-home-funnel.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const trustedSlugs=new Set((report14.candidateUrls||[]).filter(r=>/^\/brands\/[^/]+\/$/.test(r)).map(r=>r.split('/').filter(Boolean).at(-1)));
const optionSlugs=new Set([...html.matchAll(/<option value="([^"]+)" data-route="\/brands\//g)].map(m=>m[1]));
if(!html.includes('data-v11-22-universal-compare="1"'))errors.push('universal compare main marker missing');
if(!html.includes('data-v11-22-compare-builder="1"'))errors.push('compare builder section missing');
if((html.match(/<select name="[ab]">/g)||[]).length!==2)errors.push('compare builder must have two brand selects');
if(optionSlugs.size!==trustedSlugs.size)errors.push(`trusted option count mismatch ${optionSlugs.size}/${trustedSlugs.size}`);
for(const slug of trustedSlugs)if(!optionSlugs.has(slug))errors.push(`trusted brand option missing ${slug}`);
for(const slug of optionSlugs)if(!trustedSlugs.has(slug))errors.push(`non-trusted brand leaked into compare builder ${slug}`);
for(const blocked of ['bbq-chicken','gs25','paris-baguette'])if(optionSlugs.has(blocked))errors.push(`Tier C example leaked ${blocked}`);
const pairRaw=html.match(/<script type="application\/json" data-v11-22-pair-map>([\s\S]*?)<\/script>/)?.[1]||'{}';let pairMap={};try{pairMap=JSON.parse(pairRaw)}catch{errors.push('pair map JSON invalid')}
if(Object.keys(pairMap).length!==report17.eligibleCompareCount)errors.push(`static pair map mismatch ${Object.keys(pairMap).length}/${report17.eligibleCompareCount}`);
if(!html.includes('공개 창업비용')||!html.includes('평균매출 공개지표')||!html.includes('최근 점포 변화'))errors.push('core comparison metrics missing');
if(!html.includes('새 비교 페이지 자동생성 없음'))errors.push('no-fanout disclosure missing');
if(!app.includes('/* v11.22 universal compare builder */'))errors.push('compare builder JS missing');
if(!css.includes('/* v11.22 universal compare builder */'))errors.push('compare builder CSS missing');
const css22=css.split('/* v11.22 universal compare builder */')[1]||'';if(/box-shadow\s*:|border-radius\s*:/.test(css22))errors.push('compare builder introduced rounded/shadow card styling');
if(!html.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))errors.push('preview compare noindex missing');
const candidates=new Set(quality.indexPolicy?.productionCandidateUrls||[]);if(!candidates.has('/compare/'))errors.push('compare hub is not production candidate');
if(report.uiVersion!=='11.22')errors.push(`report uiVersion ${report.uiVersion}`);
if(report.trustedBrands!==report14.productionBrandCandidates)errors.push('report trusted brand mismatch');
if(report.staticVerifiedPairs!==report17.eligibleCompareCount)errors.push('report static pair mismatch');
if(report.productionCandidateCount!==report21.productionCandidateCount)errors.push('universal compare changed production candidate count unexpectedly');
if(manifest.uiVersion!=='11.22')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_22?.programmaticCompareFanout!==false)errors.push('manifest no-fanout flag missing');

if(errors.length){console.error(JSON.stringify({v11_22Validation:'FAIL',errors,report},null,2));process.exit(1)}
console.log(JSON.stringify({v11_22Validation:'PASS',trustedBrands:report.trustedBrands,tierA:report.tierABrands,tierB:report.tierBBrands,staticPairs:report.staticVerifiedPairs,productionCandidates:report.productionCandidateCount},null,2));
