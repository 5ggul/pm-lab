import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>fs.writeFileSync(path.join(ROOT,r),c);
const json=r=>JSON.parse(read(r));
const norm=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ');
const unitNorm=u=>{const x=String(u??'').trim();return ['㎡','m2','M2','m²','M²','m^2','M^2'].includes(x)?'㎡':x};

const finder=json('data/g2b-reference-finder-v20.json');
const evidence=json('data/g2b-evidence-index-v20.json');
const map=new Map();
for(const e of evidence.evidence||[]){
  const unit=unitNorm(e.unit_key||e.unit);
  for(const text of [e.item_label,e.detail].filter(Boolean)){
    const key=`${e.source}|${unit}|${norm(text)}`;
    if(!map.has(key))map.set(key,new Set());
    map.get(key).add(e.evidence_id);
  }
}
for(const c of finder.candidates||[]){
  const ids=new Set();
  for(const text of [c.label,c.detail].filter(Boolean)){
    const set=map.get(`${c.source}|${unitNorm(c.unit_key)}|${norm(text)}`);
    if(set)for(const id of set)ids.add(id);
  }
  c.linked_evidence_ids=[...ids].sort();
}
const linked=(finder.candidates||[]).filter(x=>x.linked_evidence_ids?.length).length;
if(linked<=0)throw new Error('reference finder evidence crosswalk still empty');
finder.evidence_linked_candidate_count=linked;
write('data/g2b-reference-finder-v20.json',JSON.stringify(finder,null,2));

const pageRel='data/g2b-reference-finder/index.html';
let page=read(pageRel);
const embedded=JSON.stringify(finder).replace(/</g,'\\u003c');
page=page.replace(/<script type="application\/json" data-v20-reference-finder-data>[\s\S]*?<\/script>/,`<script type="application/json" data-v20-reference-finder-data>${embedded}</script>`);
page=page.replace(/(<span>기존 evidence 연결 후보<\/span><strong>)\d+(<\/strong>)/,`$1${linked.toLocaleString('ko-KR')}$2`);
write(pageRel,page);

const audit=json('data/g2b-reference-finder-audit-v20.json');
audit.evidence_linked_candidate_count=linked;
audit.evidence_crosswalk_fixed=true;
write('data/g2b-reference-finder-audit-v20.json',JSON.stringify(audit,null,2));
console.log(`v20 reference finder batch9 fix: ${linked} candidates linked to mapped evidence`);
