import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const changed=[];

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split('#')[0].split('?')[0].replace(/^\/+|\/+$/g,'')}/`}
function routeFile(route){return route==='/'?path.join(out,'index.html'):path.join(out,...route.split('/').filter(Boolean),'index.html')}

for(const route of candidates){
  if(!route.startsWith('/brands/')||route==='/brands/')continue;
  const file=routeFile(route);
  let html=await fs.readFile(file,'utf8');
  const before=html;
  html=html
    .replace(/<p>\s*<strong>품질점수<\/strong>[\s\S]*?<\/p>/gi,'')
    .replace(/<p>[^<]*정식 공개 시 색인 후보[^<]*<\/p>/gi,'')
    .replace(/<span[^>]*>[^<]*정식 공개 시 색인 후보[^<]*<\/span>/gi,'');
  if(html!==before){await fs.writeFile(file,html,'utf8');changed.push(route)}
}

const report={schemaVersion:1,generatedAt:new Date().toISOString(),policy:'REMOVE_VISIBLE_INTERNAL_QA_COPY_ONLY; DO_NOT_CHANGE_DATA_OR_INDEX_POLICY',candidateBrands:candidates.filter(r=>r.startsWith('/brands/')&&r!=='/brands/').length,changedBrandPages:changed.length,changedRoutes:changed};
await fs.writeFile(path.join(out,'public-copy-cleanup-report.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({publicCopyCleanup:'PASS',candidateBrands:report.candidateBrands,changedBrandPages:report.changedBrandPages},null,2));
