import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const src=path.resolve('interior-cost-core/site-v33-stratton-patch.css');
const dst=path.join(ROOT,'assets/site-v33-stratton-patch.css');
fs.mkdirSync(path.dirname(dst),{recursive:true});
fs.copyFileSync(src,dst);
const link=`<link rel="stylesheet" href="${BASE}/assets/site-v33-stratton-patch.css?v=33.1">`;
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]})}
for(const file of walk(ROOT).filter(f=>f.endsWith('.html'))){
 let html=fs.readFileSync(file,'utf8');
 html=html.replace(/<link rel="stylesheet" href="[^"]*site-v33-stratton-patch\.css[^"]*">/g,'');
 html=html.replace('</head>',`${link}</head>`);
 fs.writeFileSync(file,html);
}
console.log(JSON.stringify({version:'33.1',patch:true},null,2));
