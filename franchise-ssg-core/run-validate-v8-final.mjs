import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-validate-v8.mjs?final=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const read=async p=>fs.readFile(path.join(out,p,'index.html'),'utf8');
for(const key of ['compactPageCopy','duplicateSummaryRemoved'])if(!manifest.productEnhancements?.[key])throw new Error(`Missing v8 final enhancement: ${key}`);

const brand=await read('brands/mega-mgc-coffee');
for(const banned of ['공개 스냅샷 연결 대상','정식 공정위 스냅샷 연결 후 표시','업종 중앙값과 비교</h2>','class="block actions"'])if(brand.includes(banned))throw new Error(`Brand detail still contains duplicate/technical copy: ${banned}`);
if(!brand.includes('프리뷰 수치 · 공식 데이터 연결 전 · noindex')&&!brand.includes('공정위 공개데이터 · 기준연도와 출처는 페이지에 표시'))throw new Error('Brand detail compact source missing');

const compare=await read('compare/mega-mgc-coffee/compose-coffee');
for(const banned of ['공식 이력 연결 전 정보 없음','내 점포 조건으로 다시 계산</h2>'])if(compare.includes(banned))throw new Error(`Compare page still contains duplicate/technical copy: ${banned}`);
if(!compare.includes('실제 계약 전 최신 정보공개서와 계약조건을 확인하세요.'))throw new Error('Compare compact disclaimer missing');

const ranking=await read('rankings/cafe');
if(ranking.includes('<aside class="source-box">'))throw new Error('Ranking long source box still present');

console.log(JSON.stringify({v8FinalValidation:'PASS',compactPageCopy:true,duplicateSummaryRemoved:true},null,2));
