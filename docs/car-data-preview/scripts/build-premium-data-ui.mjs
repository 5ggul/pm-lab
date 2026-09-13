import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const asset='premium-data-ui.css';
const version=createHash('sha256').update(fs.readFileSync(path.join(root,'assets',asset))).digest('hex').slice(0,10);
let pages=0;

function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){
   if(!['assets','data','scripts'].includes(entry.name))walk(file);
   continue;
  }
  if(!file.endsWith('.html'))continue;
  const rel=path.relative(root,file).replaceAll('\\','/');
  const prefix='../'.repeat(rel.split('/').length-1)||'./';
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<link[^>]*href="[^"]*assets\/premium-data-ui\.css[^\"]*"[^>]*>/g,'');
  html=html.replace('</head>',`<link rel="stylesheet" href="${prefix}assets/${asset}?v=${version}"></head>`);
  fs.writeFileSync(file,html);
  pages++;
 }
}

walk(root);
console.log(`Premium data UI: ${pages} pages share ${asset}?v=${version}.`);
