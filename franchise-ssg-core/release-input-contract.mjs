import fs from 'node:fs/promises';
import path from 'node:path';

export const REQUIRED_RELEASE_POLICY=Object.freeze({
  indexOnlyProductionCandidates:true,
  keepNonCandidatesNoindex:true,
  requireManualApprovalBeforeDeploy:true,
  deployFromDryRun:false
});

const RESERVED_HOST_PATTERNS=[
  /(^|\.)localhost$/i,
  /(^|\.)invalid$/i,
  /(^|\.)test$/i,
  /(^|\.)example$/i,
  /(^|\.)local$/i,
  /(^|\.)github\.io$/i
];
const RESERVED_EXACT_HOSTS=new Set(['127.0.0.1','0.0.0.0','::1','example.com','example.org','example.net']);
const PLACEHOLDER_TEXT=/^__.*__$|\bTODO\b|\bTBD\b|준비\s*중|추후\s*반영/i;

export function isPlaceholder(value){
  const text=String(value??'').trim();
  return !text||PLACEHOLDER_TEXT.test(text);
}

export function inspectProductionOrigin(value){
  const raw=String(value??'').trim();
  const reasons=[];
  if(isPlaceholder(raw))reasons.push('REQUIRED');
  let url=null;
  if(!reasons.length){
    try{url=new URL(raw)}catch{reasons.push('INVALID_URL')}
  }
  if(url){
    if(url.protocol!=='https:')reasons.push('HTTPS_REQUIRED');
    if(url.username||url.password)reasons.push('CREDENTIALS_NOT_ALLOWED');
    if(url.pathname!=='/')reasons.push('PATH_NOT_ALLOWED');
    if(url.search)reasons.push('QUERY_NOT_ALLOWED');
    if(url.hash)reasons.push('HASH_NOT_ALLOWED');
    const host=url.hostname.toLowerCase();
    if(RESERVED_EXACT_HOSTS.has(host)||RESERVED_HOST_PATTERNS.some(re=>re.test(host)))reasons.push('RESERVED_OR_PREVIEW_HOST_NOT_ALLOWED');
  }
  const valid=reasons.length===0;
  return {
    configured:!isPlaceholder(raw),
    valid,
    value:valid?`${url.protocol}//${url.host}`:null,
    reasons:[...new Set(reasons)]
  };
}

export function inspectContactEmail(value){
  const raw=String(value??'').trim();
  const reasons=[];
  if(isPlaceholder(raw))reasons.push('REQUIRED');
  if(!reasons.length&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw))reasons.push('INVALID_EMAIL');
  const domain=raw.includes('@')?raw.slice(raw.lastIndexOf('@')+1).toLowerCase():'';
  if(domain&&(RESERVED_EXACT_HOSTS.has(domain)||RESERVED_HOST_PATTERNS.some(re=>re.test(domain))))reasons.push('RESERVED_EMAIL_DOMAIN_NOT_ALLOWED');
  return {configured:!isPlaceholder(raw),valid:reasons.length===0,reasons:[...new Set(reasons)]};
}

export async function inspectLegalSource(label,rawPath,{repoRoot}={}){
  const configured=!isPlaceholder(rawPath);
  if(!configured)return {label,configured:false,exists:false,chars:0,final:false,path:null,reasons:['PATH_NOT_CONFIGURED']};
  const root=repoRoot?path.resolve(repoRoot):process.cwd();
  const resolved=path.isAbsolute(String(rawPath))?path.resolve(String(rawPath)):path.resolve(root,String(rawPath));
  let text='';
  try{text=await fs.readFile(resolved,'utf8')}catch{return {label,configured:true,exists:false,chars:0,final:false,path:String(rawPath),reasons:['SOURCE_NOT_FOUND']}}
  const reasons=[];
  const trimmed=text.trim();
  if(trimmed.length<400)reasons.push('SOURCE_TOO_SHORT');
  if(/__REQUIRED_|\bTODO\b|\bTBD\b|현재 외부 검수용 프리뷰|확정된 뒤|반영한 뒤 공개|추후 반영|준비\s*중/i.test(trimmed))reasons.push('PLACEHOLDER_OR_PREVIEW_COPY_REMAINS');
  const required=label==='privacy'?[/개인정보/,/처리|수집|이용/]:[/이용약관|약관/,/서비스|이용/];
  if(!required.every(re=>re.test(trimmed)))reasons.push('REQUIRED_SECTION_MARKER_MISSING');
  return {label,configured:true,exists:true,chars:trimmed.length,final:reasons.length===0,path:String(rawPath),reasons};
}

export function inspectAdsTxtLine(value){
  const raw=String(value??'').trim();
  if(!raw||/^__OPTIONAL_/i.test(raw))return {configured:false,valid:true,reasons:[]};
  const reasons=[];
  if(/[\r\n]/.test(raw))reasons.push('MULTILINE_NOT_ALLOWED');
  const parts=raw.split(',').map(x=>x.trim());
  if(parts.length<3||parts.length>4)reasons.push('EXPECTED_3_OR_4_FIELDS');
  if(parts.length>=3){
    if(!/^[a-z0-9.-]+$/i.test(parts[0]||'')||!(parts[0]||'').includes('.'))reasons.push('INVALID_AD_SYSTEM_DOMAIN');
    if(!(parts[1]||''))reasons.push('PUBLISHER_ACCOUNT_REQUIRED');
    if(!/^(DIRECT|RESELLER)$/i.test(parts[2]||''))reasons.push('RELATIONSHIP_MUST_BE_DIRECT_OR_RESELLER');
    if(parts[3]&&!/^[a-z0-9]+$/i.test(parts[3]))reasons.push('INVALID_CERT_AUTHORITY_ID');
  }
  return {configured:true,valid:reasons.length===0,reasons:[...new Set(reasons)]};
}

export async function validateReleaseConfig(config,{repoRoot}={}){
  const blockers=[];
  const warnings=[];
  const add=(field,reason)=>blockers.push({field,reason});

  const schemaVersion=config?.schemaVersion;
  if(schemaVersion!==1)add('schemaVersion','SCHEMA_VERSION_MUST_BE_1');

  const productionSite=inspectProductionOrigin(config?.productionSiteUrl);
  for(const reason of productionSite.reasons)add('productionSiteUrl',reason);

  const operator={};
  for(const [key,value] of Object.entries({
    displayName:config?.operator?.displayName,
    legalName:config?.operator?.legalName,
    businessDisclosure:config?.operator?.businessDisclosure,
    address:config?.operator?.address
  })){
    const ready=!isPlaceholder(value);
    operator[key]={ready};
    if(!ready)add(`operator.${key}`,'REQUIRED_FINAL_VALUE');
  }

  const contactEmail=inspectContactEmail(config?.contact?.email);
  for(const reason of contactEmail.reasons)add('contact.email',reason);

  const privacy=await inspectLegalSource('privacy',config?.legal?.privacyPolicySource,{repoRoot});
  const terms=await inspectLegalSource('terms',config?.legal?.termsSource,{repoRoot});
  for(const reason of privacy.reasons)add('legal.privacyPolicySource',reason);
  for(const reason of terms.reasons)add('legal.termsSource',reason);

  const policy={};
  for(const [key,expected] of Object.entries(REQUIRED_RELEASE_POLICY)){
    const actual=config?.releasePolicy?.[key];
    const ok=actual===expected;
    policy[key]={expected,actual,ok};
    if(!ok)add(`releasePolicy.${key}`,`MUST_EQUAL_${String(expected).toUpperCase()}`);
  }

  const ads=inspectAdsTxtLine(config?.ads?.adsTxtLine);
  if(ads.configured&&!ads.valid){
    for(const reason of ads.reasons)add('ads.adsTxtLine',reason);
  }else if(!ads.configured){
    warnings.push('ADS_TXT_NOT_CONFIGURED_YET');
  }

  const missing=[...new Set(blockers.map(x=>x.field))];
  return {
    schemaVersion,
    ready:blockers.length===0,
    missing,
    blockers,
    warnings,
    productionSite,
    operator,
    contact:{email:contactEmail},
    legal:{privacy,terms},
    policy,
    ads
  };
}
