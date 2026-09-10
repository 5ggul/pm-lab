import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const changed=[];
const contactChanged=[];

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

if(candidates.includes('/contact/')){
  const route='/contact/';
  const file=routeFile(route);
  let html=await fs.readFile(file,'utf8');
  const before=html;
  html=html.replace(
    /현재 프리뷰에서는 실제 운영 이메일이 확정되지 않았으므로 가짜 주소를 표시하지 않습니다\.\s*realContactReady=false 상태로 유지합니다\./gi,
    '현재 프리뷰에는 임시 이메일이나 가짜 연락처를 표시하지 않습니다. 문의 채널은 정식 서비스 공개 전에 실제 운영 연락처로 연결합니다.'
  );
  if(html!==before){await fs.writeFile(file,html,'utf8');contactChanged.push(route)}
}

const report={
  schemaVersion:2,
  generatedAt:new Date().toISOString(),
  policy:'REMOVE_VISIBLE_INTERNAL_QA_COPY_ONLY; DO_NOT_CHANGE_DATA_OR_INDEX_POLICY',
  candidateBrands:candidates.filter(r=>r.startsWith('/brands/')&&r!=='/brands/').length,
  changedBrandPages:changed.length,
  changedRoutes:changed,
  contactQaCopyRemoved:contactChanged.length===1,
  contactChangedRoutes:contactChanged
};
await fs.writeFile(path.join(out,'public-copy-cleanup-report.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({publicCopyCleanup:'PASS',candidateBrands:report.candidateBrands,changedBrandPages:report.changedBrandPages,contactQaCopyRemoved:report.contactQaCopyRemoved},null,2));
