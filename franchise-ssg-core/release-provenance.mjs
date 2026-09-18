import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

export function sha256(value){
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function stableStringify(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableStringify(value[key])).join(',')+'}';
}

export async function walkFiles(root){
  const out=[];
  async function walk(dir){
    for(const ent of await fs.readdir(dir,{withFileTypes:true})){
      const p=path.join(dir,ent.name);
      if(ent.isDirectory())await walk(p);else out.push(p);
    }
  }
  await walk(path.resolve(root));
  return out.sort();
}

export async function computeCandidateTree(root){
  const absolute=path.resolve(root);
  const files=await walkFiles(absolute);
  const hash=crypto.createHash('sha256');
  let totalBytes=0;
  for(const file of files){
    const rel=path.relative(absolute,file).replace(/\\/g,'/');
    const bytes=await fs.readFile(file);
    totalBytes+=bytes.length;
    hash.update(rel);hash.update('\0');hash.update(bytes);hash.update('\0');
  }
  return {digest:hash.digest('hex'),fileCount:files.length,totalBytes};
}

async function fileSha(rawPath,repoRoot){
  const resolved=path.isAbsolute(String(rawPath))?path.resolve(String(rawPath)):path.resolve(repoRoot,String(rawPath));
  return sha256(await fs.readFile(resolved));
}

export async function fingerprintReleaseInputs(config,{repoRoot=process.cwd()}={}){
  const privacySha256=await fileSha(config?.legal?.privacyPolicySource,repoRoot);
  const termsSha256=await fileSha(config?.legal?.termsSource,repoRoot);
  const normalized={
    schemaVersion:config?.schemaVersion??null,
    productionSiteUrl:String(config?.productionSiteUrl??'').trim().replace(/\/$/,''),
    operator:{
      displayName:String(config?.operator?.displayName??'').trim(),
      legalName:String(config?.operator?.legalName??'').trim(),
      businessDisclosure:String(config?.operator?.businessDisclosure??'').trim(),
      address:String(config?.operator?.address??'').trim()
    },
    contact:{email:String(config?.contact?.email??'').trim().toLowerCase()},
    legal:{privacySha256,termsSha256},
    ads:{adsTxtLine:String(config?.ads?.adsTxtLine??'').trim()},
    releasePolicy:{
      indexOnlyProductionCandidates:config?.releasePolicy?.indexOnlyProductionCandidates,
      keepNonCandidatesNoindex:config?.releasePolicy?.keepNonCandidatesNoindex,
      requireManualApprovalBeforeDeploy:config?.releasePolicy?.requireManualApprovalBeforeDeploy,
      deployFromDryRun:config?.releasePolicy?.deployFromDryRun
    }
  };
  return {fingerprint:sha256(stableStringify(normalized)),normalized};
}

export function resolveSourceHead({repoRoot=process.cwd()}={}){
  for(const value of [process.env.SSG_RELEASE_SOURCE_SHA,process.env.SSG_QA_SOURCE_SHA,process.env.GITHUB_SHA]){
    const sha=String(value||'').trim();
    if(/^[0-9a-f]{40}$/i.test(sha))return sha.toLowerCase();
  }
  try{
    const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:repoRoot,encoding:'utf8'}).trim();
    if(/^[0-9a-f]{40}$/i.test(sha))return sha.toLowerCase();
  }catch{}
  throw new Error('Unable to resolve exact source HEAD for production provenance');
}

export function digestSealCore(core){
  return sha256(stableStringify(core));
}

export function evaluateDeployApproval({testMode,sealDigest,sourceHead,env=process.env}){
  const blockers=[];
  if(env.SSG_PRODUCTION_DEPLOY_APPROVED!=='YES')blockers.push('DEPLOY_APPROVAL_NOT_GRANTED');
  const approvedDigest=String(env.SSG_PRODUCTION_DEPLOY_DIGEST||'').trim().toLowerCase();
  if(!approvedDigest)blockers.push('DEPLOY_DIGEST_MISSING');
  else if(approvedDigest!==String(sealDigest||'').toLowerCase())blockers.push('DEPLOY_DIGEST_MISMATCH');
  const approvedSource=String(env.SSG_PRODUCTION_DEPLOY_SOURCE_SHA||'').trim().toLowerCase();
  if(!approvedSource)blockers.push('DEPLOY_SOURCE_SHA_MISSING');
  else if(approvedSource!==String(sourceHead||'').toLowerCase())blockers.push('DEPLOY_SOURCE_SHA_MISMATCH');
  if(blockers.length)return {ready:false,decision:'BLOCKED_SECOND_APPROVAL_REQUIRED',blockers};
  if(testMode)return {ready:false,decision:'BLOCKED_TEST_MODE_NEVER_DEPLOYS',blockers:['TEST_MODE_NEVER_DEPLOYS']};
  return {ready:true,decision:'READY_FOR_EXPLICIT_HOST_DEPLOY',blockers:[]};
}
