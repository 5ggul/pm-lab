import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-7-history-trust.json'),'utf8'));

if(report.uiVersion!=='11.7')errors.push(`history trust report uiVersion ${report.uiVersion}`);
if(Number(report.matchedBrands)!==149)errors.push(`matched official brands ${report.matchedBrands}/149`);
if(Number(report.historyPagesPatched)<100)errors.push(`history pages patched unexpectedly low: ${report.historyPagesPatched}`);
if(!Array.isArray(report.findings))errors.push('history findings missing');
if(!Array.isArray(report.renderedPlaceholderLeaks))errors.push('rendered placeholder leak list missing');
if(Array.isArray(report.renderedPlaceholderLeaks)&&report.renderedPlaceholderLeaks.length)errors.push(`rendered placeholder leaks: ${report.renderedPlaceholderLeaks.length}`);
if(Number(report.suppressedPlaceholderRows)!==Number((report.findings||[]).reduce((sum,item)=>sum+Number(item.suppressedRows||0),0)))errors.push('suppressed placeholder row total mismatch');

const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
if(manifest.uiVersion!=='11.7')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(!manifest.v11_7?.historyPlaceholderSuppression)errors.push('manifest history placeholder suppression missing');
if(Number(manifest.v11_7?.renderedPlaceholderLeaks)!==0)errors.push('manifest rendered placeholder leaks must be zero');
if(Number(manifest.v11_7?.suppressedPlaceholderRows)!==Number(report.suppressedPlaceholderRows))errors.push('manifest/report suppression count mismatch');

const mega=await fs.readFile(path.join(out,'brands/mega-mgc-coffee/index.html'),'utf8');
const megaZero2023='<td data-label="공정위 기준년도">2023</td><td data-label="가맹점" class="num">0개</td>';
if(mega.includes(megaZero2023))errors.push('mega-mgc-coffee still renders 2023 placeholder as factual zero');

const pkg=JSON.parse(await fs.readFile(path.join(here,'package.json'),'utf8'));
if(!String(pkg.scripts?.build||'').includes('run-generate-v11-7-final.mjs'))errors.push('package build missing v11.7 generator');
if(!String(pkg.scripts?.build||'').includes('run-validate-v11-7-final.mjs'))errors.push('package build missing v11.7 validator');

if(errors.length){
  console.error(JSON.stringify({v11_7Validation:'FAIL',errors,report},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_7Validation:'PASS',matchedBrands:report.matchedBrands,historyPagesPatched:report.historyPagesPatched,affectedBrands:report.affectedBrands,suppressedPlaceholderRows:report.suppressedPlaceholderRows,renderedPlaceholderLeaks:0},null,2));
