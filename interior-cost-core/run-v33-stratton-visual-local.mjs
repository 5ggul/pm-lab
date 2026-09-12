import fs from 'node:fs';
import path from 'node:path';

const ASSET_DIR=path.resolve('interior-cost-core/v33-assets');
const OUT_ROOT=path.resolve('docs/interior-cost-preview');
const manifest=JSON.parse(fs.readFileSync(path.join(ASSET_DIR,'manifest.json'),'utf8'));
const pageToName={
  'https://unsplash.com/photos/interior-renovation-with-construction-materials-and-supplies-hPfrYoKkxp0':'renovation',
  'https://unsplash.com/photos/modern-bathroom-with-glass-shower-and-toilet-VSD5og2FSW0':'bathroom',
  'https://unsplash.com/photos/modern-kitchen-with-island-and-stainless-steel-appliances-J77Yzq9_Hcg':'kitchen',
  'https://unsplash.com/photos/sunlight-shines-on-a-polished-wooden-floor-inside-PYIHZs8y6Rk':'floor',
  'https://unsplash.com/photos/interior-view-of-a-room-under-construction-with-wooden-framing-Ls6mShbvdpw':'framing',
  'https://unsplash.com/photos/interior-room-under-construction-with-exposed-brick-and-insulation-irnH6JieSgI':'insulation',
  'https://unsplash.com/photos/interior-framing-and-wiring-during-construction-renovation-el9nujeXlvw':'electrical',
  'https://unsplash.com/photos/an-empty-room-with-a-door-and-a-window-p9uDc9WQUTA':'window'
};
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
  const raw=typeof input==='string'?input:input instanceof URL?input.toString():input?.url||String(input);
  const clean=raw.split('?')[0];
  if(pageToName[clean]){
    const name=pageToName[clean];
    return new Response(`<html><head><meta property="og:image" content="https://images.unsplash.com/local-${name}"></head></html>`,{status:200,headers:{'content-type':'text/html'}});
  }
  try{
    const u=new URL(raw);
    if(u.hostname==='images.unsplash.com'&&u.pathname.startsWith('/local-')){
      const name=u.pathname.slice('/local-'.length);
      const file=path.join(ASSET_DIR,`${name}.jpg`);
      if(!fs.existsSync(file))return new Response('missing',{status:404});
      return new Response(fs.readFileSync(file),{status:200,headers:{'content-type':'image/jpeg'}});
    }
  }catch{}
  return nativeFetch(input,init);
};
await import('./enhance-v33-stratton-visual.mjs');
globalThis.fetch=nativeFetch;

const patchCss=fs.readFileSync(path.resolve('interior-cost-core/site-v33-stratton-patch.css'),'utf8');
fs.writeFileSync(path.join(OUT_ROOT,'assets/site-v33-stratton-patch.css'),patchCss);
const patchLink=`<link rel="stylesheet" href="/pm-lab/interior-cost-preview/assets/site-v33-stratton-patch.css?v=33.1">`;
const toolPages=new Set(['quote-check/index.html','quote-compare/index.html','calculator/index.html','compare/quote-lines/index.html']);
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const f=path.join(d,e.name);return e.isDirectory()?walk(f):[f]});
const ensureBodyClass=html=>html.replace(/<body\b([^>]*)>/i,(whole,attrs)=>{
  const match=attrs.match(/\bclass\s*=\s*(["'])(.*?)\1/i);
  if(match){
    const classes=match[2].split(/\s+/).filter(Boolean);
    if(!classes.includes('v33-stratton'))classes.push('v33-stratton');
    return `<body${attrs.replace(match[0],`class=${match[1]}${classes.join(' ')}${match[1]}`)}>`;
  }
  return `<body${attrs} class="v33-stratton">`;
});
for(const file of walk(OUT_ROOT).filter(f=>f.endsWith('.html'))){
  const rel=path.relative(OUT_ROOT,file).split(path.sep).join('/');
  let html=fs.readFileSync(file,'utf8');
  html=ensureBodyClass(html);
  if(!html.includes('site-v33-stratton-patch.css'))html=html.replace('</head>',`${patchLink}</head>`);
  if(toolPages.has(rel))html=html.replace('class="v33-page-media"','class="v33-page-media v33-tool-media"');
  fs.writeFileSync(file,html);
}

const homePath=path.join(OUT_ROOT,'index.html');
let home=fs.readFileSync(homePath,'utf8');
home=home.replace(`<img src="/pm-lab/interior-cost-preview/assets/v33/renovation.jpg"`,`<img class="v33-hero-photo" src="/pm-lab/interior-cost-preview/assets/v33/renovation.jpg" loading="eager" fetchpriority="high"`);
home=home.replace(/(<img\b[^>]*src="\/pm-lab\/interior-cost-preview\/assets\/v33\/[^\"]+"[^>]*)loading="lazy"/g,'$1loading="eager"');
fs.writeFileSync(homePath,home);
const cleanSources=manifest.sources.map(({name,page_url,image_url,bytes,content_type,license})=>({name,page_url,image_url,bytes,content_type,license}));
fs.writeFileSync(path.join(OUT_ROOT,'data/v33-photo-sources.json'),JSON.stringify({version:'33.1.1',sources:cleanSources},null,2));
const statusPath=path.join(OUT_ROOT,'data/v33-stratton-visual.json');
const status=JSON.parse(fs.readFileSync(statusPath,'utf8'));
status.version='33.1.1';
status.photos=cleanSources.map(x=>({name:x.name,page_url:x.page_url,license:x.license}));
status.asset_mode='committed-local';
status.hero_photo_class_fixed=true;
status.body_class_fixed=true;
status.priority_patch=true;
status.compact_tool_media=true;
status.home_visuals_eager=true;
fs.writeFileSync(statusPath,JSON.stringify(status,null,2));
console.log(JSON.stringify({version:'33.1.1',asset_mode:'committed-local',photos:cleanSources.length,priority_patch:true,compact_tool_media:true,home_visuals_eager:true},null,2));