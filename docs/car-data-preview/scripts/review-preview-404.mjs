// Copy the site's 404 to the Vercel Preview deployment root. The site itself
// lives under /docs/car-data-preview/ there; Vercel looks for 404.html at /.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const target=process.argv[2];
if(!target)throw new Error('Preview deployment directory is required');
const site='/docs/car-data-preview/';
const html=fs.readFileSync(path.join(root,'404.html'),'utf8')
  .replaceAll('href="./','href="'+site)
  .replaceAll('src="./','src="'+site)
  .replaceAll('href="https://5ggul.github.io/pm-lab/car-data-preview/404.html"','href="'+site+'404.html"');
fs.mkdirSync(target,{recursive:true});
fs.writeFileSync(path.join(target,'404.html'),html);
