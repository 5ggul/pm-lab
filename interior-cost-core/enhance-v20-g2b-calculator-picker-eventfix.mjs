import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const file=path.join(ROOT,'calculator','index.html');
let html=fs.readFileSync(file,'utf8');
if(!html.includes('data-v20-calc-public-manual-selection="true"')||!html.includes('data-v20-calc-public-picker'))throw new Error('picker event fix requires v20.4 calculator picker');

const selectNeedle="<select data-v20-calc-public-picker data-v20-calc-public-picker-row=\"";
const selectFixed="<select onchange=\"window.__v20CalcPublicPick&&window.__v20CalcPublicPick(this)\" data-v20-calc-public-picker data-v20-calc-public-picker-row=\"";
if(!html.includes(selectFixed)){
  if(!html.includes(selectNeedle))throw new Error('picker select template not found');
  html=html.replace(selectNeedle,selectFixed);
}

const listenerNeedle="builder.addEventListener('input',render);builder.addEventListener('change',render);root.addEventListener('change',e=>";
const handler="window.__v20CalcPublicPick=el=>{const rowKey=el.getAttribute('data-v20-calc-public-picker-row')||'',kind=el.getAttribute('data-v20-calc-public-picker-kind')||'';if(!rowKey||!kind)return;choice[rowKey+'|'+kind]=el.value;render()};builder.addEventListener('input',render);builder.addEventListener('change',render);root.addEventListener('change',e=>";
if(!html.includes('window.__v20CalcPublicPick=el=>')){
  if(!html.includes(listenerNeedle))throw new Error('picker listener insertion point not found');
  html=html.replace(listenerNeedle,handler);
}

if(!html.includes('onchange="window.__v20CalcPublicPick&&window.__v20CalcPublicPick(this)"')||!html.includes("choice[rowKey+'|'+kind]=el.value"))throw new Error('picker event fix injection failed');
fs.writeFileSync(file,html);
console.log('v20 calculator picker event ordering fixed');
