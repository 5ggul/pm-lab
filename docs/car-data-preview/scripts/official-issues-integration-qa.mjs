import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const scripts=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(scripts,'..');
const index=path.join(root,'data/generated/official-issues-index.json');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function pages(dir=root,result={}) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) {if(!['assets','data','scripts'].includes(entry.name))pages(file,result);continue;}
    if(entry.name.endsWith('.html'))result[path.relative(root,file)]=hash(file);
  }
  return result;
}
const originalIndex=hash(index);
const generate=()=>{
  for(const script of ['build-official-issues.mjs','version-runtime-assets.mjs'])execFileSync(process.execPath,[path.join(scripts,script)],{stdio:'pipe'});
};
generate();const first=pages();generate();const second=pages();
assert.deepEqual(second,first,'Offline regeneration must keep all HTML, runtime fingerprints and official links stable');
assert.equal(hash(index),originalIndex,'Offline UI generation must not alter official source aggregates or check timestamps');
let modules=0;
for(const file of Object.keys(second)) {
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const count=(html.match(/id="vehicle-issues"/g)||[]).length;
  assert.ok(count<=1,`${file}: duplicated official information`);modules+=count;
  const primaryNavs=html.match(/<nav\b[^>]*class=["'][^"']*\bdb-nav\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi)||[];
  assert.ok(primaryNavs.every(nav=>!/>리콜<\/a>/.test(nav)),`${file}: old global navigation label`);
}
assert.ok(modules>=73,'All reviewed detail, family and comparison consumers must remain linked');
assert.ok(!fs.existsSync(path.join(root,'data/official-issues/raw')),'Original official CSV rows must stay outside the public source tree');
console.log(JSON.stringify({ok:true,htmlPages:Object.keys(second).length,linkedPages:modules,regenerationPasses:2,aggregateUnchanged:true}));
