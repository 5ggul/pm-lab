import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-23-cost-components.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const html=await fs.readFile(path.join(out,'cost-components/index.html'),'utf8');
const home=await fs.readFile(path.join(out,'index.html'),'utf8');
const ranking=await fs.readFile(path.join(out,'rankings/index.html'),'utf8');
const app=await fs.readFile(path.join(out,'assets/app.js'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const route='/cost-components/';
const BASE='/pm-lab/franchise-ssg-preview';

if(report.uiVersion!=='11.23')errors.push(`report uiVersion ${report.uiVersion}`);
if(report.trustedBrands!==136)errors.push(`trustedBrands ${report.trustedBrands}`);
if(report.productionCandidateCount!==report.previousCandidateCount+1)errors.push(`candidate delta ${report.previousCandidateCount}->${report.productionCandidateCount}`);
if(!Number.isInteger(report.zeroPublicValues?.franchiseFee)||!Number.isInteger(report.zeroPublicValues?.education)||!Number.isInteger(report.zeroPublicValues?.deposit))errors.push('zero-public-value counts missing');
if(report.categoryCount<10)errors.push(`categoryCount ${report.categoryCount}`);
if(manifest.uiVersion!=='11.23')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_23?.costComponentIntentHub!==true)errors.push('manifest v11_23 marker missing');
if(manifest.v11_23?.trustedBrands!==136)errors.push('manifest trusted brand count mismatch');
if(!quality.indexPolicy?.productionCandidateUrls?.includes(route))errors.push('cost component route missing from quality candidate set');
if(quality.indexPolicy.productionCandidateUrls.length!==report.productionCandidateCount)errors.push('quality candidate count mismatch');
if(!String(quality.qualityPolicy?.components||'').includes('zero public values'))errors.push('component quality policy missing zero semantics');

if(!html.includes('data-v11-component-hub="1"'))errors.push('component hub marker missing');
if(!html.includes('data-v11-component-dataset'))errors.push('Dataset JSON-LD marker missing');
if(!html.includes('<title>프랜차이즈 가맹비 비교 | 교육비·보증금·기타비용</title>'))errors.push('component title missing');
if(!html.includes(`rel="canonical" href="https://5ggul.github.io/pm-lab/franchise-ssg-preview${route}"`))errors.push('component canonical missing');
if(!html.includes('noindex,nofollow,noarchive,nosnippet'))errors.push('preview noindex missing');
if(!html.includes('0 공개값 ≠ 면제 확정'))errors.push('zero-value interpretation warning missing');
if(!html.includes('점포 임대보증금과는 별개'))errors.push('deposit distinction missing');
if(!html.includes(`${BASE}/tools/disclosure-decoder/`)||!html.includes(`${BASE}/rankings/`)||!html.includes(`${BASE}/explore/`))errors.push('related decision links incomplete');
if((html.match(/<h2/g)||[]).length<7)errors.push(`h2 depth ${(html.match(/<h2/g)||[]).length}`);
if((html.match(/<table/g)||[]).length<6)errors.push(`table depth ${(html.match(/<table/g)||[]).length}`);
if((html.match(/data-component-row/g)||[]).length!==136)errors.push(`component row count ${(html.match(/data-component-row/g)||[]).length}`);
if(html.includes('가맹비 면제 브랜드')||html.includes('가맹비 무료 브랜드'))errors.push('zero value reinterpreted as waiver/free');
if(!home.includes(`${BASE}${route}`))errors.push('home direct component link missing');
if(!ranking.includes('data-v11-23-component-link="1"')||!ranking.includes(`${BASE}${route}`))errors.push('ranking contextual component link missing');
if(!app.includes('/* v11.23 component filter */'))errors.push('component filter JS missing');
if(!css.includes('/* v11.23 cost component hub */'))errors.push('component CSS missing');

let dataset=null;
const match=html.match(/<script type="application\/ld\+json" data-v11-component-dataset>([\s\S]*?)<\/script>/);
try{dataset=match?JSON.parse(match[1]):null}catch{errors.push('component Dataset JSON invalid')}
if(dataset?.['@type']!=='Dataset')errors.push('component Dataset type missing');
if(!Array.isArray(dataset?.variableMeasured)||dataset.variableMeasured.length<7)errors.push('component Dataset variables incomplete');

if(errors.length){console.error(JSON.stringify({v11_23Validation:'FAIL',errors,report},null,2));process.exit(1)}
console.log(JSON.stringify({v11_23Validation:'PASS',trustedBrands:report.trustedBrands,productionCandidates:report.productionCandidateCount,zeroPublicValues:report.zeroPublicValues},null,2));
