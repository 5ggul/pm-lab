import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {siteConfig} from './site-config.mjs';
import {host404} from './build-host-404.mjs';
import {addCommunityToProduction} from '../../../community/production.mjs';

// Keep the shared Pages preview noindex; only this isolated release gets indexed.
const root=fileURLToPath(new URL('../',import.meta.url));
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const output=path.join(repo,'build/peekmycar-production');
const origin='https://peekmycar.com/';
execFileSync(process.execPath,[path.join(root,'scripts/build-index-quality-gate.mjs')],{stdio:'inherit'});
const report=JSON.parse(fs.readFileSync(path.join(root,'data/index-quality-gate.json'),'utf8'));
assert.equal(report.summary.failed,0);
const indexable=new Set(report.pages.filter(p=>p.status==='release_ready').map(p=>p.path.replace(/^\//,'')+'index.html'));
assert(indexable.has('index.html'),'Home must pass the release quality gate');
assert(output.startsWith(path.join(repo,'build')+path.sep));
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
const excluded=new Set(['scripts','raw','staging','.vercel']);
function copy(dir,rel=''){
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  if(excluded.has(e.name)||e.name.startsWith('.'))continue;
  const sub=path.posix.join(rel,e.name),src=path.join(dir,e.name),dest=path.join(output,sub);
  if(e.isDirectory()){copy(src,sub);continue;}
  if(!/\.(html|css|js|json|png|jpg|jpeg|webp|svg|ico|woff2?|mp4|webm|txt)$/i.test(e.name))continue;
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(e.name.endsWith('.html')){
   let html=fs.readFileSync(src,'utf8').replaceAll(siteConfig.baseUrl,origin);
   const robots=indexable.has(sub)?'index,follow,max-image-preview:large':'noindex,follow';
   html=html.replace(/<meta\b[^>]*name="robots"[^>]*>/g,`<meta name="robots" content="${robots}">`);
   assert(html.includes(`content="${robots}"`),sub+' missing robots policy');
   fs.writeFileSync(dest,html);
  }else fs.copyFileSync(src,dest);
 }
}
copy(root);
fs.writeFileSync(path.join(output,'404.html'),host404(origin));
addCommunityToProduction(output);
const urls=[...indexable].sort().map(p=>new URL(p.replace(/index\.html$/,''),origin).href);
fs.writeFileSync(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url=>`  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\n\nSitemap: ${origin}sitemap.xml\n`);
const config={framework:null,buildCommand:null,installCommand:null,outputDirectory:'.',trailingSlash:true,
 redirects:[{source:'/:path*',has:[{type:'host',value:'www.peekmycar.com'}],destination:origin+':path*',permanent:true},{source:'/docs/car-data-preview/:path*',destination:'/:path*',permanent:true},{source:'/car-data-preview/:path*',destination:'/:path*',permanent:true}],
 headers:[{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]},{source:'/data/:path*',headers:[{key:'Cache-Control',value:'public, max-age=0, must-revalidate'}]}]};
fs.writeFileSync(path.join(output,'vercel.json'),JSON.stringify(config,null,2)+'\n');
const sha=execFileSync('git',['-c',`safe.directory=${repo.replaceAll('\\','/').replace(/\/$/,'')}`,'rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const fuel=JSON.parse(fs.readFileSync(path.join(root,'data/fuel-price.json'),'utf8'));
const manifest={sha,builtAt:new Date().toISOString(),mode:'production',site:'픽마이카',origin,fuelDate:fuel.price_as_of,indexablePages:urls.length,homeSha256:createHash('sha256').update(fs.readFileSync(path.join(output,'index.html'))).digest('hex')};
fs.writeFileSync(path.join(output,'review-build.json'),JSON.stringify(manifest,null,2)+'\n');
// Explicit Build Output routes avoid the CLI's zero-build static fast path,
// which can upload files without applying vercel.json redirects/headers.
const bundle=path.join(output,'.vercel/output');
fs.mkdirSync(path.join(bundle,'static'),{recursive:true});
function copyBundle(src,dest){
 if(fs.statSync(src).isDirectory()){
  fs.mkdirSync(dest,{recursive:true});
  for(const name of fs.readdirSync(src))copyBundle(path.join(src,name),path.join(dest,name));
 }else fs.copyFileSync(src,dest);
}
for(const entry of fs.readdirSync(output)){
 if(entry==='.vercel'||entry==='vercel.json')continue;
 copyBundle(path.join(output,entry),path.join(bundle,'static',entry));
}
fs.writeFileSync(path.join(bundle,'config.json'),JSON.stringify({version:3,routes:[
 {src:'/(.*)',headers:{'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'},continue:true},
 {src:'/community(?:/.*)?',headers:{'X-Robots-Tag':'noindex, nofollow, noarchive','Cache-Control':'no-store'},continue:true},
 {src:'/data/(.*)',headers:{'Cache-Control':'public, max-age=0, must-revalidate'},continue:true},
 {src:'^/(?:docs/)?car-data-preview(?:/(.*))?$',headers:{Location:'/$1'},status:308},
 {src:'^/((?:[^/.]+/)*[^/.]+)$',headers:{Location:'/$1/'},status:308},
 {src:'^/$',dest:'/index.html'},
 {src:'^/(.*)/$',dest:'/$1/index.html'},
 {handle:'filesystem'},
 {src:'/.*',dest:'/404.html',status:404}
]},null,2)+'\n');
console.log(JSON.stringify({output,...manifest}));
