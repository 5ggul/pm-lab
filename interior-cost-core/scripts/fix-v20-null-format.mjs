import fs from 'node:fs';

const files=[
  'interior-cost-core/enhance-v20-g2b.mjs',
  'interior-cost-core/enhance-v20-g2b-costrefs.mjs'
];
const before="const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('ko-KR'):'-';";
const after="const fmt=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Number(n).toLocaleString('ko-KR'):'-';";

for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  const matches=source.split(before).length-1;
  if(matches!==1)throw new Error(`Expected exactly one legacy formatter in ${file}, found ${matches}`);
  const patched=source.replace(before,after);
  if(patched.includes(before))throw new Error(`Legacy formatter remains in ${file}`);
  fs.writeFileSync(file,patched);
  console.log(`patched ${file}`);
}
