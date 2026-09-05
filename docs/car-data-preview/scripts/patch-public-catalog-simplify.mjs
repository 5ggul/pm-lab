import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const carsPath=path.join(root,'cars','index.html');
const familyPath=path.join(root,'cars','family','index.html');

let cars=fs.readFileSync(carsPath,'utf8');
cars=cars.replace(/<div class="view-switch"[^>]*>/, '<div class="view-switch" hidden>');
cars=cars.replace(/const p=new URLSearchParams\(location\.search\);let view=p\.get\('view'\)==='raw'\?'raw':'family',page=/, "const p=new URLSearchParams(location.search);let view='family',page=");
cars=cars.replace(/if\(view==='raw'\)u\.searchParams\.set\('view','raw'\);else u\.searchParams\.delete\('view'\);/, "u.searchParams.delete('view');");
cars=cars.replace(/familyBtn\.addEventListener\('click',[^;]+;\s*\}\);/g,"familyBtn.addEventListener('click',()=>{});");
cars=cars.replace(/rawBtn\.addEventListener\('click',[^;]+;\s*\}\);/g,"rawBtn.addEventListener('click',()=>{});");
cars=cars.replace(/<select id="filter" aria-label="차량 상태"([^>]*)>/, '<select id="filter" aria-label="차량 상태" hidden$1>');
fs.writeFileSync(carsPath,cars);

let family=fs.readFileSync(familyPath,'utf8');
family=family.replace(/<a href="\.\.\/\?view=raw&q=\$\{encodeURIComponent\(f\.family_name\)\}">[^<]*<\/a>/g,'');
fs.writeFileSync(familyPath,family);
console.log('Public catalog locked to consumer vehicle view without removing internal renderer code');
