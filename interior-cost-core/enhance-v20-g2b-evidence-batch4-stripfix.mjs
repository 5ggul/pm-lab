import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>fs.writeFileSync(path.join(ROOT,r),c);
const auditPath='data/g2b-evidence-audit-v20.json';
const audit=JSON.parse(read(auditPath));
const count=Number(audit.evidence_count||65);
const strip=`<div class="site-shell"><section class="v20-evidence-strip" data-v20-evidence-strip><strong>공식 참고값 근거</strong><span>${count}개 · 조달청 가격정보현황서비스 · 근거 ID/단위/기준일/N 확인</span><a href="${BASE}/data/g2b-evidence/">근거 인덱스 보기</a></section></div>`;
let repaired=0,actual=0;
for(const rel of audit.strip_targets||[]){
  let html=read(rel);
  if(!html.includes('class="v20-evidence-strip" data-v20-evidence-strip')){
    html=html.replace('</main>',strip+'</main>');
    write(rel,html);repaired++;
  }
  if(read(rel).includes('class="v20-evidence-strip" data-v20-evidence-strip'))actual++;
}
audit.strip_repaired_count=repaired;
audit.strip_actual_count=actual;
audit.strip_injected_count=actual;
write(auditPath,JSON.stringify(audit,null,2));
if(actual!==Number(audit.strip_target_count||0))throw new Error(`evidence strip repair incomplete ${actual}/${audit.strip_target_count}`);
console.log(`v20 evidence stripfix: repaired ${repaired}, actual ${actual}`);
