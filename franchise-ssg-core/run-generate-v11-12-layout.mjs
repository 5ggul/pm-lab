import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const cssPath=path.resolve(here,'../docs/franchise-ssg-preview/assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
const from='.category-depth{scroll-margin-top:96px}';
const to='.category-depth{width:min(var(--max),calc(100% - 40px));margin:72px auto;scroll-margin-top:96px}';
if(css.includes(from))css=css.replace(from,to);
if(!css.includes(to))throw new Error('v11.12 category depth layout anchor was not found');
await fs.writeFile(cssPath,css,'utf8');
console.log(JSON.stringify({v11_12_layout:'PASS',maxWidthGrid:true},null,2));
