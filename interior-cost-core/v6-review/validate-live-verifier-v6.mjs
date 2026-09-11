import {verifyLive} from '../verify-live-v6.mjs';

const errors=[];
const base='https://interiorcost.kr/';
const core=['','quote-check/','quote-compare/','calculator/','checklist/','data/','sources/','privacy/'];
const html=(url,indexable=true)=>`<!doctype html><html><head><meta name="robots" content="${indexable?'index,follow':'noindex,nofollow'}">${indexable?`<link rel="canonical" href="${url}">`:''}</head><body><h1>test</h1></body></html>`;
const response=(url,status,body,type)=>({ok:status>=200&&status<300,status,url,headers:{get:n=>n.toLowerCase()==='content-type'?type:''},text:async()=>body});
function makeFetch({fullData=false,badCanonical=false}={}){
  const sitemapUrls=core.map(x=>new URL(x,base).href).concat(fullData?[new URL('reference-prices/',base).href,new URL('statistics/',base).href]:[]);
  const catalog={base_url:base,datasets:[{id:'public-unit-prices',indexable:fullData},{id:'quote-public-segments',indexable:fullData}]};
  const siteIndex={base_url:base,pages:core.map((x,i)=>({url:new URL(x,base).href,path:i?`/${x}`:'/'}))};
  return async input=>{
    const url=String(input),u=new URL(url),rel=u.pathname.slice(1);
    if(rel.startsWith('__live_verify_missing_'))return response(url,404,'not found','text/html');
    if(rel==='robots.txt')return response(url,200,`User-agent: *\nAllow: /\nSitemap: ${base}sitemap.xml\n`,'text/plain');
    if(rel==='sitemap.xml')return response(url,200,`<?xml version="1.0"?><urlset>${sitemapUrls.map(x=>`<url><loc>${x}</loc></url>`).join('')}</urlset>`,'application/xml');
    if(rel==='site-index.json')return response(url,200,JSON.stringify(siteIndex),'application/json');
    if(rel==='data/catalog.json')return response(url,200,JSON.stringify(catalog),'application/json');
    if(rel==='llms.txt')return response(url,200,`# test\n${base}`,'text/plain');
    if(rel==='reference-prices/'||rel==='statistics/')return response(url,200,html(url,fullData),'text/html');
    const coreRel=rel;
    if(core.includes(coreRel)){
      const expected=new URL(coreRel,base).href,can=badCanonical&&coreRel==='quote-check/'?`${base}wrong/`:expected;
      return response(url,200,html(can,true),'text/html');
    }
    return response(url,404,'not found','text/plain');
  };
}

const coreReport=await verifyLive({baseUrl:base,expectedReleaseMode:'core_only',fetchImpl:makeFetch(),minIndexablePages:5});
if(!coreReport.ok||coreReport.errors.length||coreReport.summary.core_pages_ok!==8||coreReport.summary.public_unit_prices_indexable!==false||coreReport.summary.quote_statistics_indexable!==false||!coreReport.safety.read_only)errors.push('core-only-happy-path');
const fullReport=await verifyLive({baseUrl:base,expectedReleaseMode:'full_data',fetchImpl:makeFetch({fullData:true}),minIndexablePages:5});
if(!fullReport.ok||!fullReport.summary.public_unit_prices_indexable||!fullReport.summary.quote_statistics_indexable)errors.push('full-data-happy-path');
const canonicalFail=await verifyLive({baseUrl:base,fetchImpl:makeFetch({badCanonical:true}),minIndexablePages:5});
if(canonicalFail.ok||!canonicalFail.errors.some(x=>x.startsWith('canonical:quote-check/')))errors.push('canonical-detection');
const preview=await verifyLive({baseUrl:'https://5ggul.github.io/pm-lab/interior-cost-preview/',fetchImpl:makeFetch(),minIndexablePages:5});
if(preview.ok||!preview.errors.some(x=>x.includes('preview-host-forbidden')))errors.push('preview-production-block');
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,core_only:true,full_data:true,canonical_detection:true,preview_production_block:true,core_pages:8,machine_outputs:5,data_page_indexability_matches_catalog:true,read_only:true,repository_write:false,production_deploy:false},null,2));
