import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const sourcePath=path.join(here,'generate-v2.mjs');
const runtimePath=path.join(here,'.generate-v2-runtime.mjs');
let source=await fs.readFile(sourcePath,'utf8');
const before="const from=path.join(out,'compare',a.originalSlug,b.originalSlug),to=path.join(out,'compare',a.slug,b.slug);if(await exists(from)){";
const after="const from=path.join(out,'compare',a.originalSlug,b.originalSlug),to=path.join(out,'compare',a.slug,b.slug);if(from===to)continue;if(await exists(from)){";
if(!source.includes(before))throw new Error('Expected compare rename block not found in generate-v2.mjs');
source=source.replace(before,after);
await fs.writeFile(runtimePath,source,'utf8');
try{await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`);}finally{await fs.rm(runtimePath,{force:true});}
