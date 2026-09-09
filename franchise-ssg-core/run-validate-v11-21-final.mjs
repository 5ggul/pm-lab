import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const home=await fs.readFile(path.join(out,'index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const report=JSON.parse(await fs.readFile(path.join(out,'v11-21-home-funnel.json'),'utf8'));
const report14=JSON.parse(await fs.readFile(path.join(out,'v11-14-history-tiers.json'),'utf8'));
const report16=JSON.parse(await fs.readFile(path.join(out,'v11-16-tool-hub.json'),'utf8'));
const report17=JSON.parse(await fs.readFile(path.join(out,'v11-17-compare-trust.json'),'utf8'));
const report19=JSON.parse(await fs.readFile(path.join(out,'v11-19-budget-intent.json'),'utf8'));
const report20=JSON.parse(await fs.readFile(path.join(out,'v11-20-ranking-hub.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const BASE='/pm-lab/franchise-ssg-preview';
const expectedRoutes=['/explore/','/rankings/','/compare/','/tools/startup-cost/'];
const candidates=new Set(quality.indexPolicy?.productionCandidateUrls||[]);

if(!home.includes('data-v11-home-funnel="1"'))errors.push('home funnel main marker missing');
if(!home.includes('data-v11-home-funnel-section="1"'))errors.push('home funnel section missing');
if((home.match(/data-funnel-step="\d"/g)||[]).length!==4)errors.push('home funnel must have exactly four steps');
for(const route of expectedRoutes){if(!home.includes(`href="${BASE}${route}"`))errors.push(`home funnel route missing ${route}`);if(!candidates.has(route))errors.push(`funnel route is not a production candidate ${route}`)}
if(!home.includes(`<b>${report14.productionBrandCandidates}</b><span>신뢰 비교 브랜드</span>`))errors.push('trusted brand status does not match v11.14');
if(!home.includes(`<b>${report19.under100mBrands}</b><span>1억원 이하</span>`))errors.push('under-100m status does not match v11.19');
if(!home.includes(`<b>${report17.eligibleCompareCount}</b><span>검증 비교</span>`))errors.push('compare status does not match v11.17');
if(!home.includes(`<b>${report16.approvedToolCount}</b><span>실사용 도구</span>`))errors.push('tool status does not match v11.16');
const budget50=Number(report19.budgetStats?.find(x=>Number(x.limit)===5000)?.count||0);
const budget70=Number(report19.budgetStats?.find(x=>Number(x.limit)===7000)?.count||0);
if(!home.includes(`5천만원 이하 ${budget50}개 · 7천만원 이하 ${budget70}개 · 1억원 이하 ${report19.under100mBrands}개`))errors.push('budget proof line missing or stale');
if(!home.includes('170개 프랜차이즈 브랜드'))errors.push('catalog-size context disappeared from home description');
if(!home.includes('공개 창업비용은 실제 총투자금과 같지 않습니다'))errors.push('total-investment disclaimer missing from funnel');
if(!css.includes('/* v11.21 home decision funnel */'))errors.push('home funnel CSS marker missing');
const funnelCss=css.split('/* v11.21 home decision funnel */')[1]||'';
if(/border-radius\s*:|box-shadow\s*:/.test(funnelCss))errors.push('home funnel introduced card-style radius or shadow');
if(!/\.home-funnel-row\{[^}]*border-bottom:1px solid var\(--line\)/.test(funnelCss))errors.push('editorial row divider rule missing');
if(!home.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))errors.push('preview home noindex missing');
if(!candidates.has('/'))errors.push('home disappeared from production candidate set');
if(report.uiVersion!=='11.21')errors.push(`report uiVersion ${report.uiVersion}`);
if(report.trustedBrands!==report14.productionBrandCandidates)errors.push('report trustedBrands mismatch');
if(report.under100m!==report19.under100mBrands)errors.push('report under100m mismatch');
if(report.eligibleCompares!==report17.eligibleCompareCount)errors.push('report eligibleCompares mismatch');
if(report.approvedTools!==report16.approvedToolCount)errors.push('report approvedTools mismatch');
if(report.productionCandidateCount!==report20.productionCandidateCount)errors.push('home redesign changed production candidate count unexpectedly');
if(manifest.uiVersion!=='11.21')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_21?.funnelSteps!==4)errors.push('manifest funnelSteps mismatch');

if(errors.length){console.error(JSON.stringify({v11_21Validation:'FAIL',errors,report},null,2));process.exit(1)}
console.log(JSON.stringify({v11_21Validation:'PASS',trustedBrands:report.trustedBrands,under100m:report.under100m,eligibleCompares:report.eligibleCompares,approvedTools:report.approvedTools,productionCandidates:report.productionCandidateCount},null,2));
