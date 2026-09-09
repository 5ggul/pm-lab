import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v11-20-final.mjs?v1121=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const generatedAt=new Date().toISOString();

const report14=JSON.parse(await fs.readFile(path.join(out,'v11-14-history-tiers.json'),'utf8'));
const report16=JSON.parse(await fs.readFile(path.join(out,'v11-16-tool-hub.json'),'utf8'));
const report17=JSON.parse(await fs.readFile(path.join(out,'v11-17-compare-trust.json'),'utf8'));
const report19=JSON.parse(await fs.readFile(path.join(out,'v11-19-budget-intent.json'),'utf8'));
const report20=JSON.parse(await fs.readFile(path.join(out,'v11-20-ranking-hub.json'),'utf8'));
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));

const trustedBrands=Number(report14.productionBrandCandidates||0);
const under100m=Number(report19.under100mBrands||0);
const compareCount=Number(report17.eligibleCompareCount||0);
const toolCount=Number(report16.approvedToolCount||0);
const budget50=Number(report19.budgetStats?.find(x=>Number(x.limit)===5000)?.count||0);
const budget70=Number(report19.budgetStats?.find(x=>Number(x.limit)===7000)?.count||0);
const productionCandidateCount=Number(report20.productionCandidateCount||0);
if(!trustedBrands||!under100m||!compareCount||!toolCount)throw new Error('Home funnel source metrics missing');

const homePath=path.join(out,'index.html');
let home=await fs.readFile(homePath,'utf8');
home=home.replace('<main id="main" data-v10-home="1">','<main id="main" data-v10-home="1" data-v11-home-funnel="1">');
home=home.replace(/<div class="quick-links">[\s\S]*?<\/div><\/div><figure class="startup-motion"/,`<div class="quick-links"><a href="${BASE}/explore/">예산으로 찾기</a><a href="${BASE}/rankings/">데이터 순위</a><a href="${BASE}/compare/">브랜드 비교</a><a href="${BASE}/tools/startup-cost/">내 비용 계산</a></div></div><figure class="startup-motion"`);
home=home.replace(/<div class="shell data-status">[\s\S]*?<\/div><\/div><section class="home-section">/,`<div class="shell data-status" data-v11-home-status="1"><div><b>${trustedBrands}</b><span>신뢰 비교 브랜드</span></div><div><b>${under100m}</b><span>1억원 이하</span></div><div><b>${compareCount}</b><span>검증 비교</span></div><div><b>${toolCount}</b><span>실사용 도구</span></div></div><section class="home-section home-funnel" data-v11-home-funnel-section="1"><div class="shell"><div class="section-head"><h2>창업비용을 확인하는 순서</h2><span class="basis-chip">공식 공개값 기준</span></div><div class="home-funnel-list"><a class="home-funnel-row" data-funnel-step="1" href="${BASE}/explore/"><span class="funnel-no">01</span><span class="funnel-copy"><strong>예산으로 후보 줄이기</strong><small>5천만원 이하 ${budget50}개 · 7천만원 이하 ${budget70}개 · 1억원 이하 ${under100m}개</small></span><span class="funnel-go">예산별 찾기</span></a><a class="home-funnel-row" data-funnel-step="2" href="${BASE}/rankings/"><span class="funnel-no">02</span><span class="funnel-copy"><strong>비용·가맹점·매출 위치 확인</strong><small>신뢰 게이트를 통과한 ${trustedBrands}개 브랜드를 세 지표로 따로 정렬</small></span><span class="funnel-go">데이터 순위</span></a><a class="home-funnel-row" data-funnel-step="3" href="${BASE}/compare/"><span class="funnel-no">03</span><span class="funnel-copy"><strong>같은 업종 브랜드 직접 비교</strong><small>현재 신뢰 조건을 통과한 비교 조합 ${compareCount}개</small></span><span class="funnel-go">브랜드 비교</span></a><a class="home-funnel-row" data-funnel-step="4" href="${BASE}/tools/startup-cost/"><span class="funnel-no">04</span><span class="funnel-copy"><strong>내 점포 조건으로 총비용 계산</strong><small>공개합계와 임대·권리금·추가공사를 분리해서 입력</small></span><span class="funnel-go">비용 계산</span></a></div><p class="home-funnel-note">공개 창업비용은 실제 총투자금과 같지 않습니다. 예산으로 후보를 줄인 뒤 브랜드 상세의 비용 구성과 점포 이력을 보고, 마지막에 내 점포 조건을 따로 계산합니다.</p></div></section><section class="home-section">`);
home=home.replace('<h2>브랜드 창업비용</h2>','<h2>브랜드별 공개 창업비용</h2>');
await fs.writeFile(homePath,home,'utf8');

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.21 home decision funnel */')){
  css+=`\n/* v11.21 home decision funnel */\n.home-funnel{border-top:1px solid var(--line)}.home-funnel-list{border-top:2px solid #1c1916}.home-funnel-row{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:18px;align-items:center;padding:18px 0;border-bottom:1px solid var(--line);text-decoration:none;color:inherit}.home-funnel-row:hover .funnel-go{text-decoration:underline}.funnel-no{font:700 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#777068}.funnel-copy{display:grid;gap:4px}.funnel-copy strong{font-size:17px;letter-spacing:-.02em}.funnel-copy small{font-size:13px;line-height:1.55;color:#6b645c}.funnel-go{font-size:13px;font-weight:700;white-space:nowrap}.home-funnel-note{max-width:860px;margin:16px 0 0;font-size:13px;line-height:1.7;color:#6b645c}@media(max-width:720px){.home-funnel-row{grid-template-columns:38px minmax(0,1fr);gap:12px;padding:16px 0}.funnel-go{grid-column:2;margin-top:2px}.funnel-copy strong{font-size:16px}.funnel-copy small{font-size:12px}}\n`;
  await fs.writeFile(cssPath,css,'utf8');
}

manifest.uiVersion='11.21';
manifest.v11_21={homeDecisionFunnel:true,funnelSteps:4,trustedBrands,under100m,eligibleCompares:compareCount,approvedTools:toolCount,productionCandidateCount};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
quality.contentTrust={...(quality.contentTrust||{}),version:'11.21',generatedAt,homeDecisionFunnel:true,homeFunnelMetrics:{trustedBrands,under100m,eligibleCompares:compareCount,approvedTools:toolCount}};
await fs.writeFile(qualityPath,JSON.stringify(quality,null,2),'utf8');

const report={schemaVersion:1,generatedAt,uiVersion:'11.21',previewMode:PREVIEW,policy:'HOME_IS_A_DECISION_FUNNEL_NOT_A_CARD_DASHBOARD; SEARCH_TO_BUDGET_TO_RANKING_TO_COMPARE_TO_CALCULATOR; ALL_COUNTS_COME_FROM_VALIDATED_REPORTS',trustedBrands,under100m,budget50,budget70,eligibleCompares:compareCount,approvedTools:toolCount,funnelRoutes:['/explore/','/rankings/','/compare/','/tools/startup-cost/'],productionCandidateCount};
await fs.writeFile(path.join(out,'v11-21-home-funnel.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_21:'PASS',trustedBrands,under100m,budget50,budget70,eligibleCompares:compareCount,approvedTools:toolCount,productionCandidates:productionCandidateCount},null,2));
