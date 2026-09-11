import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(here,'../docs/franchise-ssg-preview/tools/startup-cost/index.html');
let html=await fs.readFile(file,'utf8');

if(!html.includes('<article data-v36-replace-boundary="1">')){
  const shellStart=html.indexOf('<div class="shell v25-shell">');
  const crumbsStart=shellStart>=0?html.indexOf('<nav class="crumbs"',shellStart):-1;
  const crumbsEnd=crumbsStart>=0?html.indexOf('</nav>',crumbsStart)+6:-1;
  const mainEnd=crumbsEnd>0?html.indexOf('</main>',crumbsEnd):-1;
  const shellClose=mainEnd>0?html.lastIndexOf('</div>',mainEnd):-1;
  if(shellStart<0||crumbsStart<0||crumbsEnd<=crumbsStart||mainEnd<0||shellClose<=crumbsEnd)throw new Error('v11.36 startup shell boundary missing');
  html=html.slice(0,crumbsEnd)+'<article data-v36-replace-boundary="1">'+html.slice(crumbsEnd,shellClose)+'</article>'+html.slice(shellClose);
  await fs.writeFile(file,html,'utf8');
}

console.log(JSON.stringify({v11_36BoundaryPrep:'PASS',articleBoundary:(html.match(/<article data-v36-replace-boundary="1">/g)||[]).length},null,2));
