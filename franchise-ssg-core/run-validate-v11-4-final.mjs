import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const errors=[];

const home=await fs.readFile(path.join(out,'index.html'),'utf8');
const brands=await fs.readFile(path.join(out,'brands/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');

for(const text of [
  '<h1>프랜차이즈 창업비용 비교</h1>',
  '브랜드별 창업비용, 가맹점 수, 가맹점 증감, 평균매출을 확인하고 비용을 계산할 수 있습니다.',
  '<h2>브랜드 창업비용</h2>',
  '<h2>업종별 창업비용 중앙값</h2>',
  '<h2>계산기</h2>',
  '<h2>창업비용 자료</h2>',
  '<th class="num">창업비용</th>',
  '<th class="num">가맹점 수</th>',
  '<th class="num">가맹점 증감</th>'
]) if(!home.includes(text))errors.push(`home missing: ${text}`);

for(const banned of ['숫자로 먼저 비교하세요','같은 기준으로 비교하고 내 점포 조건을 계산합니다','대표 브랜드 데이터','바로 쓰는 도구','데이터 리포트'])if(home.includes(banned))errors.push(`home retains abstract/old copy: ${banned}`);

for(const text of [
  '브랜드명, 업종, 창업비용, 가맹점 수, 가맹점 증감으로 검색하고 정렬할 수 있습니다.',
  '최대 창업비용',
  '<th class="num">창업비용</th>',
  '<th class="num">가맹점 수</th>',
  '<th class="num">가맹점 증감</th>'
]) if(!brands.includes(text))errors.push(`directory missing: ${text}`);
for(const banned of ['공식 매칭 146 · 미매칭 23 · 확인 필요 1','최대 공개비용','<th class="num">공개비용</th>'])if(brands.includes(banned))errors.push(`directory retains internal/old copy: ${banned}`);

if(/\.data-table thead th\{position:sticky/.test(css))errors.push('sticky table header rule remains');
if(!css.includes('.data-table thead th{position:static;top:auto;z-index:auto;background:#F1EDE5;background-clip:padding-box}'))errors.push('static table header rule missing');
if(!css.includes('border-collapse:separate;border-spacing:0'))errors.push('separate table border model missing');
if(!css.includes('/* v11.4 table stability */'))errors.push('v11.4 table stability patch missing');

const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
if(!manifest.v11_4?.directHomeCopy||!manifest.v11_4?.directDirectoryCopy)errors.push('v11.4 copy manifest flags missing');
if(manifest.v11_4?.stickyTableHeaders!==false)errors.push('v11.4 stickyTableHeaders must be false');

const report=JSON.parse(await fs.readFile(path.join(out,'v11-4-quality-report.json'),'utf8'));
if(report.uiVersion!=='11.4')errors.push('v11.4 report missing/wrong');
if(report.tablePolicy!=='static header; no sticky overlap')errors.push('v11.4 table policy mismatch');

for(const rel of ['index.html','brands/index.html']){
  const h=await fs.readFile(path.join(out,rel),'utf8');
  if(!h.includes('noindex,nofollow,noarchive,nosnippet'))errors.push(`${rel}: preview noindex missing`);
}

const pkg=JSON.parse(await fs.readFile(path.join(here,'package.json'),'utf8'));
if(!String(pkg.scripts?.build||'').includes('run-generate-v11-4-final.mjs'))errors.push('package build missing v11.4 generator');
if(!String(pkg.scripts?.build||'').includes('run-validate-v11-4-final.mjs'))errors.push('package build missing v11.4 validator');

if(errors.length){console.error(JSON.stringify({v11_4Validation:'FAIL',errors},null,2));process.exit(1)}
console.log(JSON.stringify({v11_4Validation:'PASS',stickyTableHeaders:false,homeCopy:'direct',directoryCopy:'direct'},null,2));
