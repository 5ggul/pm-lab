import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve('docs/car-data-preview/compare');
const amount=text=>Number(text.replace(/[^\d-]/g,''));
let checked=0;
for(const entry of fs.readdirSync(root,{withFileTypes:true})){
  if(!entry.isDirectory())continue;
  const file=path.join(root,entry.name,'index.html');
  if(!fs.existsSync(file))continue;
  const html=fs.readFileSync(file,'utf8');
  if(!html.includes('data-analysis-pair'))continue;
  const a=html.match(/id="decision-a">([^<]+)</)?.[1];
  const b=html.match(/id="decision-b">([^<]+)</)?.[1];
  const lead=html.match(/<p class="comparison-lead"[^>]*>([^<]+)<\/p>/)?.[1];
  const row=html.match(/<tr><th>20,000km<\/th>([\s\S]*?)<\/tr>/)?.[1];
  assert.ok(lead&&row,`${entry.name}: missing comparison amounts`);
  const cells=[...row.matchAll(/<td>([^<]+)<\/td>/g)].map(match=>match[1]);
  const difference=a&&b?amount(a)-amount(b):amount(cells.at(-1));
  assert.equal(amount(cells[0])-amount(cells[1]),difference,`${entry.name}: 20,000 km totals do not add up to displayed difference`);
  assert.equal(amount(cells.at(-1)),difference,`${entry.name}: 20,000 km table differs from displayed totals`);
  assert.ok(difference===0?/같(?:습니다|음)/.test(lead):lead.includes(Math.abs(difference).toLocaleString('ko-KR')+'원'),`${entry.name}: lead differs from displayed totals`);
  checked++;
}
assert.ok(checked>=20,'too few comparison pages tested');
console.log(`PASS ${checked} static comparisons use displayed-total differences in the verdict and 20,000 km table`);
