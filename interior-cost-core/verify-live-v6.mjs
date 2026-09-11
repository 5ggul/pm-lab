import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assessBaseUrl} from './validate-release-base-url-v6.mjs';

const htmlPaths=['','quote-check/','quote-compare/','calculator/','checklist/','data/','sources/','privacy/'];
const machinePaths=['robots.txt','sitemap.xml','site-index.json','data/catalog.json','llms.txt'];
const dataPages={
  'reference-prices/':'public-unit-prices',
  'statistics/':'quote-public-segments'
};
const s=v=>String(v??'').trim();
const header=(res,name)=>{try{return s(res.headers?.get?.(name))}catch{return''}};
const robotsMeta=html=>(html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i)||[])[1]||'';
const canonical=html=>(html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)||[])[1]||'';
const locs=xml=>[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&'));
const elapsed=(start)=>Date.now()-start;

async function get(fetchImpl,url){
  const started=Date.now();
  try{
    const res=await fetchImpl(url,{redirect:'follow',headers:{accept:'text/html,application/json,text/plain,*/*','user-agent':'interior-cost-live-verifier/6.3'}});
    const text=await res.text();
    return {ok:Boolean(res.ok),status:Number(res.status)||0,url:s(res.url)||url,content_type:header(res,'content-type'),text,ms:elapsed(started)};
  }catch(error){return {ok:false,status:0,url,content_type:'',text:'',ms:elapsed(started),error:s(error?.message||error)}}
}

export async function verifyLive({baseUrl,expectedReleaseMode='core_only',fetchImpl=fetch,minIndexablePages=35}={}){
  const baseCheck=assessBaseUrl(baseUrl),errors=[],warnings=[],requests=[];
  if(!baseCheck.ok)return {ok:false,base_url:baseCheck.normalized_base_url||baseUrl,expected_release_mode:expectedReleaseMode,errors:baseCheck.errors.map(x=>`base:${x}`),warnings:baseCheck.warnings||[],requests:[],summary:{core_pages_ok:0,core_pages_total:htmlPaths.length,indexable_pages:0,public_unit_prices_indexable:null,quote_statistics_indexable:null}};
  const base=new URL(baseCheck.normalized_base_url);
  const fetchPath=async rel=>{const r=await get(fetchImpl,new URL(rel,base).href);requests.push({path:rel||'/',status:r.status,final_url:r.url,content_type:r.content_type,ms:r.ms,error:r.error||null});return r};

  let coreOk=0;
  for(const rel of htmlPaths){
    const r=await fetchPath(rel),label=rel||'/';
    if(r.status!==200){errors.push(`http:${label}:${r.status}`);continue}
    if(!/text\/html/i.test(r.content_type))warnings.push(`content-type:${label}:${r.content_type||'missing'}`);
    if(r.text.includes('NOINDEX REVIEW'))errors.push(`review-marker:${label}`);
    const robots=robotsMeta(r.text);
    if(!/index\s*,?\s*follow/i.test(robots)||/noindex/i.test(robots))errors.push(`core-robots:${label}:${robots||'missing'}`);
    const can=canonical(r.text),expected=new URL(rel,base).href;
    if(can!==expected)errors.push(`canonical:${label}:${can||'missing'}!=${expected}`);
    if(r.url!==expected)warnings.push(`redirect:${label}:${r.url}`);
    if(!errors.some(x=>x.includes(`:${label}:`)||x.endsWith(`:${label}`)))coreOk++;
  }

  const robots=await fetchPath('robots.txt'),sitemap=await fetchPath('sitemap.xml'),siteIndexRes=await fetchPath('site-index.json'),catalogRes=await fetchPath('data/catalog.json'),llms=await fetchPath('llms.txt');
  for(const [name,r] of [['robots',robots],['sitemap',sitemap],['site-index',siteIndexRes],['catalog',catalogRes],['llms',llms]])if(r.status!==200)errors.push(`${name}-http:${r.status}`);
  if(robots.status===200&&!robots.text.includes(`Sitemap: ${new URL('sitemap.xml',base).href}`))errors.push('robots-sitemap');
  const sitemapUrls=sitemap.status===200?locs(sitemap.text):[];
  if(sitemap.status===200){for(const u of sitemapUrls)if(!u.startsWith(base.href))errors.push(`sitemap-outside-base:${u}`)}
  let siteIndex=null,catalog=null;
  try{siteIndex=JSON.parse(siteIndexRes.text)}catch{if(siteIndexRes.status===200)errors.push('site-index-json')}
  try{catalog=JSON.parse(catalogRes.text)}catch{if(catalogRes.status===200)errors.push('catalog-json')}
  if(siteIndex){if(siteIndex.base_url!==base.href)errors.push(`site-index-base:${siteIndex.base_url}`);if(!Array.isArray(siteIndex.pages)||siteIndex.pages.length<minIndexablePages)errors.push(`site-index-floor:${siteIndex.pages?.length||0}/${minIndexablePages}`)}
  if(catalog?.base_url!==base.href)errors.push(`catalog-base:${catalog?.base_url||'missing'}`);
  if(llms.status===200&&!llms.text.includes(base.href))errors.push('llms-base');

  const datasets=Object.fromEntries((catalog?.datasets||[]).map(x=>[x.id,x]));
  const publicIndexable=datasets['public-unit-prices']?.indexable===true;
  const quoteIndexable=datasets['quote-public-segments']?.indexable===true;
  if(expectedReleaseMode==='full_data'&&(!publicIndexable||!quoteIndexable))errors.push('full-data-catalog-not-ready');
  for(const [rel,id] of Object.entries(dataPages)){
    const r=await fetchPath(rel);if(r.status!==200){errors.push(`data-page-http:${rel}:${r.status}`);continue}
    const indexable=datasets[id]?.indexable===true,robots=robotsMeta(r.text),can=canonical(r.text),url=new URL(rel,base).href,inMap=sitemapUrls.includes(url);
    if(indexable){if(/noindex/i.test(robots)||!/index/i.test(robots))errors.push(`data-index-robots:${rel}:${robots}`);if(can!==url)errors.push(`data-index-canonical:${rel}`);if(!inMap)errors.push(`data-index-sitemap:${rel}`)}
    else{if(!/noindex/i.test(robots))errors.push(`data-gated-robots:${rel}:${robots}`);if(inMap)errors.push(`data-gated-sitemap:${rel}`)}
  }

  const notFound=await fetchPath(`__live_verify_missing_${Date.now()}/`);
  if(notFound.status!==404)warnings.push(`404-status:${notFound.status}`);
  const maxMs=Math.max(0,...requests.map(x=>x.ms));
  const report={
    schema_version:'1.0',generated_at:new Date().toISOString(),base_url:base.href,expected_release_mode:expectedReleaseMode,ok:errors.length===0,
    summary:{core_pages_ok:coreOk,core_pages_total:htmlPaths.length,indexable_pages:Array.isArray(siteIndex?.pages)?siteIndex.pages.length:0,sitemap_urls:sitemapUrls.length,public_unit_prices_indexable:publicIndexable,quote_statistics_indexable:quoteIndexable,request_count:requests.length,max_response_ms:maxMs},
    errors,warnings,requests,
    safety:{read_only:true,repository_write:false,production_deploy:false}
  };
  return report;
}

export async function main(env=process.env){
  const out=path.resolve(env.LIVE_VERIFY_OUT||'/tmp/interior-v6-live-verify.json');
  const report=await verifyLive({baseUrl:env.BASE_URL,expectedReleaseMode:env.EXPECTED_RELEASE_MODE||'core_only',minIndexablePages:Math.max(1,Number(env.MIN_INDEXABLE_PAGES)||35)});
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.ok,output:out,base_url:report.base_url,expected_release_mode:report.expected_release_mode,...report.summary,error_count:report.errors.length,warning_count:report.warnings.length,read_only:true,production_deploy:false},null,2));
  if(env.LIVE_VERIFY_STRICT!=='false'&&!report.ok)process.exit(2);
  return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
