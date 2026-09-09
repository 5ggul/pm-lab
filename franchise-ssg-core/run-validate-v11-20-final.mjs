import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const errors=[];
const root=await fs.readFile(path.join(out,'rankings/index.html'),'utf8');
const legacy=await fs.readFile(path.join(out,'rankings/cafe/index.html'),'utf8');
const home=await fs.readFile(path.join(out,'index.html'),'utf8');
const app=await fs.readFile(path.join(out,'assets/app.js'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const report=JSON.parse(await fs.readFile(path.join(out,'v11-20-ranking-hub.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));

if(report.uiVersion!=='11.20')errors.push(`report uiVersion ${report.uiVersion}`);
if(report.trustedBrands!==136)errors.push(`trustedBrands ${report.trustedBrands}`);
if(!(report.categoryCount>=15))errors.push(`categoryCount ${report.categoryCount}`);
if(report.productionCandidate!==true)errors.push('ranking hub not production candidate');
if((report.contentAudit?.risks||[]).length)errors.push(`content risks ${(report.contentAudit.risks||[]).join(',')}`);
if((report.contentAudit?.visibleTextChars||0)<4500)errors.push(`visibleTextChars ${report.contentAudit?.visibleTextChars}`);
if((report.contentAudit?.h2||0)<6)errors.push(`h2 ${report.contentAudit?.h2}`);
if((report.contentAudit?.tables||0)<5)errors.push(`tables ${report.contentAudit?.tables}`);
if((report.contentAudit?.numericFacts||0)<250)errors.push(`numericFacts ${report.contentAudit?.numericFacts}`);
if((report.contentAudit?.externalLinks||0)<2)errors.push(`externalLinks ${report.contentAudit?.externalLinks}`);
if(!root.includes('data-v11-ranking-hub="1"'))errors.push('ranking hub marker missing');
if(!root.includes('data-v11-ranking-dataset'))errors.push('ranking Dataset missing');
if(!root.includes('data-ranking-form'))errors.push('ranking live sort missing');
if((root.match(/data-ranking-row/g)||[]).length!==136)errors.push(`ranking full rows ${(root.match(/data-ranking-row/g)||[]).length}`);
for(const text of ['공개 창업비용이 낮은 순으로 보면?','가맹점 수가 많은 순으로 보면?','평균매출 공개지표가 높은 순으로 보면?','업종별 중앙값은 어떻게 다른가요?'])if(!root.includes(text))errors.push(`static ranking section missing: ${text}`);
if(root.includes(`${BASE}/rankings/cafe/`))errors.push('root links to legacy category ranking subpage');
if(!(quality.indexPolicy?.productionCandidateUrls||[]).includes('/rankings/'))errors.push('quality candidates missing /rankings/');
if((quality.indexPolicy?.productionCandidateUrls||[]).some(r=>/^\/rankings\/[^/]+\/$/.test(r)))errors.push('legacy ranking subpage leaked into production candidates');
if(!(manifest.indexPolicy?.productionCandidateUrls||[]).includes('/rankings/'))errors.push('manifest candidates missing /rankings/');
if(manifest.uiVersion!=='11.20')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_20?.legacyRankingSubpagesRemainNoindex!==true)errors.push('legacy noindex policy missing');
if(!home.includes(`${BASE}/rankings/`))errors.push('home ranking hub link missing');
if(!app.includes('/* v11.20 ranking hub */'))errors.push('ranking JS missing');
if(!css.includes('/* v11.20 ranking hub */'))errors.push('ranking CSS missing');
if(!root.includes('추천·수익성 점수가 아니라')&&!root.includes('추천 순위가'))errors.push('ranking non-recommendation disclosure missing');
if(!root.includes('임대보증금')||!root.includes('권리금'))errors.push('total investment distinction missing');
if(!root.includes('data.go.kr/data/15110265/openapi.do')||!root.includes('data.go.kr/data/15110241/openapi.do'))errors.push('official source links missing');
if(PREVIEW&&!root.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))errors.push('preview root noindex missing');
if(PREVIEW&&!legacy.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))errors.push('legacy ranking noindex missing');
if(PREVIEW){const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8');const sitemap=await fs.readFile(path.join(out,'sitemap.xml'),'utf8');if(!robots.includes('Disallow: /'))errors.push('preview robots not blocked');if(/<url>/.test(sitemap))errors.push('preview sitemap not empty')}

if(errors.length){console.error(JSON.stringify({v11_20Validation:'FAIL',errors,report},null,2));process.exit(1)}
console.log(JSON.stringify({v11_20Validation:'PASS',trustedBrands:report.trustedBrands,categories:report.categoryCount,productionCandidates:report.productionCandidateCount},null,2));
