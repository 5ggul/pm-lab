import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateReleaseConfig} from './release-input-contract.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const raw=String(process.env.SSG_RELEASE_CONFIG||'').trim();
const configPath=raw?(path.isAbsolute(raw)?raw:path.resolve(repo,raw)):path.join(here,'release-config.local.json');

let configText='';
try{configText=await fs.readFile(configPath,'utf8')}catch{
  console.error(JSON.stringify({releaseInputValidation:'BLOCKED',reason:'RELEASE_CONFIG_NOT_FOUND',configPath:path.relative(repo,configPath).replace(/\\/g,'/')},null,2));
  process.exit(2);
}

let config=null;
try{config=JSON.parse(configText)}catch(error){
  console.error(JSON.stringify({releaseInputValidation:'BLOCKED',reason:'RELEASE_CONFIG_INVALID_JSON',error:error.message},null,2));
  process.exit(2);
}

const result=await validateReleaseConfig(config,{repoRoot:repo});
const summary={
  releaseInputValidation:result.ready?'PASS':'BLOCKED',
  configPath:path.relative(repo,configPath).replace(/\\/g,'/'),
  productionOrigin:result.productionSite.value,
  blockerCount:result.blockers.length,
  blockers:result.blockers,
  warnings:result.warnings,
  legal:{
    privacy:{configured:result.legal.privacy.configured,exists:result.legal.privacy.exists,chars:result.legal.privacy.chars,final:result.legal.privacy.final,reasons:result.legal.privacy.reasons},
    terms:{configured:result.legal.terms.configured,exists:result.legal.terms.exists,chars:result.legal.terms.chars,final:result.legal.terms.final,reasons:result.legal.terms.reasons}
  },
  ads:{configured:result.ads.configured,valid:result.ads.valid,reasons:result.ads.reasons},
  safeToRequestCandidateBuildApproval:result.ready
};
console.log(JSON.stringify(summary,null,2));
if(!result.ready)process.exit(2);
