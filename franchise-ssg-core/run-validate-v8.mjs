import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-validate-v7.mjs?v8=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const read=async p=>fs.readFile(path.join(out,p,'index.html'),'utf8');

if(manifest.uiVersion!==8)throw new Error(`Expected uiVersion 8, got ${manifest.uiVersion}`);
for(const key of ['brandDetailKpi','costCompositionBars','g2StyleCompare','rankingSummaryKpi','calculatorResultFirst'])if(!manifest.productEnhancements?.[key])throw new Error(`Missing v8 enhancement: ${key}`);
if(manifest.coverage.v8BrandDetails!==170)throw new Error(`Expected 170 v8 brand details, got ${manifest.coverage.v8BrandDetails}`);
if(manifest.coverage.v8ComparePages!==10)throw new Error(`Expected 10 v8 compare pages, got ${manifest.coverage.v8ComparePages}`);
if(manifest.coverage.v8RankingPages!==20)throw new Error(`Expected 20 v8 ranking pages, got ${manifest.coverage.v8RankingPages}`);

const brand=await read('brands/mega-mgc-coffee');
for(const marker of ['data-v8-brand-detail="1"','class="brand-hero-v8"','class="kpi-grid-v8"','창업비용 구성','중앙값 비교','/assets/v8.css'])if(!brand.includes(marker))throw new Error(`Brand detail missing v8 marker: ${marker}`);
if(brand.includes('브랜드 공개비용과 내가 입력하는'))throw new Error('Brand detail contains removed abstract copy');

const compare=await read('compare/mega-mgc-coffee/compose-coffee');
for(const marker of ['data-v8-compare="1"','class="compare-hero-v8"','class="vs-grid"','공개비용 차이','가맹점 차이','증감률 차이'])if(!compare.includes(marker))throw new Error(`Compare page missing v8 marker: ${marker}`);
if(compare.includes('승자')||compare.includes('우승'))throw new Error('Compare page must not declare a winner');

const ranking=await read('rankings/cafe');
for(const marker of ['data-v8-ranking="1"','class="ranking-head-v8"','공개비용 중앙값','가맹점 중앙값','증감 중앙값','추천 순위 아님'])if(!ranking.includes(marker))throw new Error(`Ranking page missing v8 marker: ${marker}`);

const startup=await read('tools/startup-cost');
for(const marker of ['class="calculator-v8-intro"','data-v8-calculator="1"','1 브랜드 선택','2 점포 비용 입력','3 총액 확인','class="calc-includes-v8"'])if(!startup.includes(marker))throw new Error(`Startup calculator missing v8 marker: ${marker}`);
const profit=await read('tools/monthly-profit-simulator');
for(const marker of ['class="calculator-v8-intro"','data-v8-calculator="1"','1 매출 입력','2 비용 입력','3 손익 확인'])if(!profit.includes(marker))throw new Error(`Profit calculator missing v8 marker: ${marker}`);

const css=await fs.readFile(path.join(out,'assets','v8.css'),'utf8');
for(const marker of ['.brand-hero-v8','.compare-hero-v8','.ranking-head-v8','.calculator[data-v8-calculator="1"]','.brand-summary-grid-v8'])if(!css.includes(marker))throw new Error(`v8 css missing ${marker}`);

const files=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}await walk(out);
let cssCoverage=0;for(const f of files){const h=await fs.readFile(f,'utf8');if(h.includes('/assets/v8.css'))cssCoverage++;}
if(cssCoverage!==files.length)throw new Error(`v8 css coverage mismatch: ${cssCoverage}/${files.length}`);

console.log(JSON.stringify({v8Validation:'PASS',htmlPages:files.length,brandDetails:manifest.coverage.v8BrandDetails,comparePages:manifest.coverage.v8ComparePages,rankingPages:manifest.coverage.v8RankingPages,v8CssCoverage:cssCoverage},null,2));
