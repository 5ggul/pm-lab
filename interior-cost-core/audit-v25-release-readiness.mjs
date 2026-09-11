import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const VERSION='25.0.0-baseline';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const exists=p=>fs.existsSync(path.join(ROOT,p));
const write=(p,c)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{
  const full=path.join(dir,ent.name);
  return ent.isDirectory()?walk(full):[full];
});
const rel=f=>path.relative(ROOT,f).split(path.sep).join('/');
const textOf=html=>html
  .replace(/<script[\s\S]*?<\/script>/gi,' ')
  .replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<!--([\s\S]*?)-->/g,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;|&#160;/g,' ')
  .replace(/&amp;/g,'&')
  .replace(/&lt;/g,'<')
  .replace(/&gt;/g,'>')
  .replace(/&quot;|&#34;/g,'"')
  .replace(/&#39;|&apos;/g,"'")
  .replace(/\s+/g,' ')
  .trim();
const one=(re,s)=>s.match(re)?.[1]?.trim()||'';
const routeToFile=href=>{
  if(!href||href.startsWith('#')||/^(?:https?:|mailto:|tel:|javascript:)/i.test(href))return null;
  const clean=href.split('#')[0].split('?')[0];
  let p=clean;
  if(p.startsWith(BASE))p=p.slice(BASE.length);
  else if(p.startsWith('/'))return null;
  p=p.replace(/^\/+/, '');
  if(!p)return 'index.html';
  if(p.endsWith('/'))return `${p}index.html`;
  return path.extname(p)?p:`${p}/index.html`;
};

const htmlFiles=walk(ROOT).filter(f=>f.endsWith('.html'));
const pages=[];
const titleMap=new Map();
const canonicalMap=new Map();
const devLeakTerms=[
  ['version-note',/\bv(?:2[0-9]|1[0-9])\b/gi],
  ['preview',/프리뷰|preview/gi],
  ['indexing-internal',/noindex|Search Console/gi],
  ['release-internal',/\bHOLD\b|\bRELEASE\b|출시 후보|검수 후보/gi],
  ['deployment-internal',/production\s*(?:전환|switch)?|광고 활성화/gi]
];
const surfacePath=p=>p==='index.html'||[
  'quote-check/index.html','quote-compare/index.html','calculator/index.html','compare/quote-lines/index.html','compare/reference-layers/index.html','interior-cost/matrix/index.html','data/index.html'
].includes(p)||p.startsWith('interior-cost/matrix/');

for(const f of htmlFiles){
  const p=rel(f),html=fs.readFileSync(f,'utf8'),text=textOf(html);
  const title=one(/<title>([\s\S]*?)<\/title>/i,html);
  const desc=one(/<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i,html)||one(/<meta\s+content=["']([^"']*)["']\s+name=["']description["'][^>]*>/i,html);
  const canonical=one(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i,html)||one(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["'][^>]*>/i,html);
  const robots=one(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["'][^>]*>/i,html);
  const h1s=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>textOf(m[1]));
  const jsonld=[];
  for(const m of html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{JSON.parse(m[1]);jsonld.push({ok:true});}catch(error){jsonld.push({ok:false,error:String(error?.message||error)});}
  }
  const leaks=[];
  if(surfacePath(p))for(const [kind,re] of devLeakTerms){
    const matches=[...text.matchAll(new RegExp(re.source,re.flags))].map(m=>m[0]);
    if(matches.length)leaks.push({kind,count:matches.length,samples:[...new Set(matches)].slice(0,5)});
  }
  const links=[];
  for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){
    const target=routeToFile(m[1]);
    if(target)links.push({href:m[1],target,exists:exists(target)});
  }
  const page={
    path:p,surface:surfacePath(p),text_chars:text.length,title,title_length:title.length,description:desc,description_length:desc.length,
    canonical,robots,h1_count:h1s.length,h1:h1s[0]||'',jsonld_count:jsonld.length,jsonld_errors:jsonld.filter(x=>!x.ok),
    internal_link_count:links.length,broken_links:links.filter(x=>!x.exists),dev_leaks:leaks
  };
  pages.push(page);
  if(title){if(!titleMap.has(title))titleMap.set(title,[]);titleMap.get(title).push(p);}
  if(canonical){if(!canonicalMap.has(canonical))canonicalMap.set(canonical,[]);canonicalMap.get(canonical).push(p);}
}

const surfacePages=pages.filter(x=>x.surface);
const duplicateTitles=[...titleMap.entries()].filter(([,v])=>v.length>1).map(([title,paths])=>({title,paths}));
const duplicateCanonicals=[...canonicalMap.entries()].filter(([,v])=>v.length>1).map(([canonical,paths])=>({canonical,paths}));
const policyPages=['about/index.html','contact/index.html','privacy/index.html','terms/index.html','disclaimer/index.html','editorial-policy/index.html','corrections/index.html'];
const sourceFiles=walk(ROOT).filter(f=>/\.(?:html|js|css|json|txt)$/i.test(f));
let adCode=false,forbiddenData=false;
for(const f of sourceFiles){
  const s=fs.readFileSync(f,'utf8');
  if(/adsbygoogle|pagead2\.googlesyndication\.com/i.test(s))adCode=true;
  if(/serviceKey|invstDeptTelNo|invstOfclNm|cntrctCorpTelNo/i.test(s))forbiddenData=true;
}

const metrics={
  html_pages:pages.length,
  surface_pages:surfacePages.length,
  preview_noindex_pages:pages.filter(x=>/noindex/i.test(x.robots)).length,
  surface_dev_leak_pages:surfacePages.filter(x=>x.dev_leaks.length).length,
  surface_dev_leak_hits:surfacePages.reduce((n,x)=>n+x.dev_leaks.reduce((m,l)=>m+l.count,0),0),
  title_missing:pages.filter(x=>!x.title).length,
  description_missing:pages.filter(x=>!x.description).length,
  canonical_missing:pages.filter(x=>!x.canonical).length,
  h1_issues:pages.filter(x=>x.h1_count!==1).length,
  jsonld_parse_errors:pages.reduce((n,x)=>n+x.jsonld_errors.length,0),
  broken_internal_links:pages.reduce((n,x)=>n+x.broken_links.length,0),
  duplicate_titles:duplicateTitles.length,
  duplicate_canonicals:duplicateCanonicals.length,
  thin_under_500:pages.filter(x=>x.text_chars<500).length,
  surface_thin_under_500:surfacePages.filter(x=>x.text_chars<500).length,
  title_over_65:pages.filter(x=>x.title_length>65).length,
  description_outside_40_170:pages.filter(x=>x.description&& (x.description_length<40||x.description_length>170)).length,
  policy_pages_present:policyPages.filter(exists).length,
  cname_present:exists('CNAME'),
  ad_code_present:adCode,
  forbidden_data_present:forbiddenData
};

const blockers=[];
if(metrics.surface_dev_leak_pages)blockers.push('surface_dev_copy');
if(metrics.title_missing)blockers.push('missing_title');
if(metrics.description_missing)blockers.push('missing_description');
if(metrics.canonical_missing)blockers.push('missing_canonical');
if(metrics.h1_issues)blockers.push('h1_count');
if(metrics.jsonld_parse_errors)blockers.push('jsonld_parse');
if(metrics.broken_internal_links)blockers.push('broken_internal_links');
if(metrics.duplicate_titles)blockers.push('duplicate_titles');
if(metrics.duplicate_canonicals)blockers.push('duplicate_canonicals');
if(metrics.surface_thin_under_500)blockers.push('surface_thin');
if(metrics.policy_pages_present!==policyPages.length)blockers.push('policy_pages');
if(metrics.cname_present)blockers.push('preview_cname');
if(metrics.ad_code_present)blockers.push('ads_in_preview');
if(metrics.forbidden_data_present)blockers.push('forbidden_data');
if(metrics.preview_noindex_pages!==metrics.html_pages)blockers.push('preview_indexable_page');

const report={
  version:VERSION,generated_at:new Date().toISOString(),metrics,blockers,
  warnings:{title_over_65:metrics.title_over_65,description_outside_40_170:metrics.description_outside_40_170,thin_under_500:metrics.thin_under_500},
  surface_dev_leaks:surfacePages.filter(x=>x.dev_leaks.length).map(x=>({path:x.path,dev_leaks:x.dev_leaks})),
  surface_pages:surfacePages.map(x=>({path:x.path,text_chars:x.text_chars,title_length:x.title_length,description_length:x.description_length,h1_count:x.h1_count,broken_links:x.broken_links.length,dev_leaks:x.dev_leaks})),
  duplicate_titles:duplicateTitles,
  duplicate_canonicals:duplicateCanonicals,
  broken_links:pages.filter(x=>x.broken_links.length).map(x=>({path:x.path,links:x.broken_links.slice(0,20)})),
  preview_boundary:{production_switch:false,search_console_submission:false,ads_injected:false,merge_to_main:false}
};
write('data/v25-release-readiness-baseline.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(blockers.length)throw new Error(`v25 baseline blockers: ${blockers.join(', ')}`);
