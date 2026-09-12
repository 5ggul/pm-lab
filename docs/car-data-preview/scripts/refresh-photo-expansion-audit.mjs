import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const auditPath=path.join(root,'data/photo-expansion-audit.json');
const hierarchyPath=path.join(root,'data/generated/service-hierarchy.json');
const sourcesPath=path.join(root,'data/vehicle-image-sources.json');
const audit=JSON.parse(fs.readFileSync(auditPath,'utf8'));
const hierarchy=JSON.parse(fs.readFileSync(hierarchyPath,'utf8'));
const sources=JSON.parse(fs.readFileSync(sourcesPath,'utf8'));
const familyById=new Map(hierarchy.families.map(family=>[family.family_id,family]));

audit.reviewed_on=new Date().toISOString().slice(0,10);
audit.after=sources.records.length;
audit.total_families=hierarchy.families.length;
audit.remaining=hierarchy.families.length-sources.records.length;
audit.source_files_added=new Set(sources.records.map(record=>record.file)).size-audit.before;
audit.mappings=sources.records.map(record=>{
  const family=familyById.get(record.family_id);
  if(!family)throw new Error(`Missing family ${record.family_id}`);
  return {
    family_id:record.family_id,
    name:family.family_name,
    maker:family.maker,
    file:record.file,
    photo_scope:record.generation,
    raw_models:family.raw_models
  };
});
const previousHeld=new Map((audit.held||[]).map(item=>[item.family_id,item]));
const mappedFamilies=new Set(sources.records.map(record=>record.family_id));
audit.held=hierarchy.families.filter(family=>!mappedFamilies.has(family.family_id)).map(family=>({
  family_id:family.family_id,
  maker:family.maker,
  name:family.family_name,
  title:previousHeld.get(family.family_id)?.title||`${family.maker} ${family.family_name}`,
  generation_labels:family.generations.map(generation=>generation.generation_label),
  raw_models:family.raw_models,
  raw_makers:family.raw_makers,
  reason:previousHeld.get(family.family_id)?.reason||'차종 일치, 사람 없는 구도, 상업 이용 가능 라이선스를 모두 충족한 공개 사진 미확보'
}));

fs.writeFileSync(auditPath,JSON.stringify(audit,null,2)+'\n');
console.log(`Photo audit: ${audit.after}/${audit.total_families}; ${audit.remaining} remaining`);
