import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
await import('./build-catalog-list-index.mjs');
const records=read('data/vehicle-image-sources.json').records,byUrl=new Map(records.filter(r=>r.optimized).map(r=>[r.image_url,r]));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;');let pages=0,pictures=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){if(!['data','scripts','assets'].includes(entry.name))walk(file)}else if(entry.name.endsWith('.html')){let html=fs.readFileSync(file,'utf8'),pre=path.relative(path.dirname(file),root).replaceAll('\\','/')||'.';html=html.replace(/<picture data-optimized-photo="true">[\s\S]*?(<img\b[^>]*>)[\s\S]*?<\/picture>/g,'$1');html=html.replace(/<img\b[^>]*>/g,img=>{const src=img.match(/\bsrc="([^"]+)"/)?.[1]?.replaceAll('&amp;','&'),r=byUrl.get(src);if(!r)return img;pictures++;return `<picture data-optimized-photo="true"><source type="image/webp" srcset="${r.optimized.files.map(f=>`${pre}/${f.path} ${f.width}w`).join(', ')}" sizes="(max-width:650px) 92vw, 640px">${img}</picture>`});
 html=html.replace(/<article class="home-car">[\s\S]*?<\/article>/g,part=>part.replaceAll('92vw, 640px','45vw, 320px'));
 if(html.includes('<img')){html=html.replace(/<script\b[^>]*src="[^"]*static-photo-fallback\.js"[^>]*><\/script>/g,'');html=html.replace('</head>',`<script src="${pre}/assets/static-photo-fallback.js"></script></head>`);}
 const rel=path.relative(root,file).replaceAll('\\','/');if(['cars/index.html','cars/family/index.html'].includes(rel)&&!html.includes('rel="modulepreload"'))html=html.replace('</head>',`<link rel="modulepreload" href="${pre}/assets/vehicle-photos.js"></head>`);
 fs.writeFileSync(file,html);pages++;}}}walk(root);
console.log(`Delivery optimization: ${pictures} responsive pictures across ${pages} HTML pages.`);
