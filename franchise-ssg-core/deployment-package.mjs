import fs from 'node:fs/promises';
import path from 'node:path';
import {computeCandidateTree,digestSealCore,sha256,stableStringify,walkFiles} from './release-provenance.mjs';

export async function buildFileManifest(root){
  const absolute=path.resolve(root);
  const files=await walkFiles(absolute);
  const entries=[];
  let totalBytes=0;
  for(const file of files){
    const rel=path.relative(absolute,file).replace(/\\/g,'/');
    const bytes=await fs.readFile(file);
    totalBytes+=bytes.length;
    entries.push({path:rel,bytes:bytes.length,sha256:sha256(bytes)});
  }
  return {entries,fileCount:entries.length,totalBytes,digest:sha256(stableStringify(entries))};
}

export async function copyTree(source,dest){
  const src=path.resolve(source),dst=path.resolve(dest);
  await fs.rm(dst,{recursive:true,force:true});
  await fs.mkdir(dst,{recursive:true});
  for(const file of await walkFiles(src)){
    const rel=path.relative(src,file);
    const target=path.join(dst,rel);
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.copyFile(file,target);
  }
}

export async function resolveRollbackContract({testMode=false,env=process.env}={}){
  if(testMode)return {ready:true,mode:'TEST_MODE_NOT_APPLICABLE',previousSeal:null};
  const mode=String(env.SSG_PRODUCTION_ROLLBACK_MODE||'').trim().toUpperCase();
  if(mode==='FIRST_DEPLOYMENT')return {ready:true,mode,previousSeal:null};
  if(mode!=='PREVIOUS_SEAL')return {ready:false,mode:mode||null,reason:'ROLLBACK_MODE_REQUIRED',previousSeal:null};
  const raw=String(env.SSG_PREVIOUS_PRODUCTION_SEAL||'').trim();
  if(!raw)return {ready:false,mode,reason:'PREVIOUS_SEAL_PATH_REQUIRED',previousSeal:null};
  let seal;
  try{seal=JSON.parse(await fs.readFile(path.resolve(raw),'utf8'))}
  catch(error){return {ready:false,mode,reason:'PREVIOUS_SEAL_UNREADABLE',error:error.message,previousSeal:null}}
  const shapeOk=seal?.kind==='franchise-production-candidate-seal'&&/^[0-9a-f]{64}$/i.test(String(seal?.sealDigest||''))&&/^[0-9a-f]{40}$/i.test(String(seal?.sourceHead||''))&&/^[0-9a-f]{64}$/i.test(String(seal?.candidateTreeHash||''));
  if(!shapeOk)return {ready:false,mode,reason:'PREVIOUS_SEAL_INVALID',previousSeal:null};
  const {sealDigest,...withTimestamp}=seal;
  const {sealedAt,...core}=withTimestamp;
  if(digestSealCore(core)!==sealDigest)return {ready:false,mode,reason:'PREVIOUS_SEAL_DIGEST_MISMATCH',previousSeal:null};
  return {ready:true,mode,previousSeal:{sealDigest:String(seal.sealDigest).toLowerCase(),sourceHead:String(seal.sourceHead).toLowerCase(),candidateTreeHash:String(seal.candidateTreeHash).toLowerCase(),productionSite:seal.productionSite||null}};
}

export function packageCore(manifest){
  return {
    schemaVersion:manifest.schemaVersion,
    kind:manifest.kind,
    testMode:Boolean(manifest.testMode),
    sourceHead:manifest.sourceHead,
    sealDigest:manifest.sealDigest,
    releaseInputFingerprint:manifest.releaseInputFingerprint,
    candidateTreeHash:manifest.candidateTreeHash,
    productionSite:manifest.productionSite,
    rollback:manifest.rollback,
    site:{
      path:manifest.site?.path,
      fileCount:manifest.site?.fileCount,
      totalBytes:manifest.site?.totalBytes,
      fileManifestDigest:manifest.site?.fileManifestDigest
    },
    deploymentPolicy:manifest.deploymentPolicy
  };
}

export function packageDigest(manifest){
  return digestSealCore(packageCore(manifest));
}

export async function verifyDeployPackage(packageRoot,{expectedSeal=null}={}){
  const root=path.resolve(packageRoot);
  const errors=[];
  let manifest=null;
  try{manifest=JSON.parse(await fs.readFile(path.join(root,'deployment-manifest.json'),'utf8'))}
  catch(error){return {ready:false,errors:['DEPLOYMENT_MANIFEST_MISSING_OR_INVALID'],error:error.message,manifest:null}}
  if(manifest.schemaVersion!==1||manifest.kind!=='franchise-production-deploy-package')errors.push('PACKAGE_SCHEMA_MISMATCH');
  if(packageDigest(manifest)!==manifest.packageDigest)errors.push('PACKAGE_DIGEST_MISMATCH');
  const siteRoot=path.join(root,String(manifest.site?.path||'site'));
  let tree=null,files=null;
  try{
    tree=await computeCandidateTree(siteRoot);
    files=await buildFileManifest(siteRoot);
  }catch(error){errors.push('PACKAGE_SITE_MISSING');}
  if(tree&&tree.digest!==manifest.candidateTreeHash)errors.push('PACKAGE_SITE_TREE_HASH_MISMATCH');
  if(files&&files.digest!==manifest.site?.fileManifestDigest)errors.push('PACKAGE_FILE_MANIFEST_DIGEST_MISMATCH');
  if(files&&files.fileCount!==manifest.site?.fileCount)errors.push('PACKAGE_FILE_COUNT_MISMATCH');
  if(files&&files.totalBytes!==manifest.site?.totalBytes)errors.push('PACKAGE_BYTE_COUNT_MISMATCH');
  if(files&&stableStringify(files.entries)!==stableStringify(manifest.files||[]))errors.push('PACKAGE_FILE_LIST_MISMATCH');
  const expectedChecksums=(manifest.files||[]).map(x=>`${x.sha256}  ${x.path}`).join('\n')+'\n';
  const actualChecksums=await fs.readFile(path.join(root,'checksums.sha256'),'utf8').catch(()=> '');
  if(actualChecksums!==expectedChecksums)errors.push('PACKAGE_CHECKSUM_FILE_MISMATCH');
  if(manifest.rollback?.ready!==true)errors.push('ROLLBACK_CONTRACT_NOT_READY');
  if(expectedSeal){
    for(const [field,a,b] of [
      ['SEAL_DIGEST',manifest.sealDigest,expectedSeal.sealDigest],
      ['SOURCE_HEAD',manifest.sourceHead,expectedSeal.sourceHead],
      ['RELEASE_INPUT_FINGERPRINT',manifest.releaseInputFingerprint,expectedSeal.releaseInputFingerprint],
      ['CANDIDATE_TREE_HASH',manifest.candidateTreeHash,expectedSeal.candidateTreeHash],
      ['PRODUCTION_SITE',manifest.productionSite,expectedSeal.productionSite]
    ])if(String(a??'')!==String(b??''))errors.push(`PACKAGE_${field}_DRIFT`);
  }
  return {ready:errors.length===0,errors,manifest,tree,files,siteRoot};
}

export function relativeFileUrl(rel){
  const clean=String(rel).replace(/\\/g,'/');
  if(clean==='index.html')return '/';
  if(clean.endsWith('/index.html'))return '/'+clean.slice(0,-'index.html'.length);
  return '/'+clean;
}
