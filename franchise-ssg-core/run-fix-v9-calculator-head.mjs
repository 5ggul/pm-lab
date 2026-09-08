import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const targets=['tools/startup-cost','tools/monthly-profit-simulator'];

for(const rel of targets){
  const file=path.join(out,rel,'index.html');
  let h=await fs.readFile(file,'utf8');
  if(!h.includes('calc-form-panel-head')){
    h=h.replace(
      /<div class="calculator-v8-intro"><div><h1>([\s\S]*?)<\/h1><p>([\s\S]*?)<\/p><\/div><div class="calc-steps-v8">([\s\S]*?)<\/div><\/div>/,
      (_,title,desc,steps)=>`<div class="calc-form-panel-head"><div class="eyebrow">CALCULATOR</div><h1>${title}</h1><p>${desc}</p><div class="profile-tabs">${steps.replaceAll('<span>','<a>').replaceAll('</span>','</a>')}</div></div>`
    );
  }
  if(!h.includes('calc-form-panel-head'))throw new Error(`Failed to create v9 calculator header: ${rel}`);
  if(h.includes('calculator-v8-intro')||h.includes('calc-steps-v8'))throw new Error(`Legacy calculator intro remains: ${rel}`);
  await fs.writeFile(file,h,'utf8');
}

console.log(JSON.stringify({v9CalculatorHeadFix:'PASS',pages:targets},null,2));
