import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export const runtimeAssets=['cost-math.js','detail.js','simple-cost-tools.js','cost-context.js','model-lite.js','base.css'];
// Text assets use canonical LF so Windows checkout conversion cannot change cache IDs.
export const textVersion=text=>createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
export function versionRuntimeAssets({check=false}={}) {
 const versions=Object.fromEntries(runtimeAssets.map(name=>[name,textVersion(fs.readFileSync(path.join(root,'assets',name),'utf8'))]));
 let references=0,changed=0;const failures=[];
 function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,ent.name);
  if(ent.isDirectory()){if(!['assets','data','scripts'].includes(ent.name))walk(file);continue}
  if(!file.endsWith('.html'))continue;
  const before=fs.readFileSync(file,'utf8');
  const after=before.replace(/(src|href)="([^"?]*assets\/(cost-math\.js|detail\.js|simple-cost-tools\.js|cost-context\.js|model-lite\.js|base\.css))(?:\?[^" ]*)?"/g,(old,attr,url,name)=>{references++;const next=`${attr}="${url}?v=${versions[name]}"`;if(old!==next)failures.push(`${path.relative(root,file)}: ${name}`);return next});
  if(before!==after){changed++;if(!check)fs.writeFileSync(file,after)}
 }}
 walk(root);
 if(check&&failures.length)throw new Error('Missing/stale runtime cache versions:\n'+failures.join('\n'));
 return {references,changed};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(versionRuntimeAssets({check:process.argv.includes('--check')}));
