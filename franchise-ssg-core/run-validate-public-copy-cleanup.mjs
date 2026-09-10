import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'public-copy-cleanup-report.json'),'utf8'));
const errors=[];
const brandRoutes=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute).filter(r=>r.startsWith('/brands/')&&r!=='/brands/');

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split('#')[0].split('?')[0].replace(/^\/+|\/+$/g,'')}/`}
function routeFile(route){return path.join(out,...route.split('/').filter(Boolean),'index.html')}
function visible(html){return String(html).replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')}

for(const route of brandRoutes){
  const html=await fs.readFile(routeFile(route),'utf8');const text=visible(html);
  if(/품질점수\s*\d+\s*\/\s*100/.test(text))errors.push(`${route}: visible quality score`);
  if(/정식 공개 시 색인 후보/.test(text))errors.push(`${route}: visible index-candidate QA copy`);
}
if(report.candidateBrands!==brandRoutes.length)errors.push(`candidateBrands ${report.candidateBrands}/${brandRoutes.length}`);
if(errors.length){console.error(JSON.stringify({publicCopyCleanupValidation:'FAIL',errors:errors.slice(0,30),errorCount:errors.length},null,2));process.exit(1)}
console.log(JSON.stringify({publicCopyCleanupValidation:'PASS',candidateBrands:brandRoutes.length,changedBrandPages:report.changedBrandPages},null,2));
