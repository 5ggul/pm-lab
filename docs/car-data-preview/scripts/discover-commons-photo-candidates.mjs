import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Advisory maintenance report only. A result must still pass model, body,
// people and licence review before it can enter vehicle-image-sources.json.
const root=fileURLToPath(new URL('../',import.meta.url));
const hierarchy=JSON.parse(fs.readFileSync(path.join(root,'data/generated/service-hierarchy.json'),'utf8'));
const sources=JSON.parse(fs.readFileSync(path.join(root,'data/vehicle-image-sources.json'),'utf8'));
const mapped=new Set(sources.records.map(record=>record.family_id));
const missing=hierarchy.families.filter(family=>!mapped.has(family.family_id));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();

async function search(query){
  const params=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrnamespace:'6',gsrlimit:'8',gsrsearch:query,prop:'imageinfo',iiprop:'url|size|extmetadata',iiurlwidth:'960'});
  const response=await fetch(`https://commons.wikimedia.org/w/api.php?${params}`,{headers:{'User-Agent':'NaechaDataPhotoReview/1.0 (https://github.com/5ggul/pm-lab)'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`${response.status} ${query}`);
  const payload=await response.json();
  return Object.values(payload.query?.pages||{}).map(page=>{
    const info=page.imageinfo?.[0]||{},meta=info.extmetadata||{};
    return {title:page.title,description:clean(meta.ImageDescription?.value?.replace(/<[^>]+>/g,' ')),author:clean(meta.Artist?.value?.replace(/<[^>]+>/g,' ')),license:meta.LicenseShortName?.value||null,license_url:meta.LicenseUrl?.value||null,source_page:info.descriptionurl||null,image_url:info.thumburl||info.url||null,width:info.width||null,height:info.height||null};
  });
}

const results=[];
for(const [index,family] of missing.entries()){
  const queries=[`${family.maker} ${family.family_name}`,family.family_name];
  let candidates=[];
  for(const query of queries){
    try{candidates=await search(query)}catch(error){candidates=[{error:error.message}]}
    if(candidates.some(candidate=>candidate.title))break;
    await sleep(120);
  }
  results.push({family_id:family.family_id,maker:family.maker,family_name:family.family_name,generation_labels:family.generations.map(g=>g.generation_label),queries,candidates});
  console.log(`${index+1}/${missing.length} ${family.maker} ${family.family_name}: ${candidates.filter(c=>c.title).length}`);
  await sleep(120);
}
const report={generated_at:new Date().toISOString(),policy:'Discovery only. Exact vehicle identity, visible people, commercial-use licence and source metadata require human review.',missing_families:missing.length,results};
fs.mkdirSync(path.join(root,'data/staging'),{recursive:true});
fs.writeFileSync(path.join(root,'data/staging/commons-photo-candidates.json'),JSON.stringify(report,null,2)+'\n');
console.log('Wrote data/staging/commons-photo-candidates.json');
