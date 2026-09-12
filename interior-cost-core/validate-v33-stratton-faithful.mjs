import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve('docs/interior-cost-preview');
const problems=[];
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]})}
const htmls=walk(ROOT).filter(f=>f.endsWith('.html'));
for(const f of htmls){
 const rel=path.relative(ROOT,f).replaceAll('\\','/');
 const h=fs.readFileSync(f,'utf8');
 if(!h.includes('noindex')) problems.push(`${rel}: noindex missing`);
 if(!h.includes('v33-stratton')) problems.push(`${rel}: body class missing`);
 if(!h.includes('site-v33-stratton-faithful.css')) problems.push(`${rel}: v33 css missing`);
 if(!h.includes('site-v33-stratton-patch.css')) problems.push(`${rel}: patch css missing`);
 if(!h.includes('v33-header-cta')) problems.push(`${rel}: header CTA missing`);
 if(!h.includes('v33-footer-collage')) problems.push(`${rel}: footer collage missing`);
 if(/adsbygoogle|pagead2\.googlesyndication\.com/.test(h)) problems.push(`${rel}: ad code present`);
}
const home=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
for(const token of ['v33-home-hero','v33-mark','v33-ticket','v33-hero-art--left','v33-hero-art--right','v33-process-stage','v33-process-strip']) if(!home.includes(token)) problems.push(`home missing ${token}`);
const steps=(home.match(/class="v33-step"/g)||[]).length;
if(steps!==5) problems.push(`home steps ${steps} != 5`);
for(const rel of ['quote-check/index.html','quote-compare/index.html','calculator/index.html','cost/bathroom/index.html','cost/plumbing/index.html','interior-cost/32-pyeong/index.html','data/index.html','data/g2b-all/index.html','guides/index.html']){
 const p=path.join(ROOT,rel); if(!fs.existsSync(p)){problems.push(`${rel}: missing`);continue}
 const h=fs.readFileSync(p,'utf8');
 if(!h.includes('v33-page-ticket')) problems.push(`${rel}: page ticket missing`);
 if(!h.includes('v33-mark')) problems.push(`${rel}: marked h1 missing`);
}
for(const a of ['site-v33-stratton-faithful.css','site-v33-stratton-patch.css','v33-measure-hand.svg','v33-plan-hand.svg','v33-process-strip.svg','v33-footer-collage.svg']) if(!fs.existsSync(path.join(ROOT,'assets',a))) problems.push(`asset missing ${a}`);
const data=JSON.parse(fs.readFileSync(path.join(ROOT,'data/v33-stratton-faithful.json'),'utf8'));
if(data.data_preserved.price_records!==337984) problems.push('price record count changed');
if(data.data_preserved.api_operations!==11) problems.push('API operation count changed');
if(fs.existsSync(path.join(ROOT,'CNAME'))) problems.push('CNAME present');
const out={version:'33.1',html_count:htmls.length,home_steps:steps,problems,pass:problems.length===0};
fs.writeFileSync(path.join(ROOT,'data/v33-stratton-validation.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if(problems.length) process.exit(1);
