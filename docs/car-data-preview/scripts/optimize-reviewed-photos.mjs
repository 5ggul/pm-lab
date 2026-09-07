import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

// Optional maintenance command. Never run as part of the offline HTML build.
// Re-review the existing source/license first when a source image changes.
const root=fileURLToPath(new URL('../',import.meta.url));
const manifestPath=path.join(root,'data/vehicle-image-sources.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const selected=process.argv.slice(2);
if(!selected.length)throw new Error('Pass reviewed family IDs to regenerate; no implicit full-manifest download.');
for(const id of selected)if(!manifest.records.some(r=>r.family_id===id))throw new Error('Unknown family: '+id);
for(const r of manifest.records.filter(r=>selected.includes(r.family_id))){
  if(!r.source_page||!r.author||!r.license_url)throw new Error('Missing source attribution: '+r.family_id);
  const response=await fetch(r.image_url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(r.family_id+' HTTP '+response.status);
  const input=Buffer.from(await response.arrayBuffer()),files=[];
  if(r.optimized?.source_sha256&&sha(input)!==r.optimized.source_sha256)throw new Error('Source bytes changed; review before replacing '+r.family_id);
  for(const width of [320,480,960]){
    const {data,info}=await sharp(input).rotate().resize({width,withoutEnlargement:true}).webp({quality:78,effort:5}).toBuffer({resolveWithObject:true});
    if(files.some(f=>f.width===info.width))continue;
    const digest=sha(data),file='assets/vehicle-images/'+r.family_id+'-'+info.width+'-'+digest.slice(0,10)+'.webp';
    fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),data);
    files.push({path:file,width:info.width,height:info.height,bytes:data.length,sha256:digest});
  }
  r.optimized={source_sha256:sha(input),source_bytes:input.length,generated_on:new Date().toISOString().slice(0,10),transform:'Automatic orientation; width 320/480/960; WebP quality 78; no crop or content alteration.',files};
  r.changes='표시용 사본은 방향 보정·크기 조정·WebP 변환. 잘라내기나 내용 변경 없음.';
}
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('Optimized reviewed photos: '+selected.join(', '));
