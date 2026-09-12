import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve('docs/interior-cost-preview');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]});
const htmls=walk(ROOT).filter(f=>f.endsWith('.html'));
const rel=f=>path.relative(ROOT,f).split(path.sep).join('/');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const problems=[];
const check=(ok,msg)=>{if(!ok)problems.push(msg)};

check(fs.existsSync(path.join(ROOT,'assets/site-v30-hyper.css')),'missing v30 css');
check(!fs.existsSync(path.join(ROOT,'CNAME')),'CNAME must remain absent');
for(const f of htmls){const h=fs.readFileSync(f,'utf8');check(h.includes('noindex'),'noindex missing '+rel(f));check(h.includes('site-v30-hyper.css'),'v30 css missing '+rel(f));check(h.includes('v30-hyper'),'v30 body class missing '+rel(f));}

const home=read('index.html');
check(home.includes('class="v30-hero"'),'home v30 hero missing');
check(home.includes('인테리어 견적'),'home functional title missing');
check(home.includes('비용 데이터'),'home data title missing');
check(home.includes('337,984'),'home full API count missing');
check(home.includes('공사별 데이터'),'home trade data section missing');
check(home.includes('공식 데이터'),'home official data section missing');
check(!home.includes('받은 인테리어 견적서, 빠진 비용부터 확인하세요'),'old AI-style hero phrase remains');
check(!home.includes('어떤 정보가 필요하세요?'),'old question heading remains');
check(!home.includes('class="v28-home"'),'old v28 home remains');

for(const p of ['interior-cost/index.html','cost/index.html','data/index.html','guides/index.html']){const h=read(p);check(h.includes('v30-eyebrow'),'eyebrow missing '+p);check(!h.includes('v28-hub-card'),'old card-heavy hub remains '+p);}
const cost=read('cost/index.html');
check(cost.includes('/cost/plumbing/'),'plumbing missing from cost hub');
check(cost.includes('공공 참고 레코드'),'cost hub record context missing');
const data=read('data/index.html');
check(data.includes('337,984'),'data full count missing');
check(data.includes('/data/g2b-all/'),'full G2B hub link missing');

for(const p of ['cost/bathroom/index.html','cost/insulation/index.html','cost/electrical/index.html','cost/plumbing/index.html']){const h=read(p);check(h.includes('data-v29-price-reference'),'v29 price reference lost '+p);check(h.includes('v30-eyebrow'),'detail eyebrow missing '+p);}
for(const p of ['quote-check/index.html','quote-compare/index.html','calculator/index.html']){const h=read(p);check(h.includes('v30-eyebrow'),'tool eyebrow missing '+p);}

const joined=htmls.map(f=>fs.readFileSync(f,'utf8')).join('\n');
check(!/adsbygoogle|pagead2\.googlesyndication\.com/.test(joined),'ad code present');
const report={version:'30.0.0',checked_html:htmls.length,full_api_rows:337984,problems,pass:problems.length===0,preview_boundary:{noindex:true,cname:false,ads:false,index_activation:false}};
fs.writeFileSync(path.join(ROOT,'data/v30-hyper-editorial-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(problems.length)process.exit(1);
