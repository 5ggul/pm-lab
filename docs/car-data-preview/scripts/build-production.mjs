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
   if(sub==='index.html'){
    // Public ownership tokens belong to the production homepage and survive regeneration.
    html=html.replace(/<meta\b[^>]*name="(?:google|naver)-site-verification"[^>]*>/g,'');
    assert(html.includes('</head>'),'Home missing head');
    html=html.replace('</head>','<meta name="google-site-verification" content="cf3JAkkg0CRbxH3Ca-2oeZ_WvRRadX4wc9TsQHBYwKc">\n<meta name="naver-site-verification" content="880621f4f133970ab62d9be0a296e5c6dbb77a57">\n</head>');
   }
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
// Pages applies these rules to static responses; temporary hosts stay out of search.
fs.writeFileSync(path.join(output,'_headers'),`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
/community
  X-Robots-Tag: noindex, nofollow, noarchive
  Cache-Control: no-store
/community/*
  X-Robots-Tag: noindex, nofollow, noarchive
  Cache-Control: no-store
/data/*
  Cache-Control: public, max-age=0, must-revalidate
/review-build.json
  Cache-Control: no-store
https://peekmycar.pages.dev/*
  X-Robots-Tag: noindex, nofollow, noarchive
https://:deployment.peekmycar.pages.dev/*
  X-Robots-Tag: noindex, nofollow, noarchive
`);
fs.writeFileSync(path.join(output,'_redirects'),`https://www.peekmycar.com/* https://peekmycar.com/:splat 301
/docs/car-data-preview / 301
/docs/car-data-preview/* /:splat 301
/car-data-preview / 301
/car-data-preview/* /:splat 301
`);
const sha=execFileSync('git',['-c',`safe.directory=${repo.replaceAll('\\','/').replace(/\/$/,'')}`,'rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const fuel=JSON.parse(fs.readFileSync(path.join(root,'data/fuel-price.json'),'utf8'));
const manifest={sha,builtAt:new Date().toISOString(),mode:'production',site:'픽마이카',origin,fuelDate:fuel.price_as_of,indexablePages:urls.length,homeSha256:createHash('sha256').update(fs.readFileSync(path.join(output,'index.html'))).digest('hex')};
fs.writeFileSync(path.join(output,'review-build.json'),JSON.stringify(manifest,null,2)+'\n');
// Validate Pages limits before upload.
let assetCount=0;
function validateAssets(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);
 if(entry.isDirectory())validateAssets(file);
 else{assetCount++;assert(fs.statSync(file).size<=25*1024*1024,'Pages asset exceeds 25 MiB: '+path.relative(output,file));}
}}
validateAssets(output);
assert(assetCount<=20000,'Pages asset count exceeds Free plan limit');
console.log(JSON.stringify({output,assetCount,...manifest}));
