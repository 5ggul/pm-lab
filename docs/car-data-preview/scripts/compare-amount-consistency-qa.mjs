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
  const lead=html.match(/<p class="analysis-lead">([^<]+)<\/p>/)?.[1];
  const row=html.match(/<tr data-analysis-km="20000">([\s\S]*?)<\/tr>/)?.[1];
  assert.ok(lead&&row,`${entry.name}: missing analysis amounts`);
  const cells=[...row.matchAll(/<td>([^<]+)<\/td>/g)].map(match=>match[1]);
  const difference=a&&b?amount(a)-amount(b):amount(cells.at(-1));
  const componentDifference=amount(cells[0])+amount(cells[1]);
  assert.equal(amount(cells.at(-1)),difference,`${entry.name}: 20,000 km table differs from displayed totals`);
  assert.equal(componentDifference,difference,`${entry.name}: displayed energy and tax differences do not add up to total difference`);
  assert.ok(difference===0?lead.includes('같습니다'):lead.includes(Math.abs(difference).toLocaleString('ko-KR')+'원'),`${entry.name}: lead differs from displayed totals`);
  const topLead=html.match(/<p class="comparison-lead">([^<]+)<\/p>/)?.[1];
  if(topLead)assert.ok(difference===0?topLead.includes('같습니다'):topLead.includes(Math.abs(difference).toLocaleString('ko-KR')+'원'),`${entry.name}: page intro differs from 20,000 km table`);
  checked++;
}
assert.ok(checked>=20,'too few comparison pages tested');
console.log(`PASS ${checked} static comparisons use displayed-total differences in both lead and 20,000 km table`);
