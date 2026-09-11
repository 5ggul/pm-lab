import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.env.OUT_DIR||'/tmp/interior-v6-production');
const base=new URL(process.env.BASE_URL||'https://example.test/');
const quoteSubmitEnabled=process.env.ENABLE_QUOTE_SUBMIT==='true';
const errors=[];
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]})}
const htmlFiles=walk(root).filter(f=>f.endsWith('.html'));
const titles=new Map(),descs=new Map();
function attr(html,selector,name){const re=name==='canonical'?/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i:new RegExp(`<meta[^>]+(?:name|property)=["']${selector}["'][^>]+content=["']([^"']*)["']`,'i');return (html.match(re)||[])[1]||''}
function targetFor(from,href){if(!href||href.startsWith('#')||/^(https?:|mailto:|tel:|javascript:)/i.test(href))return null;const clean=href.split('#')[0].split('?')[0];if(!clean)return null;const fromDir=path.dirname(path.relative(root,from));let rel=path.posix.normalize(path.posix.join(fromDir.replaceAll(path.sep,'/'),clean));if(clean.endsWith('/'))rel=path.posix.join(rel,'index.html');else if(!path.extname(rel))rel=path.posix.join(rel,'index.html');return path.join(root,...rel.split('/'))}
const trustTargets=['about/','contact/','privacy/','terms/','disclaimer/','data-method/'].map(p=>new URL(p,base).href);
let expectedIndexable=0;
for(const file of htmlFiles){
 const rel=path.relative(root,file).replaceAll(path.sep,'/'),html=fs.readFileSync(file,'utf8'),is404=rel==='404.html',disabledSubmit=rel==='quote-submit/index.html'&&!quoteSubmitEnabled,noindexExpected=is404||disabledSubmit;
 const title=(html.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]?.trim()||'';const desc=attr(html,'description');
 if((html.match(/<h1\b/g)||[]).length!==1)errors.push(`h1:${rel}`);if(!title)errors.push(`title:${rel}`);if(!desc)errors.push(`description:${rel}`);
 if(title){if(titles.has(title))errors.push(`duplicate-title:${rel}:${titles.get(title)}`);else titles.set(title,rel)}
 if(desc){if(descs.has(desc))errors.push(`duplicate-description:${rel}:${descs.get(desc)}`);else descs.set(desc,rel)}
 if(noindexExpected){if(!/name=["']robots["'][^>]+noindex/i.test(html))errors.push(`expected-noindex:${rel}`);continue}
 expectedIndexable++;
 if(/name=["']robots["'][^>]+noindex/i.test(html))errors.push(`noindex:${rel}`);
 const canonical=attr(html,'','canonical');if(!canonical||!canonical.startsWith(base.href))errors.push(`canonical:${rel}`);
 for(const key of ['og:title','og:description','og:url','twitter:card'])if(!attr(html,key))errors.push(`${key}:${rel}`);
 if(!html.includes('application/ld+json'))errors.push(`schema:${rel}`);
 if(rel==='statistics/index.html'){
   if(!html.includes('"@type":"WebApplication"'))errors.push('statistics-schema-webapplication');
   if(!html.includes('"@type":"Dataset"'))errors.push('statistics-schema-dataset');
   if(!html.includes('quote-public-segments.json'))errors.push('statistics-schema-dataset-link');
 }
 if(!html.includes('production-v6.css'))errors.push(`production-style:${rel}`);
 if(!html.includes('production-trust-links'))errors.push(`trust-nav:${rel}`);
 for(const target of trustTargets)if(!html.includes(`href="${target}"`))errors.push(`trust-link:${rel}->${target}`);
 const hrefs=[...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]);for(const href of hrefs){const target=targetFor(file,href);if(target&&!fs.existsSync(target))errors.push(`broken-link:${rel}->${href}`)}
}
const sitemapPath=path.join(root,'sitemap.xml'),robotsPath=path.join(root,'robots.txt'),prodCss=path.join(root,'assets/production-v6.css');
if(!fs.existsSync(sitemapPath))errors.push('missing:sitemap.xml');if(!fs.existsSync(robotsPath))errors.push('missing:robots.txt');if(!fs.existsSync(prodCss))errors.push('missing:production-v6.css');
let sitemapCount=0;if(fs.existsSync(sitemapPath)){const sm=fs.readFileSync(sitemapPath,'utf8');sitemapCount=(sm.match(/<url>/g)||[]).length;if(sitemapCount!==expectedIndexable)errors.push(`sitemap-count:${sitemapCount}/${expectedIndexable}`);if(sm.includes('/404.html'))errors.push('sitemap-404');if(!quoteSubmitEnabled&&sm.includes('/quote-submit/'))errors.push('sitemap-disabled-quote-submit');if(!sm.includes(new URL('statistics/',base).href))errors.push('sitemap-statistics')}
if(fs.existsSync(robotsPath)){const r=fs.readFileSync(robotsPath,'utf8');if(!r.includes(`Sitemap: ${new URL('sitemap.xml',base).href}`))errors.push('robots-sitemap');if(!r.includes('Allow: /'))errors.push('robots-allow')}
if(errors.length){console.error(JSON.stringify({ok:false,errors:errors.slice(0,100),error_count:errors.length},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,html_count:htmlFiles.length,indexable_count:expectedIndexable,unique_titles:titles.size,unique_descriptions:descs.size,sitemap_count:sitemapCount,static_trust_links:trustTargets.length,statistics_indexable:true,statistics_schema:['WebApplication','Dataset'],quote_submit_enabled:quoteSubmitEnabled,base_url:base.href},null,2));
