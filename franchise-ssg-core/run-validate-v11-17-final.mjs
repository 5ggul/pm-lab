import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-17-compare-trust.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const hub=await fs.readFile(path.join(out,'compare/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const candidates=new Set((quality.indexPolicy?.productionCandidateUrls||[]).map(x=>x==='/'?'/':`/${String(x).replace(/^\/+|\/+$/g,'')}/`));
const expectedEligible=[
  '/compare/mega-mgc-coffee-vs-compose-coffee/',
  '/compare/mega-mgc-coffee-vs-paiks-coffee/',
  '/compare/compose-coffee-vs-the-venti/',
  '/compare/kyochon-chicken-vs-bhc-chicken/',
  '/compare/goobne-chicken-vs-kyochon-chicken/',
  '/compare/momstouch-vs-frank-burger/',
  '/compare/gimgane-vs-yamsaem-gimbap/'
];
const expectedBlocked=[
  '/compare/bhc-chicken-vs-bbq-chicken/',
  '/compare/paris-baguette-vs-tous-les-jours/',
  '/compare/cu-vs-gs25/'
];

if(report.uiVersion!=='11.17')errors.push(`report uiVersion ${report.uiVersion}`);
if(manifest.uiVersion!=='11.17')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_17?.compareTrustPolicy!==true)errors.push('compareTrustPolicy flag missing');
if(report.eligibleCompareCount!==7)errors.push(`eligible compare count ${report.eligibleCompareCount}`);
if(report.blockedCompareCount!==3)errors.push(`blocked compare count ${report.blockedCompareCount}`);
if(report.tierBExpandedCompareCount!==2)errors.push(`Tier B expanded compare count ${report.tierBExpandedCompareCount}`);
if(report.productionCandidateCount!==report.previousCandidateCount+2)errors.push(`candidate expansion is not +2: ${report.previousCandidateCount} -> ${report.productionCandidateCount}`);
if(quality.contentTrust?.version!=='11.17'||quality.contentTrust?.compareTrustPolicy!==true)errors.push('quality compare trust metadata missing');
if(quality.contentTrust?.compareTierPolicy!=='TIER_A_OR_TIER_B_BOTH_REQUIRED')errors.push(`compare tier policy ${quality.contentTrust?.compareTierPolicy}`);
for(const route of expectedEligible)if(!candidates.has(route))errors.push(`eligible comparison missing from candidates: ${route}`);
for(const route of expectedBlocked)if(candidates.has(route))errors.push(`blocked comparison leaked into candidates: ${route}`);

if(!hub.includes('data-v11-17-compare-hub="1"'))errors.push('compare hub marker missing');
if(!hub.includes('data-v11-17-compare-list'))errors.push('compare ItemList marker missing');
if(hub.includes('대표 브랜드 비교 10개'))errors.push('stale 10-comparison copy remains');
if(hub.includes('bhc-chicken-vs-bbq-chicken')||hub.includes('paris-baguette-vs-tous-les-jours')||hub.includes('cu-vs-gs25'))errors.push('blocked comparison remains linked in hub');
if(!hub.includes('현재 연속 이력 기준까지 통과한 7개 조합'))errors.push('verified comparison count copy missing');
const rowCount=(hub.match(/data-v11-17-compare-row=/g)||[]).length;
if(rowCount!==7)errors.push(`hub comparison row count ${rowCount}`);
const h2Count=(hub.match(/<h2\b/g)||[]).length;
if(h2Count<5)errors.push(`compare hub H2 depth ${h2Count}`);
for(const phrase of ['3개년 이상','연속 2개년','보강 대기','공개비용 차이 A-B','가맹점 차이 A-B'])if(!hub.includes(phrase))errors.push(`compare hub basis text missing: ${phrase}`);

const listRaw=hub.match(/<script type="application\/ld\+json" data-v11-17-compare-list>([\s\S]*?)<\/script>/)?.[1];
if(!listRaw)errors.push('compare ItemList payload missing');else{
  try{
    const data=JSON.parse(listRaw);
    if(data['@type']!=='ItemList')errors.push(`compare schema type ${data['@type']}`);
    if(data.numberOfItems!==7)errors.push(`compare ItemList numberOfItems ${data.numberOfItems}`);
    if(!Array.isArray(data.itemListElement)||data.itemListElement.length!==7)errors.push('compare ItemList element count invalid');
    const urls=new Set((data.itemListElement||[]).map(x=>x.url));
    if(urls.size!==7)errors.push('compare ItemList URLs are not unique');
    for(const blocked of expectedBlocked)if([...urls].some(url=>url.endsWith(blocked)))errors.push(`blocked comparison in ItemList: ${blocked}`);
  }catch(err){errors.push(`compare ItemList JSON parse failed: ${err.message}`)}
}

for(const row of report.eligible||[]){
  const file=path.join(out,...row.route.split('/').filter(Boolean),'index.html');
  const html=await fs.readFile(file,'utf8');
  if(!html.includes('data-v11-17-compare-trust="1"'))errors.push(`trust note missing: ${row.route}`);
  if(!html.includes('data-v11-17-compare-next="1"'))errors.push(`compare-next section missing: ${row.route}`);
  if(!html.includes(`href="/pm-lab/franchise-ssg-preview${row.a.route}"`))errors.push(`brand A detail link missing: ${row.route}`);
  if(!html.includes(`href="/pm-lab/franchise-ssg-preview${row.b.route}"`))errors.push(`brand B detail link missing: ${row.route}`);
  if(!html.includes('/tools/startup-cost/'))errors.push(`startup-cost contextual link missing: ${row.route}`);
  if(row.costDiff==='—'||row.storeDiff==='—')errors.push(`comparison summary diff not parsed: ${row.route}`);
  if(!html.includes('noindex,nofollow,noarchive,nosnippet'))errors.push(`preview noindex lost: ${row.route}`);
}
const tierBEligible=(report.eligible||[]).filter(row=>row.a.tier==='B'||row.b.tier==='B');
if(tierBEligible.length!==2)errors.push(`eligible Tier B page count ${tierBEligible.length}`);
for(const row of tierBEligible){
  const years=row.a.tier==='B'?row.a.historyYears:row.b.historyYears;
  if(years.length!==2||years[1]!==years[0]+1)errors.push(`Tier B years are not exactly two consecutive years: ${row.route} ${years.join(',')}`);
}
for(const row of report.blocked||[]){
  const file=path.join(out,...row.route.split('/').filter(Boolean),'index.html');
  const html=await fs.readFile(file,'utf8');
  if(html.includes('data-v11-17-compare-trust="1"'))errors.push(`blocked page received verified trust note: ${row.route}`);
  if(!html.includes('noindex,nofollow,noarchive,nosnippet'))errors.push(`blocked comparison lost noindex: ${row.route}`);
  if(row.a.tier!=='C'&&row.b.tier!=='C')errors.push(`blocked pair has no Tier C brand: ${row.route}`);
}
if(!hub.includes('noindex,nofollow,noarchive,nosnippet'))errors.push('compare hub preview noindex lost');
if(!css.includes('/* v11.17 compare trust */'))errors.push('v11.17 compare CSS missing');
const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8');
if(report.previewMode&&robots.trim()!=='User-agent: *\nDisallow: /')errors.push('preview robots.txt no longer blocks crawling');

if(errors.length){console.error(JSON.stringify({v11_17Validation:'FAIL',errors,summary:{eligible:report.eligibleCompareCount,blocked:report.blockedCompareCount,tierBExpanded:report.tierBExpandedCompareCount,candidates:report.productionCandidateCount}},null,2));process.exit(1)}
console.log(JSON.stringify({v11_17Validation:'PASS',eligibleComparisons:report.eligibleCompareCount,blockedComparisons:report.blockedCompareCount,tierBExpandedComparisons:report.tierBExpandedCompareCount,hubRows:rowCount,productionCandidates:report.productionCandidateCount},null,2));
