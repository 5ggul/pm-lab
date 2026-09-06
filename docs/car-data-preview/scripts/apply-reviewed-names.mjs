import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const file=new URL('data/generated/service-hierarchy.json',root);
const h=JSON.parse(fs.readFileSync(file));
const review=JSON.parse(fs.readFileSync(new URL('data/display-name-reviewed.json',root)));
for(const r of review.records){
  const f=h.families.find(f=>f.family_id===r.family_id);
  if(!f)throw Error(`Reviewed display family missing: ${r.family_id}`);
  if(!f.raw_models.length||f.raw_models.some(m=>!new RegExp(r.model_pattern).test(m)))throw Error(`KEA evidence changed: ${r.family_id}`);
  f.family_name=r.display_name;
  f.display_name_reviewed_on=review.reviewed_on;
  if(r.generation){
    const g=f.generations.find(g=>g.generation_id===r.generation.generation_id);
    if(!g||g.raw_models.some(m=>!m.includes(`(${r.generation.code})`)))throw Error(`Generation evidence changed: ${r.family_id}`);
    g.generation_label=r.generation.label;g.generation_code=r.generation.code;
  }
  for(const g of Object.values(h.group_index).filter(g=>g.family_id===r.family_id)){
    g.family_name=r.display_name;
    if(g.generation_id===r.generation?.generation_id)g.generation_label=r.generation.label;
  }
}
fs.writeFileSync(file,JSON.stringify(h,null,2)+'\n');
console.log(`Corrected ${review.records.length} display names against KEA evidence; all identities preserved.`);
