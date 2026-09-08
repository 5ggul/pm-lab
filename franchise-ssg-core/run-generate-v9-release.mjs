import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v9-final.mjs?release=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');

const patches=[
  {
    rel:'tools/startup-cost',
    title:'프랜차이즈 창업비용 계산기',
    desc:'브랜드 공개비용에 임대보증금·권리금·추가공사·운전자금을 더해 총 초기 필요자금을 계산합니다.',
    steps:['브랜드 선택','점포 비용 입력','결과 확인']
  },
  {
    rel:'tools/monthly-profit-simulator',
    title:'월 손익 계산기',
    desc:'월매출과 원가·인건비·임대료를 입력해 단순 영업잔액과 손익분기 매출을 계산합니다.',
    steps:['매출 입력','비용 입력','결과 확인']
  }
];

for(const p of patches){
  const file=path.join(out,p.rel,'index.html');
  let h=await fs.readFile(file,'utf8');
  const head=`<div class="calc-form-panel-head"><div class="eyebrow">CALCULATOR</div><h1>${p.title}</h1><p>${p.desc}</p><div class="profile-tabs">${p.steps.map(x=>`<a>${x}</a>`).join('')}</div></div>`;
  if(h.includes('calculator-v8-intro')){
    h=h.replace(/<div class="calculator-v8-intro">[\s\S]*?<div class="calc-steps-v8">[\s\S]*?<\/div><\/div>/,head);
  }
  if(!h.includes('calc-form-panel-head')){
    h=h.replace(/<article>/,`<article>${head}`);
  }
  h=h.replace(/class="calculator v9-calculator" data-v9-calc="1" data-v8-calculator="1"/g,'class="calculator v9-calculator" data-v9-calc="1"');
  h=h.replace(/class="calculator" data-v8-calculator="1"/g,'class="calculator v9-calculator" data-v9-calc="1"');
  if(!h.includes('data-v9-calculator-page="1"'))h=h.replace('<div class="shell page">','<div class="shell page" data-v9-calculator-page="1">');
  await fs.writeFile(file,h,'utf8');
}

console.log(JSON.stringify({v9Release:true,calculatorHeadersPatched:patches.length},null,2));