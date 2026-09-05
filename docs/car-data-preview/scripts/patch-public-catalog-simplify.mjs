import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const carsPath=path.join(root,'cars','index.html');
const familyPath=path.join(root,'cars','family','index.html');

let cars=fs.readFileSync(carsPath,'utf8');
cars=cars.replace(/<div class="view-switch"[\s\S]*?<\/div>\s*<div class="allcar-controls">/, '<div class="allcar-controls">');
cars=cars.replace(/const PAGE_SIZE=50,qEl=document\.getElementById\('q'\),makerEl=document\.getElementById\('maker'\),filterEl=document\.getElementById\('filter'\),host=document\.getElementById\('tableHost'\),pager=document\.getElementById\('pager'\),familyBtn=document\.getElementById\('familyView'\),rawBtn=document\.getElementById\('rawView'\);/, "const PAGE_SIZE=50,qEl=document.getElementById('q'),makerEl=document.getElementById('maker'),filterEl=document.getElementById('filter'),host=document.getElementById('tableHost'),pager=document.getElementById('pager');");
cars=cars.replace(/const p=new URLSearchParams\(location\.search\);let view=p\.get\('view'\)==='raw'\?'raw':'family',page=/, "const p=new URLSearchParams(location.search);let view='family',page=");
cars=cars.replace(/familyBtn\.classList\.toggle\('active',view==='family'\);rawBtn\.classList\.toggle\('active',view==='raw'\);/, '');
cars=cars.replace(/if\(view==='raw'\)u\.searchParams\.set\('view','raw'\);else u\.searchParams\.delete\('view'\);/, "u.searchParams.delete('view');");
cars=cars.replace(/familyBtn\.addEventListener\([\s\S]*?rawBtn\.addEventListener\([\s\S]*?\);/, '');
cars=cars.replace(/<select id="filter" aria-label="차량 상태"><\/select>/, '<select id="filter" aria-label="차량 상태" hidden></select>');
cars=cars.replace(/function rawTable\([\s\S]*?function render\(\)/, 'function render()');
cars=cars.replace(/const rows=view==='family'\?familyRows\(\):rawRows\(\)/g,'const rows=familyRows()');
cars=cars.replace(/view==='family'\?'차종':'상세 사양'/g,"'차종'");
cars=cars.replace(/view==='family'\?familyTable\(slice\):rawTable\(slice\)/g,'familyTable(slice)');
cars=cars.replace(/상세 사양 보기/g,'');
cars=cars.replace(/현재 \$\{fmt\(c\.active_group_count\)\}개 상세 사양[\s\S]*?makerEl\.innerHTML=/, 'makerEl.innerHTML=');
cars=cars.replace(/\.view-switch\{[^}]*\}/g,'.view-switch{display:none}');
fs.writeFileSync(carsPath,cars);

let family=fs.readFileSync(familyPath,'utf8');
family=family.replace(/<a href="\.\.\/\?view=raw&q=\$\{encodeURIComponent\(f\.family_name\)\}">[^<]*<\/a>/g,'');
family=family.replace(/<a href="\.\.\/record\/\?id=\$\{encodeURIComponent\(g\.catalog_id\)\}">[^<]*<\/a>/g,'');
family=family.replace(/<a class="raw-model" href="\.\.\/record\/\?id=\$\{encodeURIComponent\(g\.catalog_id\)\}">/g,'<span class="raw-model">').replace(/<\/a><div class="raw-sub">/g,'</span><div class="raw-sub">');
family=family.replace(/<div class="raw-actions">[\s\S]*?<\/div><\/div>/g,'</div>');
fs.writeFileSync(familyPath,family);
console.log('Public catalog simplified to consumer vehicle view');
