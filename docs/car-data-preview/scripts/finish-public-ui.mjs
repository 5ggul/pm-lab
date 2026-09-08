import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const studioVersion=createHash('sha256').update(fs.readFileSync(path.join(root,'assets/studio.js'))).digest('hex').slice(0,10);
const catalogVersion=createHash('sha256').update(fs.readFileSync(path.join(root,'assets/catalog-consumer.js'))).digest('hex').slice(0,10);
const familyVersion=createHash('sha256').update(fs.readFileSync(path.join(root,'assets/family-universal.js'))).digest('hex').slice(0,10);
// Retire the old public tool URL while preserving source measurements for vehicle specifications.
fs.writeFileSync(path.join(root,'compare/dimensions/index.html'),`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta http-equiv="refresh" content="0;url=../"><link rel="canonical" href="https://5ggul.github.io/pm-lab/car-data-preview/compare/"><title>차량 비교로 이동 | 내차데이터</title></head><body><main><h1>차량 비교</h1><p><a href="../">차량 비교 페이지로 이동하기</a></p></main></body></html>`);
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,ent.name);
 if(ent.isDirectory()){if(!['assets','data','scripts'].includes(ent.name))walk(file);continue}
 if(!file.endsWith('.html'))continue;
 let html=fs.readFileSync(file,'utf8');
 const copy=[
  ['검수 완료 차량만 표시합니다.','주요 차량의 연비와 제원을 확인하세요.'],
  ['검수 중 차량은 일반 제조사 목록에서 제외합니다.','더 많은 차종은 전체 차량에서 찾을 수 있습니다.'],
  ['기아 공식 제원 페이지를 기준으로 검수합니다.','기아 공식 제원을 기준으로 제공합니다.'],
  ['공식 페이지 연결 상태와 검수 제원을 다시 확인하고','공식 페이지 연결 상태와 제원을 다시 확인하고'],
  ['차종·세대·파워트레인으로 정규화하더라도','차종·세대·엔진별로 분류해도'],
  ['검수 상세에서는','차량 상세에서는'],
  ['연료 유형이 아직 정규화되지 않았더라도','연료 유형이 아직 확인되지 않았더라도'],
  ['내부 검수 snapshot에','저장한 공식 공지에'],
  ['별도 검수가 필요한 항목은 개별 reviewed_on 또는 적용일을 따릅니다.','별도 확인이 필요한 항목은 각 자료의 확인일 또는 적용일을 따릅니다.'],
  ['전체 원문 사양은 항상 보존합니다. 자동 정규화 결과는 탐색용이며, SEO 상세·세금·비교는 검수 수준에 따라 단계적으로 제공합니다.','차종을 검색하고 사양별 연비와 제원을 확인하세요. 자동차세와 연료비 계산은 필요한 수치가 있는 사양에서 제공합니다.']
 ];
 for(const [from,to] of copy)html=html.replaceAll(from,to);
 html=html.replace(/src="([^"?]*assets\/studio\.js)(?:\?[^"]*)?"/g,(_,url)=>`src="${url}?v=${studioVersion}"`);
 html=html.replace(/src="([^"?]*assets\/catalog-consumer\.js)(?:\?[^" ]*)?"/g,(_,url)=>`src="${url}?v=${catalogVersion}"`);
 html=html.replace(/src="([^"?]*assets\/family-universal\.js)(?:\?[^" ]*)?"/g,(_,url)=>`src="${url}?v=${familyVersion}"`);
 html=html.replace(/<a\b[^>]*href="[^"]*compare\/dimensions\/[^"]*"[^>]*>[\s\S]*?<\/a>/g,'');
 // Internal review labels do not help readers compare fuel economy.
 if(file.includes(path.sep+'cars'+path.sep)||file.includes(path.sep+'rankings'+path.sep)){
  html=html.replaceAll('검수 완료 상세','상세제원').replaceAll('검수 완료 계산 상세','주요 차량');
 }
 fs.writeFileSync(file,html);
}}
walk(root);
await import('./build-photo-credits.mjs');
await import('./build-reference-design.mjs');
console.log('Public UI: size comparison retired; catalogue measurements retained.');
