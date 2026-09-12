import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]});
const htmlFiles=walk(ROOT).filter(f=>f.endsWith('.html'));
const readRel=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const problems=[];

for(const f of htmlFiles){
  const h=fs.readFileSync(f,'utf8');
  if(!h.includes('noindex'))problems.push(`NO_NOINDEX:${path.relative(ROOT,f)}`);
  if(!h.includes('site-v31-light-service.css'))problems.push(`NO_V31_CSS:${path.relative(ROOT,f)}`);
  if(h.includes('site-v30-hyper.css')||h.includes('v30-hyper'))problems.push(`V30_LEAK:${path.relative(ROOT,f)}`);
}
if(fs.existsSync(path.join(ROOT,'CNAME')))problems.push('CNAME_PRESENT');
const allText=htmlFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
if(/adsbygoogle|pagead2\.googlesyndication\.com/.test(allText))problems.push('ADS_PRESENT');

const home=readRel('index.html');
for(const token of ['견적 도구','평수별 비용','공사별 비용','공식 자료'])if(!home.includes(token))problems.push(`HOME_MISSING:${token}`);
for(const token of ['받은 인테리어 견적서, 빠진 비용부터 확인하세요','PRICE RECORDS','v30-hero','v30-home-section'])if(home.includes(token))problems.push(`REJECTED_HOME_COPY:${token}`);
if(!home.includes('v28-service-grid'))problems.push('HOME_SERVICE_GRID_MISSING');

const data=readRel('data/index.html');
for(const token of ['337,984건','11개','351','전체 가격 데이터'])if(!data.includes(token))problems.push(`DATA_MISSING:${token}`);

const bathroom=readRel('cost/bathroom/index.html');
for(const token of ['공공 참고단가','P25','P75','가격 레코드'])if(!bathroom.includes(token))problems.push(`BATHROOM_REF_MISSING:${token}`);

const plumbing=readRel('cost/plumbing/index.html');
if(!plumbing.includes('배관'))problems.push('PLUMBING_MISSING');

const css=fs.readFileSync(path.resolve('interior-cost-core/site-v31-light-service.css'),'utf8');
if(/#080808|linear-gradient|radial-gradient/.test(css))problems.push('V31_AI_STUDIO_STYLE');
if(/font-size:\s*(?:[5-9]\d|\d{3,})px/.test(css))problems.push('V31_OVERSIZED_TYPE');

const report={version:'31.0.0',checked_html:htmlFiles.length,operation_count:11,total_raw_rows:337984,total_api_pages:351,problems,pass:problems.length===0};
fs.writeFileSync(path.join(ROOT,'data/v31-light-service-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(problems.length)process.exit(1);
