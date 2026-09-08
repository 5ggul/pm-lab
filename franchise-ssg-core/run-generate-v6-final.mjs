import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v6.mjs?final=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');

const areaRoot=path.join(out,'areas');
for(const e of await fs.readdir(areaRoot,{withFileTypes:true})){
  if(!e.isDirectory())continue;
  const file=path.join(areaRoot,e.name,'index.html');
  try{
    let h=await fs.readFile(file,'utf8');
    h=h.replaceAll('/guides/trade-area-density/','/guides/store-density-is-not-sales/');
    await fs.writeFile(file,h,'utf8');
  }catch{}
}
const hub=path.join(areaRoot,'index.html');
try{let h=await fs.readFile(hub,'utf8');h=h.replaceAll('/guides/trade-area-density/','/guides/store-density-is-not-sales/');await fs.writeFile(hub,h,'utf8')}catch{}

console.log(JSON.stringify({v6Final:true,densityGuide:'store-density-is-not-sales'},null,2));
