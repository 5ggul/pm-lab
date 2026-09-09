import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const errors=[];
const html=await fs.readFile(path.join(out,'explore/index.html'),'utf8');
const home=await fs.readFile(path.join(out,'index.html'),'utf8');
const app=await fs.readFile(path.join(out,'assets/app.js'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const report=JSON.parse(await fs.readFile(path.join(out,'v11-19-budget-intent.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));

if(report.uiVersion!=='11.19')errors.push(`report uiVersion ${report.uiVersion}`);
if(report.trustedBrands!==136)errors.push(`trustedBrands ${report.trustedBrands}`);
if(!(report.under100mBrands>0))errors.push(`under100mBrands ${report.under100mBrands}`);
if(!(report.categoryUnder100m>0))errors.push(`categoryUnder100m ${report.categoryUnder100m}`);
if(report.productionCandidate!==true)errors.push('budget explorer not production candidate');
if((report.contentAudit?.risks||[]).length)errors.push(`content risks: ${(report.contentAudit.risks||[]).join(',')}`);
if((report.contentAudit?.visibleTextChars||0)<2200)errors.push(`visibleTextChars ${report.contentAudit?.visibleTextChars}`);
if((report.contentAudit?.h2||0)<5)errors.push(`h2 ${report.contentAudit?.h2}`);
if((report.contentAudit?.tables||0)<4)errors.push(`tables ${report.contentAudit?.tables}`);
if((report.contentAudit?.numericFacts||0)<35)errors.push(`numericFacts ${report.contentAudit?.numericFacts}`);
if((report.contentAudit?.externalLinks||0)<2)errors.push(`externalLinks ${report.contentAudit?.externalLinks}`);

const stats=report.budgetStats||[];
if(stats.length!==5)errors.push(`budgetStats length ${stats.length}`);
for(let i=1;i<stats.length;i++)if(Number(stats[i].count)<Number(stats[i-1].count))errors.push('budget counts are not monotonic');
if(!html.includes('data-v11-budget-explorer="1"'))errors.push('budget explorer marker missing');
if(!html.includes('data-v11-budget-dataset'))errors.push('budget Dataset JSON-LD missing');
if(!html.includes('data-budget-form'))errors.push('live budget form missing');
if(!html.includes('data-budget-results'))errors.push('budget result table missing');
if((html.match(/data-budget-row/g)||[]).length!==136)errors.push(`rendered trusted rows ${(html.match(/data-budget-row/g)||[]).length}`);
if(!html.includes('1억원 이하 브랜드는 어떤 순서로 확인되나요?'))errors.push('1억원 static answer section missing');
if(!html.includes('1억원 이하 브랜드가 있는 업종은 어디인가요?'))errors.push('category budget section missing');
if(!html.includes('공개합계')&&!html.includes('공개 창업비용'))errors.push('public cost distinction missing');
if(!html.includes('임대보증금')||!html.includes('권리금'))errors.push('excluded investment cost explanation missing');
if(!html.includes('data.go.kr/data/15110265/openapi.do')||!html.includes('data.go.kr/data/15110241/openapi.do'))errors.push('official source links missing');
if(!home.includes(`${BASE}/explore/`))errors.push('home budget explorer link missing');
if(!app.includes('/* v11.19 budget explorer */'))errors.push('budget explorer JS missing');
if(!css.includes('/* v11.19 budget explorer */'))errors.push('budget explorer CSS missing');
if(!(quality.indexPolicy?.productionCandidateUrls||[]).includes('/explore/'))errors.push('quality index candidates missing /explore/');
if(!(manifest.indexPolicy?.productionCandidateUrls||[]).includes('/explore/'))errors.push('manifest index candidates missing /explore/');
if(manifest.uiVersion!=='11.19')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_19?.productionCandidate!==true)errors.push('manifest productionCandidate false');
if(PREVIEW&&!html.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))errors.push('preview robots noindex missing');
if(PREVIEW){const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8');const sitemap=await fs.readFile(path.join(out,'sitemap.xml'),'utf8');if(!robots.includes('Disallow: /'))errors.push('preview robots.txt not blocked');if(/<url>/.test(sitemap))errors.push('preview sitemap not empty')}

if(errors.length){console.error(JSON.stringify({v11_19Validation:'FAIL',errors,report},null,2));process.exit(1)}
console.log(JSON.stringify({v11_19Validation:'PASS',trustedBrands:report.trustedBrands,under100mBrands:report.under100mBrands,categoryUnder100m:report.categoryUnder100m,productionCandidates:report.productionCandidateCount},null,2));
