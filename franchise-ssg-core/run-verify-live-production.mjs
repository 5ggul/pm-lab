import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {relativeFileUrl,verifyDeployPackage} from './deployment-package.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const TEST_MODE=String(process.env.SSG_RELEASE_TEST_MODE||'').toLowerCase()==='true';
const defaultPackage=TEST_MODE?path.join(os.tmpdir(),'franchise-production-deploy-package'):path.join(repo,'build/franchise-production-deploy-package');
const packageRoot=path.resolve(process.env.SSG_PRODUCTION_DEPLOY_PACKAGE||defaultPackage);
const result=await verifyDeployPackage(packageRoot);
if(!result.ready){console.error(JSON.stringify({postDeployVerification:'BLOCKED_PACKAGE_INVALID',errors:result.errors},null,2));process.exit(1)}
const manifest=result.manifest;
const rawOrigin=String(process.env.SSG_LIVE_SITE_URL||'').trim().replace(/\/$/,'');
let origin;
try{origin=new URL(rawOrigin)}catch{console.error(JSON.stringify({postDeployVerification:'BLOCKED_LIVE_ORIGIN_INVALID'},null,2));process.exit(2)}
if(TEST_MODE){
  if(origin.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)){console.error(JSON.stringify({postDeployVerification:'BLOCKED_TEST_MODE_REQUIRES_LOOPBACK'},null,2));process.exit(2)}
}else{
  const expected=new URL(String(manifest.productionSite));
  if(origin.protocol!=='https:'||origin.origin!==expected.origin){console.error(JSON.stringify({postDeployVerification:'BLOCKED_LIVE_ORIGIN_MISMATCH',expected:expected.origin,actual:origin.origin},null,2));process.exit(2)}
}

const failures=[];let cursor=0;const entries=manifest.files||[];
async function verifyOne(entry){
  const pathname=relativeFileUrl(entry.path);
  const url=new URL(pathname,origin.origin+'/');
  try{
    const response=await fetch(url,{redirect:'follow',headers:{'cache-control':'no-cache'}});
    if(response.status!==200){failures.push({path:entry.path,url:url.href,reason:'HTTP_STATUS',status:response.status});return}
    const final=new URL(response.url);
    if(final.origin!==origin.origin){failures.push({path:entry.path,url:url.href,reason:'CROSS_ORIGIN_REDIRECT',final:final.href});return}
    const bytes=Buffer.from(await response.arrayBuffer());
    const digest=crypto.createHash('sha256').update(bytes).digest('hex');
    if(digest!==entry.sha256||bytes.length!==entry.bytes)failures.push({path:entry.path,url:url.href,reason:'BYTE_MISMATCH',expectedSha256:entry.sha256,actualSha256:digest,expectedBytes:entry.bytes,actualBytes:bytes.length});
  }catch(error){failures.push({path:entry.path,url:url.href,reason:'FETCH_ERROR',error:error.message})}
}
await Promise.all(Array.from({length:Math.min(8,Math.max(1,entries.length))},async()=>{while(cursor<entries.length){const entry=entries[cursor++];await verifyOne(entry)}}));
const report={
  schemaVersion:1,
  kind:'franchise-post-deploy-byte-verification',
  verifiedAt:new Date().toISOString(),
  testMode:TEST_MODE,
  liveOrigin:origin.origin,
  productionSite:manifest.productionSite,
  sourceHead:manifest.sourceHead,
  sealDigest:manifest.sealDigest,
  packageDigest:manifest.packageDigest,
  candidateTreeHash:manifest.candidateTreeHash,
  checkedFiles:entries.length,
  failureCount:failures.length,
  failures:failures.slice(0,100),
  exactPackageObserved:failures.length===0,
  productionDeployPerformedByThisTool:false
};
const defaultReport=TEST_MODE?path.join(os.tmpdir(),'franchise-post-deploy-report.json'):path.join(repo,'build/franchise-post-deploy-report.json');
const reportPath=path.resolve(process.env.SSG_POSTDEPLOY_REPORT||defaultReport);
await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({postDeployVerification:failures.length?'FAIL':'PASS',testMode:TEST_MODE,liveOrigin:origin.origin,checkedFiles:entries.length,failureCount:failures.length,sourceHead:manifest.sourceHead,sealDigest:manifest.sealDigest,packageDigest:manifest.packageDigest,productionDeployPerformedByThisTool:false},null,2));
if(failures.length)process.exit(1);
