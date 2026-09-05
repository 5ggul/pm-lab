import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pagePath=path.join(root,'cars','family','index.html');
const tag='<script src="../../assets/family-universal.js"></script>';
let html=fs.readFileSync(pagePath,'utf8');
if(!html.includes(tag)){
  if(!html.includes('</body>'))throw new Error('family page missing </body>');
  html=html.replace('</body>',`${tag}\n</body>`);
  fs.writeFileSync(pagePath,html);
  console.log('Patched family page with universal detail renderer');
}else console.log('Family universal detail renderer already present');
