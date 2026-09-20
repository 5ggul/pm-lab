import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const pages=[];
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())walk(full);
  else if(entry.name==='index.html')pages.push(full);
 }
}
walk(root);
let checked=0;
const missing=[];
for(const file of pages){
 const route=path.relative(root,path.dirname(file)).replaceAll('\\','/');
 const html=fs.readFileSync(file,'utf8');
 for(const match of html.matchAll(/<a\s[^>]*?href="([^"]+)"/gi)){
  const href=match[1].replaceAll('&amp;','&');
  if(/^(?:https?:|mailto:|tel:|#|javascript:)/i.test(href)||href.includes('${'))continue;
  const url=new URL(href,'https://preview.test/car-data-preview/'+(route==='.'?'':route+'/'));
  if(!url.pathname.startsWith('/car-data-preview/'))continue;
  let target=path.join(root,decodeURIComponent(url.pathname.slice('/car-data-preview/'.length)));
  if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
  checked++;
  if(!fs.existsSync(target))missing.push(`${route}: ${href}`);
 }
}
assert.deepEqual(missing,[],`Broken internal links: ${missing.join(', ')}`);
console.log(`Static links PASS: ${checked} links across ${pages.length} pages`);
