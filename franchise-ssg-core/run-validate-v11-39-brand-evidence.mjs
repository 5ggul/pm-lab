import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const strip=html=>String(html).replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<svg\b[\s\S]*?<\/svg>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const fileFor=r=>path.join(out,...String(r).split('/').filter(Boolean),'index.html');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-39-brand-evidence.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const candidates=quality.indexPolicy?.productionCandidateUrls||[];

if(manifest.uiVersion!=='11.39'||manifest.v11_39?.brandEvidence!==true)err.push('manifest v11.39');
if(snap.brand_count!==136||report.brandPages!==136)err.push(`brand count ${snap.brand_count}/${report.brandPages}`);
if(candidates.length!==184)err.push(`candidate count ${candidates.length}`);
if(report.totalTables!==408)err.push(`table count ${report.totalTables}`);
if((css.match(/\/\* v11\.39 brand evidence \*\//g)||[]).length!==1)err.push('css marker');
if(!css.includes('.v39-table-wrap{max-width:100%;overflow-x:auto'))err.push('mobile table scroll');

let depthPass=0,totalTables=0,minChars=Infinity,minH2=Infinity,minTables=Infinity;
for(const b of snap.brands){
  const html=await fs.readFile(fileFor(b.route),'utf8');
  const text=strip(html),chars=text.length,h2=(html.match(/<h2\b/gi)||[]).length,tables=(html.match(/<table\b/gi)||[]).length;
  minChars=Math.min(minChars,chars);minH2=Math.min(minH2,h2);minTables=Math.min(minTables,tables);totalTables+=tables;
  if((html.match(/data-v39-evidence="1"/g)||[]).length!==1)err.push(`evidence marker ${b.slug}`);
  for(const key of ['metrics','components','history'])if(!html.includes(`data-v39-table="${key}"`))err.push(`table ${key} ${b.slug}`);
  if(!html.includes('<a href="#evidence">상세표</a>'))err.push(`toc ${b.slug}`);
  if(/\b(?:undefined|NaN)\b/.test(text))err.push(`invalid token ${b.slug}`);
  if(/샘플 데이터|예시 데이터|합성 데이터/.test(text))err.push(`synthetic copy ${b.slug}`);
  if(!positive(b.sales)&&!/가맹점 연간 평균매출은 양수 공개값이 확인되지 않아/.test(text))err.push(`missing sales explanation ${b.slug}`);
  if(chars>=1800&&h2>=5&&tables>=2)depthPass++;else err.push(`depth ${b.slug} chars=${chars} h2=${h2} tables=${tables}`);
}
if(depthPass!==136)err.push(`depth pass ${depthPass}/136`);

if(err.length){console.error(JSON.stringify({v11_39BrandEvidenceValidation:'FAIL',count:err.length,minChars,minH2,minTables,totalTables,errors:err.slice(0,180)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_39BrandEvidenceValidation:'PASS',brands:136,depthPass,minChars,minH2,minTables,totalTables,candidates:184,productionDeployed:false},null,2));
