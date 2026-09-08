import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v10.mjs?final=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const quality=JSON.parse(await fs.readFile(path.join(out,'v10-quality-report.json'),'utf8'));
const candidates=new Set((quality.indexPolicy?.productionCandidateUrls||[]).map(p=>p.replace(/\/$/,'')||'/'));

// Small first-party favicon so browsers never fall back to a missing /favicon.ico.
const favicon=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#1C1916"/><rect x="13" y="35" width="9" height="16" fill="#FFFcf7"/><rect x="28" y="25" width="9" height="26" fill="#FFFcf7"/><rect x="43" y="13" width="9" height="38" fill="#2457D6"/></svg>`;
await fs.mkdir(path.join(out,'assets'),{recursive:true});
await fs.writeFile(path.join(out,'assets','favicon.svg'),favicon,'utf8');

const files=[];async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}await walk(out);
function routeFor(file){const rel=path.relative(out,file).replace(/\\/g,'/');if(rel==='index.html')return '/';return '/'+rel.replace(/\/index\.html$/,'')}
let indexCount=0,noindexCount=0;
for(const file of files){
  let h=await fs.readFile(file,'utf8');
  // The API exposes a reference year. Do not silently relabel it as a distinct performance year.
  h=h.replace(/<small>(\d{4}) 실적<\/small>/g,'<small>공개 기준 $1</small>');
  if(!/<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(h))h=h.replace('</head>',`<link rel="icon" href="${BASE}/assets/favicon.svg" type="image/svg+xml"></head>`);
  const route=(routeFor(file).replace(/\/$/,'')||'/'),indexable=!PREVIEW&&candidates.has(route),value=indexable?'index,follow':'noindex,nofollow,noarchive,nosnippet';
  h=h.replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${value}">`).replace(/<meta name="googlebot" content="[^"]*">/,`<meta name="googlebot" content="${value}">`).replace(/<meta name="bingbot" content="[^"]*">/,`<meta name="bingbot" content="${value}">`);
  await fs.writeFile(file,h,'utf8');indexable?indexCount++:noindexCount++;
}
const manifestPath=path.join(out,'route-manifest.json'),manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));manifest.environmentPolicy={siteEnv:PREVIEW?'preview':'production',centralRobots:true,indexedHtml:indexCount,noindexHtml:noindexCount,productionCandidateCount:candidates.size,productionFailsIfCandidateNoindex:true};await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
if(PREVIEW&&indexCount!==0)throw new Error('Preview must index zero HTML pages');
if(!PREVIEW&&indexCount!==candidates.size)throw new Error(`Production candidate robots mismatch ${indexCount}/${candidates.size}`);
console.log(JSON.stringify({v10EnvironmentPolicy:'PASS',preview:PREVIEW,indexedHtml:indexCount,noindexHtml:noindexCount,candidates:candidates.size,favicon:true},null,2));