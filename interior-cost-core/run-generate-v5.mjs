import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const src=path.resolve('interior-cost-core/generate-v5.mjs');
const tmp=path.resolve('interior-cost-core/.generate-v5-runtime.mjs');
let code=fs.readFileSync(src,'utf8');
code=code.replace("function meta({title,desc,path:'/',type='website',schema=[]})", "function meta({title,desc,path='/',type='website',schema=[]})");
fs.writeFileSync(tmp,code);
try {
  await import(pathToFileURL(tmp).href+`?t=${Date.now()}`);
} finally {
  fs.rmSync(tmp,{force:true});
}
