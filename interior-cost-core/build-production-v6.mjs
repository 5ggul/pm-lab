import fs from 'node:fs';
import path from 'node:path';

const source=path.resolve('interior-cost-core/v6-review');
const out=path.resolve(process.env.OUT_DIR||'/tmp/interior-v6-production');
const rawBase=process.env.BASE_URL;
if(!rawBase) throw new Error('BASE_URL is required');
const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
if(!/^https:$/.test(base.protocol)) throw new Error('BASE_URL must use https');
const quoteSubmitEnabled=process.env.ENABLE_QUOTE_SUBMIT==='true';

fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

const webExt=new Set(['.html','.css','.js','.json','.svg','.webp','.png','.jpg','.jpeg','.ico','.txt']);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{const full=path.join(dir,ent.name);return ent.isDirectory()?walk(full):[full]})}
const files=walk(source);
for(const file of files){
  const ext=path.extname(file).toLowerCase();
  if(!webExt.has(ext)) continue;
  const rel=path.relative(source,file);
  const dest=path.join(out,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);
}

function esc(s=''){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function textTag(html,tag){return (html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))||[])[1]?.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()||''}
function meta(html,name){return (html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`,'i'))||[])[1]||''}
function pageUrl(rel){if(rel==='index.html')return new URL('',base).href;if(rel.endsWith('/index.html'))return new URL(rel.slice(0,-10),base).href;return new URL(rel,base).href}
function breadcrumb(rel,title){const parts=rel==='index.html'?[]:rel.replace(/\/index\.html$/,'').split('/').filter(Boolean);if(!parts.length)return null;const labels={guides:'가이드',cost:'공사별 비용','interior-cost':'평수별 비용','quote-check':'견적 검사','quote-compare':'견적 비교','quote-submit':'익명 견적',calculator:'계산기',checklist:'체크리스트',glossary:'용어사전',standards:'표준 공종','data-method':'데이터 기준',changelog:'변경이력',about:'소개',contact:'연락',privacy:'개인정보',terms:'이용약관',disclaimer:'면책',data:'데이터'};const items=[{name:'홈',item:new URL('',base).href}];let p='';parts.forEach((part,i)=>{p+=`${part}/`;items.push({name:i===parts.length-1?title.replace(/\s*\|.*$/,''):labels[part]||part,item:new URL(p,base).href})});return {'@type':'BreadcrumbList',itemListElement:items.map((x,i)=>({'@type':'ListItem',position:i+1,name:x.name,item:x.item}))}}
function schemas(rel,title,description,url){const list=[];const bc=breadcrumb(rel,title);if(bc)list.push(bc);if(rel==='index.html'){list.push({'@type':'Organization',name:'견적검수실',url});list.push({'@type':'WebSite',name:'견적검수실',url,description})}else if(/^(quote-check|quote-compare|calculator|checklist)\/index\.html$/.test(rel)){list.push({'@type':'WebApplication',name:title.replace(/\s*\|.*$/,''),url,description,applicationCategory:'UtilitiesApplication',operatingSystem:'Web browser',offers:{'@type':'Offer',price:'0',priceCurrency:'KRW'}})}else if(rel.startsWith('guides/')){list.push({'@type':'Article',headline:title.replace(/\s*\|.*$/,''),description,url,dateModified:'2026-09-10',inLanguage:'ko-KR',author:{'@type':'Organization',name:'견적검수실'}})}else if(rel==='data/construction-cost-index/index.html'){list.push({'@type':'Dataset',name:title.replace(/\s*\|.*$/,''),description,url,inLanguage:'ko-KR',creator:{'@type':'Organization',name:'견적검수실'},dateModified:'2026-09-10'})}return {'@context':'https://schema.org','@graph':list}}

const htmlFiles=walk(out).filter(f=>f.endsWith('.html'));
const sitemap=[];
for(const file of htmlFiles){
  const rel=path.relative(out,file).replaceAll(path.sep,'/');
  let html=fs.readFileSync(file,'utf8');
  const title=textTag(html,'title');const description=meta(html,'description');
  if(!title||!description) throw new Error(`Missing title/description: ${rel}`);
  const url=pageUrl(rel);const is404=rel==='404.html';const disabledSubmit=rel==='quote-submit/index.html'&&!quoteSubmitEnabled;const noindex=is404||disabledSubmit;
  html=html.replace(/<meta[^>]+name=["']robots["'][^>]*>/i,noindex?'<meta name="robots" content="noindex,nofollow">':'<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">');
  html=html.replace(/NOINDEX REVIEW/g,'견적검수실');
  if(!noindex){
    const graph=schemas(rel,title,description,url);
    const tags=`<link rel="canonical" href="${esc(url)}"><meta property="og:type" content="${rel.startsWith('guides/')?'article':'website'}"><meta property="og:locale" content="ko_KR"><meta property="og:site_name" content="견적검수실"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><script type="application/ld+json">${JSON.stringify(graph).replace(/</g,'\\u003c')}</script>`;
    html=html.replace('</head>',`${tags}</head>`);sitemap.push(url);
  }
  fs.writeFileSync(file,html);
}

const urls=[...new Set(sitemap)].sort();
const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`  <url><loc>${esc(u)}</loc><lastmod>2026-09-10</lastmod></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(out,'sitemap.xml'),xml);
fs.writeFileSync(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml',base).href}\n`);
console.log(JSON.stringify({ok:true,base_url:base.href,html_count:htmlFiles.length,indexable_count:urls.length,quote_submit_enabled:quoteSubmitEnabled,output:out},null,2));
