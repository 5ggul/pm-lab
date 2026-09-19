import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
let pages=0;
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){if(!['assets','data','scripts'].includes(entry.name))walk(file);continue;}
  if(!file.endsWith('.html'))continue;
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<!-- MOTION:HERO:START -->[\s\S]*?<!-- MOTION:HERO:END -->/g,'');
  html=html.replace(/<link[^>]*href="[^"]*assets\/motion-ui\.css[^"]*"[^>]*>/g,'');
  html=html.replace(/<script[^>]*src="[^"]*assets\/motion-ui\.js[^"]*"[^>]*><\/script>/g,'');
  html=html.replace(/class="([^"]*)"/g,(_,classes)=>`class="${classes.split(/\s+/).filter(token=>!['motion-reveal','is-visible','motion-ready'].includes(token)).join(' ')}"`);
  fs.writeFileSync(file,html);
  pages++;
 }
}
walk(root);
console.log(`Decorative motion removed from ${pages} pages.`);
