import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const out=path.resolve(process.env.OUT_DIR||'/tmp/interior-v6-production');
const contractFile=path.join(out,'data/data-contract.json');
const contract=(()=>{try{return JSON.parse(fs.readFileSync(contractFile,'utf8'))}catch{return{}}})();
const reviewedOn=/^\d{4}-\d{2}-\d{2}$/.test(String(contract.reviewed_on||''))?contract.reviewed_on:null;
if(!reviewedOn)throw new Error('reviewed_on missing from production data contract');
const manifestPath=path.join(out,'release-manifest.json'),checksumPath=path.join(out,'release-manifest.sha256');
const exclude=new Set(['release-manifest.json','release-manifest.sha256']);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]})}
const rel=f=>path.relative(out,f).replaceAll(path.sep,'/');
const sha256=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const files=walk(out).filter(f=>!exclude.has(rel(f))).map(file=>{const buf=fs.readFileSync(file);return{path:rel(file),bytes:buf.length,sha256:sha256(buf)}}).sort((a,b)=>a.path.localeCompare(b.path,'en'));
const manifest={schema_version:'1.0',reviewed_on:reviewedOn,source_commit:process.env.SOURCE_COMMIT||process.env.GITHUB_SHA||null,base_url:process.env.BASE_URL||null,file_count:files.length,total_bytes:files.reduce((s,x)=>s+x.bytes,0),hash_algorithm:'sha256',files};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const manifestHash=sha256(fs.readFileSync(manifestPath));
fs.writeFileSync(checksumPath,`${manifestHash}  release-manifest.json\n`);
console.log(JSON.stringify({ok:true,manifest:manifestPath,checksum:checksumPath,file_count:manifest.file_count,total_bytes:manifest.total_bytes,reviewed_on:reviewedOn,manifest_sha256:manifestHash},null,2));
