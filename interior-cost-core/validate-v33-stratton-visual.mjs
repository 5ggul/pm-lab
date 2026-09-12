import fs from 'node:fs';import path from 'node:path';
const ROOT=path.resolve('docs/interior-cost-preview');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const f=path.join(d,e.name);return e.isDirectory()?walk(f):[f]});
const html=walk(ROOT).filter(f=>f.endsWith('.html'));const problems=[];
const visitorMedia=p=>{
  if(['quote-check/index.html','quote-compare/index.html','calculator/index.html','compare/quote-lines/index.html','cost/index.html','interior-cost/index.html','data/index.html','data/g2b-all/index.html','data/cost-index/index.html','data/public-unit-cost/index.html','data/wage/index.html','data/sources/index.html','guides/index.html','about/index.html'].includes(p))return true;
  if(/^cost\/(bathroom|kitchen|window|wallpaper|floor|carpentry|insulation|electrical|plumbing|demolition)\/index\.html$/.test(p))return true;
  if(/^interior-cost\/(24|30|32|34|40)-pyeong\/index\.html$/.test(p))return true;
  if(/^interior-cost\/matrix\/.*\/index\.html$/.test(p))return true;
  if(/^guides\/.*\/index\.html$/.test(p))return true;
  return false;
};
for(const f of html){
  const h=fs.readFileSync(f,'utf8');const p=path.relative(ROOT,f).split(path.sep).join('/');
  if(!h.includes('noindex'))problems.push(`${p}: noindex missing`);
  if(!h.includes('site-v33-stratton-visual.css'))problems.push(`${p}: v33 css missing`);
  if(!/<body\b[^>]*class\s*=\s*["'][^"']*\bv33-stratton\b[^"']*["']/i.test(h))problems.push(`${p}: actual body class missing`);
  if(!h.includes('v33-ticker'))problems.push(`${p}: ticker missing`);
  if(visitorMedia(p)&&!h.includes('v33-page-media'))problems.push(`${p}: visitor page media missing`);
  if(/site-v32-stratton|v32-stratton|site-v30-hyper|v30-hyper/.test(h))problems.push(`${p}: discarded design residue`);
}
for(const n of ['renovation','bathroom','kitchen','floor','framing','insulation','electrical','window']){const f=path.join(ROOT,'assets/v33',`${n}.jpg`);if(!fs.existsSync(f)||fs.statSync(f).size<30000)problems.push(`photo missing/small: ${n}`)}
const home=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');for(const s of ['337,984','견적 확인 시작','공사별 비용','욕실','주방','바닥','전기·조명','v33-hero-photo'])if(!home.includes(s))problems.push(`home missing ${s}`);
const bathroom=fs.readFileSync(path.join(ROOT,'cost/bathroom/index.html'),'utf8');for(const s of ['공공 참고단가','P25','P75','가격 레코드','v33-page-media'])if(!bathroom.includes(s))problems.push(`bathroom missing ${s}`);
const result={version:'33.0.2',html:html.length,visitor_media_pages:html.map(f=>path.relative(ROOT,f).split(path.sep).join('/')).filter(visitorMedia).length,problems,pass:problems.length===0};fs.writeFileSync(path.join(ROOT,'data/v33-stratton-visual-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(problems.length)process.exit(1);