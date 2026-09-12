import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]});
const files=walk(ROOT).filter(f=>f.endsWith('.html'));
const rel=f=>path.relative(ROOT,f).replaceAll('\\','/');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const problems=[];

for(const f of files){
  const h=fs.readFileSync(f,'utf8');
  const r=rel(f);
  if(!/name="robots"[^>]+noindex/.test(h))problems.push(`NO_NOINDEX:${r}`);
  if(!h.includes('site-v32-stratton.css'))problems.push(`NO_V32_CSS:${r}`);
  if(!h.includes('v32-stratton'))problems.push(`NO_V32_BODY:${r}`);
  if(!h.includes('v32-data-tape'))problems.push(`NO_DATA_TAPE:${r}`);
  if(/site-v31-light-service\.css|v31-light|site-v30-hyper\.css|v30-hyper/.test(h))problems.push(`OLD_DESIGN_LEAK:${r}`);
}

if(fs.existsSync(path.join(ROOT,'CNAME')))problems.push('CNAME_PRESENT');
const all=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
if(/adsbygoogle|pagead2\.googlesyndication\.com/.test(all))problems.push('ADS_PRESENT');

const css=fs.readFileSync(path.resolve('interior-cost-core/site-v32-stratton.css'),'utf8');
for(const token of ['--s-paper:#f7f1e8','--s-ink:#0d0d0c','Bricolage Grotesque','IBM Plex Sans','min-height:66px','border-radius:0','box-shadow:none']){
  if(!css.includes(token))problems.push(`CSS_TOKEN_MISSING:${token}`);
}
if(/linear-gradient|radial-gradient|conic-gradient|drop-shadow\(/i.test(css))problems.push('GENERATIVE_GRADIENT_OR_GLOW');
const positiveRadius=[...css.matchAll(/border-radius:\s*([0-9.]+)(px|rem|em)/g)].filter(m=>Number(m[1])>0);
if(positiveRadius.length)problems.push(`POSITIVE_RADIUS:${positiveRadius.slice(0,5).map(m=>m[0]).join(',')}`);
const nonNoneShadow=[...css.matchAll(/box-shadow:\s*([^;!]+)/g)].map(m=>m[1].trim()).filter(v=>v!=='none');
if(nonNoneShadow.length)problems.push(`NON_NONE_SHADOW:${nonNoneShadow.slice(0,5).join(',')}`);

const home=read('index.html');
for(const token of ['v32-home-hero','견적 검사.','견적 비교.','비용 데이터.','견적 도구','평수별 비용','공사별 비용','공식 자료','337,984']){
  if(!home.includes(token))problems.push(`HOME_MISSING:${token}`);
}
if((home.match(/<h1\b/g)||[]).length!==1)problems.push(`HOME_H1_COUNT:${(home.match(/<h1\b/g)||[]).length}`);

const requiredRoutes=[
  'quote-check/index.html','quote-compare/index.html','calculator/index.html','data/index.html','data/g2b-all/index.html',
  'cost/bathroom/index.html','cost/wallpaper/index.html','cost/floor/index.html','cost/carpentry/index.html','cost/insulation/index.html','cost/kitchen/index.html','cost/window/index.html','cost/electrical/index.html','cost/plumbing/index.html','cost/demolition/index.html',
  'interior-cost/24-pyeong/index.html','interior-cost/30-pyeong/index.html','interior-cost/32-pyeong/index.html','interior-cost/34-pyeong/index.html','interior-cost/40-pyeong/index.html',
  'guides/index.html','about/index.html','privacy/index.html'
];
for(const p of requiredRoutes){
  if(!fs.existsSync(path.join(ROOT,p))){problems.push(`ROUTE_MISSING:${p}`);continue;}
  const h=read(p);
  if(!h.includes('v32-stratton')||!h.includes('site-v32-stratton.css'))problems.push(`ROUTE_NOT_STYLED:${p}`);
}

const data=read('data/index.html');
for(const token of ['337,984건','11개','351','전체 가격 데이터'])if(!data.includes(token))problems.push(`DATA_MISSING:${token}`);
const bath=read('cost/bathroom/index.html');
for(const token of ['공공 참고단가','P25','P75','가격 레코드'])if(!bath.includes(token))problems.push(`BATHROOM_DATA_MISSING:${token}`);
const plumbing=read('cost/plumbing/index.html');
if(!plumbing.includes('배관'))problems.push('PLUMBING_MISSING');
const qcheck=read('quote-check/index.html');
if((qcheck.match(/class="qrow/g)||[]).length<12)problems.push('QUOTE_CHECK_ROWS_LT_12');

const report={version:'32.0.0',checked_html:files.length,required_routes:requiredRoutes.length,total_raw_rows:337984,operation_count:11,total_api_pages:351,problems,pass:problems.length===0};
fs.writeFileSync(path.join(ROOT,'data/v32-stratton-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(problems.length)process.exit(1);
