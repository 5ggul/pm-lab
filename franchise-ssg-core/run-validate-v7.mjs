import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-validate-v6.mjs?v7=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const read=async p=>fs.readFile(path.join(out,p,'index.html'),'utf8');
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));

if(manifest.uiVersion!==7)throw new Error(`Expected uiVersion 7, got ${manifest.uiVersion}`);
for(const key of ['dataFirstUi','clearPagePurposeCopy','brandListTableDesktop','referenceInspiredIA'])if(!manifest.productEnhancements?.[key])throw new Error(`Missing v7 enhancement: ${key}`);

const home=await read('');
for(const marker of ['프랜차이즈 브랜드 170개 데이터 비교','브랜드별 공개 창업비용, 가맹점 수, 전년 증감','조건으로 브랜드 찾기','두 브랜드 비교','총 창업비용 계산','월 손익 계산','class="stat-strip"','class="home-table"','/assets/v7.css'])if(!home.includes(marker))throw new Error(`Home missing v7 marker: ${marker}`);
for(const banned of ['브랜드 공개비용과 내가 입력하는','섞지 않고 봅니다','정적 HTML로 출력합니다'])if(home.includes(banned))throw new Error(`Home still contains abstract/implementation copy: ${banned}`);

const brands=await read('brands');
for(const marker of ['프랜차이즈 브랜드 170개 찾기','브랜드명·업종으로 검색하고 공개 창업비용','id="brandGrid"','/assets/v7.css'])if(!brands.includes(marker))throw new Error(`Brands index missing v7 marker: ${marker}`);
if(brands.includes('현재 프리뷰 카탈로그 170개 브랜드를 정적 HTML로 출력합니다'))throw new Error('Brands page still exposes implementation copy');

const explore=await read('explore');
for(const marker of ['<h1>프랜차이즈 찾기</h1>','업종·비용·가맹점 수·지역 조건으로 브랜드를 찾고'])if(!explore.includes(marker))throw new Error(`Explore page missing clear-purpose copy: ${marker}`);

const categories=await read('categories');if(!categories.includes('<h1>업종별 프랜차이즈 브랜드</h1>'))throw new Error('Category hub H1 not simplified');
const themes=await read('themes');if(!themes.includes('<h1>비용·점포 조건별 브랜드</h1>'))throw new Error('Theme hub H1 not simplified');

const css=await fs.readFile(path.join(out,'assets','v7.css'),'utf8');
for(const marker of ['.home-hero','.stat-strip','#brandGrid.brand-grid','.home-table','.quick-grid'])if(!css.includes(marker))throw new Error(`v7 css missing ${marker}`);

const files=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}await walk(out);
let cssCoverage=0,navCoverage=0;for(const f of files){const h=await fs.readFile(f,'utf8');if(h.includes('/assets/v7.css'))cssCoverage++;if(h.includes('>브랜드 찾기</a>')&&h.includes('>업종</a>')&&h.includes('>지역</a>'))navCoverage++;}
if(cssCoverage!==files.length)throw new Error(`v7 css coverage mismatch: ${cssCoverage}/${files.length}`);
if(navCoverage!==files.length)throw new Error(`v7 nav coverage mismatch: ${navCoverage}/${files.length}`);

console.log(JSON.stringify({v7Validation:'PASS',htmlPages:files.length,v7CssCoverage:cssCoverage,clearNavCoverage:navCoverage,homePurposeCopy:true,brandListTableDesktop:true},null,2));
