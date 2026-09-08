import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v8.mjs?final=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const officialActive=Boolean(manifest.officialMerge?.active);
const compactSource=officialActive?'공정위 공개데이터 · 기준연도와 출처는 페이지에 표시':'프리뷰 수치 · 공식 데이터 연결 전 · noindex';

const files=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}await walk(out);
let brandCleaned=0,compareCleaned=0,rankingCleaned=0;
for(const file of files){let h=await fs.readFile(file,'utf8');let changed=false;
 if(h.includes('data-v8-brand-detail="1"')){
  h=h.replaceAll('<small>공개 스냅샷 연결 대상</small>','<small>프리뷰 수치</small>');
  h=h.replaceAll('정보 없음 · 정식 공정위 스냅샷 연결 후 표시','정보 없음');
  h=h.replace(/<section class="block"><h2>[^<]*업종 중앙값과 비교<\/h2>[\s\S]*?<\/section>/,'');
  h=h.replace(/<section class="block actions">[\s\S]*?<\/section>/,'');
  h=h.replace(/<aside class="source-box">[\s\S]*?<\/aside>/,`<p class="v8-compact-source">${compactSource}</p>`);
  h=h.replace('현재 SSG 프리뷰는 구조 검수용 합성값입니다. 정식 페이지에서는 공식 스냅샷의 기준연도와 수집일을 숫자 바로 옆에 표시합니다.','현재 프리뷰 수치입니다. 정식 공개에서는 기준연도와 확인일을 함께 표시합니다.');
  h=h.replace(/<p class="disclaimer">[\s\S]*?<\/p>/,'<p class="disclaimer">실제 계약 전 최신 정보공개서와 계약조건을 확인하세요.</p>');
  brandCleaned++;changed=true;
 }
 if(h.includes('data-v8-compare="1"')){
  h=h.replaceAll('공식 이력 연결 전 정보 없음','정보 없음');
  h=h.replace(/<section class="block"><h2>내 점포 조건으로 다시 계산<\/h2>[\s\S]*?<\/section>/,'');
  h=h.replace(/<aside class="source-box">[\s\S]*?<\/aside>/,`<p class="v8-compact-source">${compactSource}</p>`);
  h=h.replace(/<p class="disclaimer">[\s\S]*?<\/p>/,'<p class="disclaimer">실제 계약 전 최신 정보공개서와 계약조건을 확인하세요.</p>');
  compareCleaned++;changed=true;
 }
 if(h.includes('data-v8-ranking="1"')){
  h=h.replace(/<aside class="source-box">[\s\S]*?<\/aside>/,`<p class="v8-compact-source">${compactSource}</p>`);
  rankingCleaned++;changed=true;
 }
 if(changed)await fs.writeFile(file,h,'utf8');
}
manifest.productEnhancements={...(manifest.productEnhancements||{}),compactPageCopy:true,duplicateSummaryRemoved:true};
await fs.writeFile(path.join(out,'route-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({v8Final:true,brandCleaned,compareCleaned,rankingCleaned,compactSource},null,2));
