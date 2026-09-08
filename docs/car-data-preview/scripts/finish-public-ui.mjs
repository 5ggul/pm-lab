import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const studioVersion=createHash('sha256').update(fs.readFileSync(path.join(root,'assets/studio.js'))).digest('hex').slice(0,10);
// Retire the old public tool URL while preserving source measurements for vehicle specifications.
fs.writeFileSync(path.join(root,'compare/dimensions/index.html'),`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta http-equiv="refresh" content="0;url=../"><link rel="canonical" href="https://5ggul.github.io/pm-lab/car-data-preview/compare/"><title>차량 비교로 이동 | 내차데이터</title></head><body><main><h1>차량 비교</h1><p><a href="../">차량 비교 페이지로 이동하기</a></p></main></body></html>`);
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,ent.name);
 if(ent.isDirectory()){if(!['assets','data','scripts'].includes(ent.name))walk(file);continue}
 if(!file.endsWith('.html'))continue;
 let html=fs.readFileSync(file,'utf8');
 html=html.replace(/src="([^"?]*assets\/studio\.js)(?:\?[^"]*)?"/g,(_,url)=>`src="${url}?v=${studioVersion}"`);
 html=html.replace(/<a\b[^>]*href="[^"]*compare\/dimensions\/[^"]*"[^>]*>[\s\S]*?<\/a>/g,'');
 // Internal review labels do not help readers compare fuel economy.
 if(file.includes(path.sep+'cars'+path.sep)||file.includes(path.sep+'rankings'+path.sep)){
  html=html.replaceAll('검수 완료 상세','상세제원').replaceAll('검수 완료 계산 상세','주요 차량');
 }
 fs.writeFileSync(file,html);
}}
walk(root);
console.log('Public UI: size comparison retired; catalogue measurements retained.');
