import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pagePath=path.join(root,'cars','family','index.html');
const tag='<script src="../../assets/family-universal.js"></script>';
let html=fs.readFileSync(pagePath,'utf8');
html=html.replace(
  "const app=document.getElementById('app'),id=new URLSearchParams(location.search).get('id'),esc=",
  "const app=document.getElementById('app'),requestedId=new URLSearchParams(location.search).get('id');let id=requestedId;const esc="
);
html=html.replace("if(!id){app.innerHTML=","if(!requestedId){app.innerHTML=");
html=html.replace(
  /(?:id=h\.family_aliases\?\.\[requestedId\]\|\|requestedId;window\.__carFamilyId=id;)+const f=h\.families\.find\(x=>x\.family_id===id\);if\(!f\)\{/,
  "id=h.family_aliases?.[requestedId]||requestedId;window.__carFamilyId=id;const f=h.families.find(x=>x.family_id===id);if(!f){"
);
if(!/<script\b[^>]*src="[^"?]*\/family-universal\.js(?:\?[^"]*)?"/.test(html)){
  if(!html.includes('</body>'))throw new Error('family page missing </body>');
  html=html.replace('</body>',`${tag}\n</body>`);
  console.log('Patched family page with universal detail renderer');
}else console.log('Family universal detail renderer already present');
fs.writeFileSync(pagePath,html);
