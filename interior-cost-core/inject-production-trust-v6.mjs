import fs from 'node:fs';
import path from 'node:path';
const out=path.resolve(process.env.OUT_DIR||'/tmp/interior-v6-production');
const raw=process.env.BASE_URL;if(!raw)throw new Error('BASE_URL is required');
const base=new URL(raw.endsWith('/')?raw:`${raw}/`);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]})}
const links=[['소개','about/'],['연락','contact/'],['개인정보','privacy/'],['이용약관','terms/'],['면책','disclaimer/'],['데이터 기준','data-method/']];
const nav=`<nav class="production-trust-links" aria-label="운영 및 정책">${links.map(([label,p])=>`<a href="${new URL(p,base).href}">${label}</a>`).join('')}</nav>`;
let count=0;
for(const file of walk(out).filter(f=>f.endsWith('.html')&&path.basename(f)!=='404.html')){
 let html=fs.readFileSync(file,'utf8');
 if(!html.includes('production-v6.css'))html=html.replace('</head>',`<link rel="stylesheet" href="${new URL('assets/production-v6.css',base).href}"></head>`);
 if(!html.includes('production-trust-links'))html=html.includes('</footer>')?html.replace('</footer>',`${nav}</footer>`):html.replace('</body>',`${nav}</body>`);
 fs.writeFileSync(file,html);count++;
}
console.log(JSON.stringify({ok:true,injected_pages:count,links:links.map(x=>x[0])},null,2));
