import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const files=[];
async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}
await walk(out);
const errors=[];
for(const file of files){
  const h=await fs.readFile(file,'utf8');
  const rel=path.relative(out,file).replace(/\\/g,'/');
  if(/"@type":"FAQPage"/.test(h))errors.push(`${rel}: FAQPage schema remains`);
  if(/"@type":"HowTo"/.test(h))errors.push(`${rel}: HowTo schema remains`);
  if(/"@type":"Dataset"/.test(h))errors.push(`${rel}: Dataset schema remains`);
  if(/"potentialAction"/.test(h)&&/"@type":"SearchAction"/.test(h))errors.push(`${rel}: SearchAction remains`);
  if(/정보공개서 기준/.test(h))errors.push(`${rel}: ambiguous reference-year label remains`);
  if(/전년 점포 변화|전년 증감|전년보다|전년 대비/.test(h))errors.push(`${rel}: prior-basis wording still says prior year`);
  if(/정식 구현에서는|이 프리뷰에서는 계산 구조/.test(h))errors.push(`${rel}: internal preview implementation copy remains`);
  if(PREVIEW&&!/<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/.test(h))errors.push(`${rel}: preview robots is not noindex`);
}
const home=await fs.readFile(path.join(out,'index.html'),'utf8');
if(/공식 원본 레코드|카탈로그 공식 매칭/.test(home))errors.push('home: internal QA counters still visible');
const mega=await fs.readFile(path.join(out,'brands/mega-mgc-coffee/index.html'),'utf8');
if(!/가맹본부 현재 개설 안내/.test(mega))errors.push('mega brand: current operator opening-cost layer missing');
const cafe=await fs.readFile(path.join(out,'categories/cafe/index.html'),'utf8');
if(!/id="distribution"/.test(cafe)||!/category-scatter/.test(cafe))errors.push('cafe category: distribution/scatter block missing');
const report=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
if(report.uiVersion!==11)errors.push('v11 report: wrong uiVersion');
if(!Array.isArray(report.indexPolicy?.productionCandidateUrls)||!report.indexPolicy.productionCandidateUrls.length)errors.push('v11 report: no production candidates');
const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8');
const sitemap=await fs.readFile(path.join(out,'sitemap.xml'),'utf8');
if(PREVIEW){
  if(!/Disallow: \/\s*$/.test(robots))errors.push('preview robots.txt must disallow all');
  if(/<url>/.test(sitemap))errors.push('preview sitemap must remain empty');
}
if(errors.length){console.error(JSON.stringify({v11Validation:'FAIL',errors},null,2));process.exit(1)}
console.log(JSON.stringify({v11Validation:'PASS',html:files.length,productionCandidates:report.indexPolicy.productionCandidateUrls.length,strictBrands:report.strictBrands.filter(x=>x.eligible).length},null,2));
