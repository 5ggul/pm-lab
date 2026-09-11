import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const out=path.resolve(process.env.OUT_DIR||'/tmp/interior-v6-production');
const manifestPath=path.join(out,'release-manifest.json'),checksumPath=path.join(out,'release-manifest.sha256');
const errors=[];
const sha256=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const rel=f=>path.relative(out,f).replaceAll(path.sep,'/');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]})}
if(!fs.existsSync(manifestPath))errors.push('manifest-missing');
if(!fs.existsSync(checksumPath))errors.push('checksum-missing');
const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{};
if(manifest.schema_version!=='1.0')errors.push('schema-version');
if(!/^\d{4}-\d{2}-\d{2}$/.test(String(manifest.reviewed_on||'')))errors.push('review-date');
if(manifest.hash_algorithm!=='sha256')errors.push('hash-algorithm');
const rows=Array.isArray(manifest.files)?manifest.files:[];
if(rows.length!==Number(manifest.file_count))errors.push(`file-count:${rows.length}/${manifest.file_count}`);
const forbiddenPath=/(^|\/)(?:quote-admin|raw|pending|private|secret|secrets)(?:\/|$)|(^|\/)\.env(?:\.|$)|\.(?:sql|toml|mjs)$|(^|\/)(?:preflight-request|release-preflight-request)\.json$/i;
const forbiddenContent=/(?:DATA_GO_KR_SERVICE_KEY\s*=|KOSIS_API_KEY\s*=|ADMIN_BEARER_TOKEN\s*=|authorization:\s*bearer\s+[A-Za-z0-9._-]{12,})/i;
let total=0;
for(const row of rows){
  const file=path.join(out,row.path);
  if(!fs.existsSync(file)){errors.push(`missing:${row.path}`);continue}
  const buf=fs.readFileSync(file);total+=buf.length;
  if(buf.length!==row.bytes)errors.push(`bytes:${row.path}`);
  if(sha256(buf)!==row.sha256)errors.push(`sha256:${row.path}`);
  if(forbiddenPath.test(row.path))errors.push(`forbidden-path:${row.path}`);
  if(/\.(?:html|js|json|txt|xml|css)$/i.test(row.path)){
    const text=buf.toString('utf8');
    if(forbiddenContent.test(text))errors.push(`forbidden-content:${row.path}`);
    if(/\.html$/i.test(row.path)&&text.includes('NOINDEX REVIEW'))errors.push(`review-marker:${row.path}`)
  }
}
if(total!==Number(manifest.total_bytes))errors.push(`total-bytes:${total}/${manifest.total_bytes}`);
const listed=new Set(rows.map(x=>x.path));
for(const required of ['index.html','sitemap.xml','robots.txt','site-index.json','data/catalog.json','llms.txt'])if(!listed.has(required))errors.push(`required-not-manifested:${required}`);
const actual=fs.existsSync(out)?walk(out).map(rel).filter(p=>p!=='release-manifest.json'&&p!=='release-manifest.sha256').sort((a,b)=>a.localeCompare(b,'en')):[];
for(const p of actual){if(!listed.has(p))errors.push(`unmanifested:${p}`);if(forbiddenPath.test(p))errors.push(`forbidden-actual:${p}`)}
for(const p of listed)if(!actual.includes(p))errors.push(`manifest-only:${p}`);
if(actual.length!==listed.size)errors.push(`exact-file-set:${actual.length}/${listed.size}`);
const manifestHash=fs.existsSync(manifestPath)?sha256(fs.readFileSync(manifestPath)):'';
const checksum=fs.existsSync(checksumPath)?fs.readFileSync(checksumPath,'utf8').trim():'';
if(checksum!==`${manifestHash}  release-manifest.json`)errors.push('manifest-checksum');
if(listed.has('release-manifest.json')||listed.has('release-manifest.sha256'))errors.push('self-hash-included');
if(errors.length){console.error(JSON.stringify({ok:false,errors:errors.slice(0,120),error_count:errors.length},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,file_count:rows.length,actual_file_count:actual.length,exact_file_set:true,total_bytes:total,manifest_sha256:manifestHash,forbidden_assets:0,operational_request_json:0,rendered_review_markers:0,policy_marker_documentation_allowed:true,required_outputs:6},null,2));
