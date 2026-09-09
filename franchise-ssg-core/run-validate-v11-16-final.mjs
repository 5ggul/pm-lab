import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-16-tool-hub.json'),'utf8'));
const report15=JSON.parse(await fs.readFile(path.join(out,'v11-15-tool-trust.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const hub=await fs.readFile(path.join(out,'tools/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const approved=report.hubRoutes||[];
const blocked=report.blockedRoutes||[];

if(report.uiVersion!=='11.16')errors.push(`report uiVersion ${report.uiVersion}`);
if(manifest.uiVersion!=='11.16')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_16?.toolHubPolicy!==true)errors.push('toolHubPolicy flag missing');
if(report.approvedToolCount!==8||approved.length!==8)errors.push(`approved tool count mismatch ${report.approvedToolCount}/${approved.length}`);
if(report.productionCandidateCount!==report15.productionCandidateCount)errors.push(`production candidate count changed ${report.productionCandidateCount}/${report15.productionCandidateCount}`);
if(quality.contentTrust?.version!=='11.16'||quality.contentTrust?.toolHubPolicy!==true)errors.push('quality contentTrust v11.16 missing');
if(!hub.includes('data-v11-16-tool-hub="1"'))errors.push('tool hub marker missing');
if(!hub.includes('data-v11-16-tool-list'))errors.push('tool hub ItemList JSON-LD marker missing');
if(hub.includes('/tools/store-density/'))errors.push('blocked store-density linked from tool hub');
if(hub.includes('점포 밀도'))errors.push('stale store-density copy remains on tool hub');
if(!hub.includes('공식값과 입력값을 섞지 않습니다'))errors.push('value-basis section missing');
for(const phrase of ['공식 매칭 공개값','사용자 입력','파생 통계'])if(!hub.includes(phrase))errors.push(`value basis label missing: ${phrase}`);
const rowCount=(hub.match(/data-v11-16-tool-row=/g)||[]).length;
if(rowCount!==8)errors.push(`tool directory row count ${rowCount}`);
const h2Count=(hub.match(/<h2\b/g)||[]).length;
if(h2Count<6)errors.push(`tool hub H2 depth too low: ${h2Count}`);
for(const route of approved){const href=`/pm-lab/franchise-ssg-preview${route}`;if(!hub.includes(`href="${href}"`))errors.push(`approved tool missing from hub: ${route}`)}

const jsonRaw=hub.match(/<script type="application\/ld\+json" data-v11-16-tool-list>([\s\S]*?)<\/script>/)?.[1];
if(!jsonRaw)errors.push('ItemList payload missing');else{try{const data=JSON.parse(jsonRaw);if(data['@type']!=='ItemList')errors.push(`tool hub schema type ${data['@type']}`);if(data.numberOfItems!==8)errors.push(`ItemList numberOfItems ${data.numberOfItems}`);if(!Array.isArray(data.itemListElement)||data.itemListElement.length!==8)errors.push('ItemList element count invalid');const urls=new Set((data.itemListElement||[]).map(x=>x.url));if(urls.size!==8)errors.push('ItemList tool URLs are not unique')}catch(err){errors.push(`ItemList JSON parse failed: ${err.message}`)}}

const candidateSet=new Set(quality.indexPolicy?.productionCandidateUrls||[]);
for(const route of approved)if(!candidateSet.has(route))errors.push(`hub tool is not a production candidate: ${route}`);
for(const route of blocked)if(candidateSet.has(route))errors.push(`blocked route entered production candidates: ${route}`);

if(!Array.isArray(report.relatedPatched)||report.relatedPatched.length!==8)errors.push(`related page coverage ${report.relatedPatched?.length||0}`);
for(const row of report.relatedPatched||[]){
  const file=path.join(out,...row.route.split('/').filter(Boolean),'index.html');
  const html=await fs.readFile(file,'utf8');
  if(!html.includes('data-v11-16-related-tools="1"'))errors.push(`related marker missing: ${row.route}`);
  const section=html.match(/<section class="block tool-related" data-v11-16-related-tools="1">[\s\S]*?<\/section>/)?.[0]||'';
  const siblingLinks=(section.match(/href="\/pm-lab\/franchise-ssg-preview\/tools\/[^"]+\/"/g)||[]).length;
  if(siblingLinks<2)errors.push(`too few contextual related links: ${row.route} (${siblingLinks})`);
  if(section.includes('/tools/store-density/'))errors.push(`blocked tool linked contextually: ${row.route}`);
  if(section.includes(`href="/pm-lab/franchise-ssg-preview${row.route}"`))errors.push(`tool links to itself: ${row.route}`);
  if(!html.includes('noindex,nofollow,noarchive,nosnippet'))errors.push(`preview noindex lost: ${row.route}`);
}
if(!hub.includes('noindex,nofollow,noarchive,nosnippet'))errors.push('tool hub preview noindex lost');
if(!css.includes('/* v11.16 tool directory */'))errors.push('v11.16 tool directory CSS missing');

if(errors.length){console.error(JSON.stringify({v11_16Validation:'FAIL',errors,summary:{approvedTools:approved.length,relatedPages:report.relatedPatched?.length||0,productionCandidates:report.productionCandidateCount}},null,2));process.exit(1)}
console.log(JSON.stringify({v11_16Validation:'PASS',approvedTools:approved.length,relatedPages:report.relatedPatched.length,hubRows:rowCount,hubH2:h2Count,productionCandidates:report.productionCandidateCount},null,2));
