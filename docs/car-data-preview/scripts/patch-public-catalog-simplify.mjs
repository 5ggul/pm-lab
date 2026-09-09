import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const carsPath=path.join(root,'cars','index.html');
const familyPath=path.join(root,'cars','family','index.html');

let cars=fs.readFileSync(carsPath,'utf8');
// The hidden legacy table has a different page size. Only the consumer catalog
// may write URL state, including before its external script finishes loading.
cars=cars.replace('<html lang="ko">','<html lang="ko" data-consumer-catalog-owner="true">');
const urlGuard='if(document.documentElement.dataset.consumerCatalogOwner==="true")return;';
if(!cars.includes(urlGuard))cars=cars.replace('function updateUrl(){',`function updateUrl(){${urlGuard}`);
cars=cars.replace(/<div class="view-switch"[^>]*>/, '<div class="view-switch" hidden>');
cars=cars.replace(/const p=new URLSearchParams\(location\.search\);let view=p\.get\('view'\)==='raw'\?'raw':'family',page=/, "const p=new URLSearchParams(location.search);let view='family',page=");
cars=cars.replace(/if\(view==='raw'\)u\.searchParams\.set\('view','raw'\);else u\.searchParams\.delete\('view'\);/, "u.searchParams.delete('view');");
cars=cars.replace(/familyBtn\.addEventListener\('click',[^;]+;\s*\}\);/g,"familyBtn.addEventListener('click',()=>{});");
cars=cars.replace(/rawBtn\.addEventListener\('click',[^;]+;\s*\}\);/g,"rawBtn.addEventListener('click',()=>{});");
cars=cars.replace(/<select id="filter" aria-label="차량 상태"([^>]*)>/, '<select id="filter" aria-label="차량 상태" hidden$1>');
cars=cars.replace(/<title>[^<]*<\/title>/,'<title>차량 찾기 | 내차데이터</title>');
cars=cars.replace(/<meta name="description" content="[^"]*">/,'<meta name="description" content="제조사, 차량명, 연료 종류로 자동차를 찾고 연비·전비, 주요 제원, 자동차세·에너지비 계산과 차량 비교로 바로 이동할 수 있습니다.">');
if(!cars.includes('assets/catalog-consumer.js'))cars=cars.replace('</body>','<script src="../assets/catalog-consumer.js"></script>\n</body>');
fs.writeFileSync(carsPath,cars);

let family=fs.readFileSync(familyPath,'utf8');
family=family.replace(/<a href="\.\.\/\?view=raw&q=\$\{encodeURIComponent\(f\.family_name\)\}">[^<]*<\/a>/g,'');
fs.writeFileSync(familyPath,family);
console.log('Public catalog locked to consumer vehicle view with card catalog renderer');
