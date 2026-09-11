import {pathToFileURL} from 'node:url';
import path from 'node:path';

const RESERVED_SUFFIXES=['.example','.invalid','.test','.localhost'];
const LOOPBACK=new Set(['localhost','127.0.0.1','0.0.0.0','::1']);

export function assessBaseUrl(raw,{allowPreviewHost=false}={}){
  const errors=[],warnings=[];let url=null;
  try{url=new URL(String(raw||''))}catch{errors.push('invalid-url')}
  if(url){
    const host=url.hostname.toLowerCase();
    if(url.protocol!=='https:')errors.push('https-required');
    if(url.username||url.password)errors.push('credentials-in-url');
    if(url.search||url.hash)errors.push('query-or-fragment-forbidden');
    if(LOOPBACK.has(host)||RESERVED_SUFFIXES.some(s=>host.endsWith(s)))errors.push(`non-production-host:${host}`);
    if((host==='github.io'||host.endsWith('.github.io'))&&!allowPreviewHost)errors.push(`preview-host-forbidden:${host}`);
    if(!url.pathname.endsWith('/'))warnings.push('normalized-trailing-slash');
    if(url.pathname!=='/'&&url.pathname.split('/').filter(Boolean).length>1)warnings.push('deep-base-path');
  }
  const normalized=url?new URL(url.pathname.endsWith('/')?url.href:`${url.href}/`).href:null;
  return {ok:errors.length===0,errors,warnings,normalized_base_url:normalized,host:url?.hostname||null,base_path:url?.pathname||null,preview_host:Boolean(url&&(url.hostname==='github.io'||url.hostname.endsWith('.github.io')))};
}

export function runCli(env=process.env){
  const result=assessBaseUrl(env.BASE_URL,{allowPreviewHost:env.ALLOW_PREVIEW_HOST==='true'});
  if(!result.ok){console.error(JSON.stringify(result,null,2));process.exit(1)}
  console.log(JSON.stringify(result,null,2));
  return result;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)runCli();
