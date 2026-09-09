import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-18-compare-placement.json'),'utf8'));
const compareReport=JSON.parse(await fs.readFile(path.join(out,'v11-17-compare-trust.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));

if(report.uiVersion!=='11.18')errors.push(`report uiVersion ${report.uiVersion}`);
if(manifest.uiVersion!=='11.18')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_18?.compareContextPlacementFix!==true)errors.push('manifest placement fix flag missing');
if(quality.contentTrust?.version!=='11.18'||quality.contentTrust?.compareContextPlacementFix!==true)errors.push('quality placement fix metadata missing');
if(report.fixedCount!==7)errors.push(`fixed comparison page count ${report.fixedCount}`);
if(report.fixedCount!==(compareReport.eligible||[]).length)errors.push(`fixed/eligible mismatch ${report.fixedCount}/${compareReport.eligible?.length||0}`);
if(report.productionCandidateCount!==compareReport.productionCandidateCount)errors.push(`candidate count changed ${report.productionCandidateCount}/${compareReport.productionCandidateCount}`);

for(const row of compareReport.eligible||[]){
  const file=path.join(out,...row.route.split('/').filter(Boolean),'index.html');
  const html=await fs.readFile(file,'utf8');
  const marker='data-v11-17-compare-next="1"';
  const placement='data-v11-18-page-level="1"';
  const count=(html.match(/data-v11-17-compare-next="1"/g)||[]).length;
  if(count!==1)errors.push(`${row.route}: compare-next count ${count}`);
  const nextPos=html.indexOf(marker);
  const placementPos=html.indexOf(placement);
  const sourcePos=html.lastIndexOf('<section class="block"><h2>출처</h2>');
  const mobilePos=html.indexOf('<div class="mobile-compare">');
  const lastArticleClose=html.lastIndexOf('</article>');
  const firstArticleCloseAfterNext=nextPos>=0?html.indexOf('</article>',nextPos):-1;
  if(nextPos<0||placementPos<0)errors.push(`${row.route}: placement marker missing`);
  if(sourcePos<0)errors.push(`${row.route}: source anchor missing`);
  if(nextPos>=0&&sourcePos>=0&&nextPos<sourcePos)errors.push(`${row.route}: compare-next appears before source section`);
  if(nextPos>=0&&mobilePos>=0&&nextPos<sourcePos)errors.push(`${row.route}: compare-next can still be inside mobile comparison content`);
  if(firstArticleCloseAfterNext!==lastArticleClose)errors.push(`${row.route}: compare-next is not immediately within outermost article scope`);
  if(nextPos>lastArticleClose)errors.push(`${row.route}: compare-next is outside outer article`);
  const tailStart=Math.max(0,lastArticleClose-3500);
  if(!html.slice(tailStart,lastArticleClose).includes(placement))errors.push(`${row.route}: compare-next not located near page tail`);
  if(!html.includes('noindex,nofollow,noarchive,nosnippet'))errors.push(`${row.route}: preview noindex lost`);
}

for(const row of compareReport.blocked||[]){
  const file=path.join(out,...row.route.split('/').filter(Boolean),'index.html');
  const html=await fs.readFile(file,'utf8');
  if(html.includes('data-v11-18-page-level="1"'))errors.push(`${row.route}: blocked page received v11.18 placement marker`);
}

if(errors.length){console.error(JSON.stringify({v11_18Validation:'FAIL',errors,summary:{fixed:report.fixedCount,candidates:report.productionCandidateCount}},null,2));process.exit(1)}
console.log(JSON.stringify({v11_18Validation:'PASS',fixedComparisonPages:report.fixedCount,productionCandidates:report.productionCandidateCount},null,2));
