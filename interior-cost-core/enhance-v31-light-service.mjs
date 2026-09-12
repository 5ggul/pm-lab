import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,c)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]});

const css=fs.readFileSync(path.resolve('interior-cost-core/site-v31-light-service.css'),'utf8');
write('assets/site-v31-light-service.css',css);
const cssLink=`<link rel="stylesheet" href="${BASE}/assets/site-v31-light-service.css?v=31">`;

for(const file of walk(ROOT).filter(f=>f.endsWith('.html'))){
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<link rel="stylesheet" href="[^"]*site-v30-hyper\.css[^"]*">/g,'');
  html=html.replace(/\s+v30-hyper(?:\s+v30-home)?/g,'');
  if(!html.includes('site-v31-light-service.css'))html=html.replace('</head>',`${cssLink}</head>`);
  html=html.replace(/<body class="([^"]*)"/,(_,c)=>`<body class="${c.includes('v31-light')?c:`${c} v31-light`.trim()}"`);
  fs.writeFileSync(file,html);
}

// Keep the accepted v28/v29 information architecture. Only remove rejected v30-only visual language if it somehow survived regeneration.
if(fs.existsSync(path.join(ROOT,'index.html'))){
  let html=read('index.html');
  html=html.replace(/<section class="v30-hero">[\s\S]*?<\/section>/g,'');
  html=html.replace(/<section class="v30-home-section">[\s\S]*?<\/section>/g,'');
  html=html.replace(/PRICE RECORDS|PAGES|STANDARD UNIT|RESOURCE|CLASS/g,'');
  write('index.html',html);
}

write('data/v31-light-service.json',JSON.stringify({
  version:'31.0.0',
  base_design:'v28-v29 light service UI',
  rejected_v30_dark_editorial_removed:true,
  dark_canvas:false,
  numbered_editorial_sections:false,
  english_dashboard_labels:false,
  giant_marketing_hero:false,
  service_catalog_preserved:true,
  v29_full_api_data_preserved:true,
  public_reference_distributions_preserved:true,
  preview_noindex_preserved:true,
  production_switch:false,
  search_console_submission:false,
  ads_injected:false
},null,2));
console.log(JSON.stringify({version:'31.0.0',light_service_refine:true,v30_removed:true},null,2));
