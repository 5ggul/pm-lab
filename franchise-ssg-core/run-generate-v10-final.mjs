import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v10.mjs?final=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const quality=JSON.parse(await fs.readFile(path.join(out,'v10-quality-report.json'),'utf8'));
const candidates=new Set((quality.indexPolicy?.productionCandidateUrls||[]).map(p=>p.replace(/\/$/,'')||'/'));
const files=[];async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}await walk(out);
function routeFor(file){const rel=path.relative(out,file).replace(/\\/g,'/');if(rel==='index.html')return '/';return '/'+rel.replace(/\/index\.html$/,'')}
let indexCount=0,noindexCount=0;
for(const file of files){let h=await fs.readFile(file,'utf8');const route=(routeFor(file).replace(/\/$/,'')||'/'),indexable=!PREVIEW&&candidates.has(route),value=indexable?'index,follow':'noindex,nofollow,noarchive,nosnippet';h=h.replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${value}">`).replace(/<meta name="googlebot" content="[^"]*">/,`<meta name="googlebot" content="${value}">`).replace(/<meta name="bingbot" content="[^"]*">/,`<meta name="bingbot" content="${value}">`);await fs.writeFile(file,h,'utf8');indexable?indexCount++:noindexCount++}
const manifestPath=path.join(out,'route-manifest.json'),manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));manifest.environmentPolicy={siteEnv:PREVIEW?'preview':'production',centralRobots:true,indexedHtml:indexCount,noindexHtml:noindexCount,productionCandidateCount:candidates.size,productionFailsIfCandidateNoindex:true};await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
if(PREVIEW&&indexCount!==0)throw new Error('Preview must index zero HTML pages');
if(!PREVIEW&&indexCount!==candidates.size)throw new Error(`Production candidate robots mismatch ${indexCount}/${candidates.size}`);
console.log(JSON.stringify({v10EnvironmentPolicy:'PASS',preview:PREVIEW,indexedHtml:indexCount,noindexHtml:noindexCount,candidates:candidates.size},null,2));