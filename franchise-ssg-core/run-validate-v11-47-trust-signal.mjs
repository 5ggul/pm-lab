import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const snapshot=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-47-trust-signal.json'),'utf8'));
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const candidateCategorySlugs=new Set(candidates.map(r=>String(r).match(/^\/categories\/([^/]+)\/$/)?.[1]).filter(Boolean));
const snapshotCategories=Object.values(snapshot.categories||{});
const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const won=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'—';
const jong=s=>{const ch=[...String(s).trim()].at(-1)||'';const code=ch.charCodeAt(0);return code>=0xAC00&&code<=0xD7A3&&((code-0xAC00)%28)!==0};

if(manifest.uiVersion!=='11.47')err.push(`manifest ${manifest.uiVersion}`);
for(const k of ['trustedCategorySemantics','categorySampleDisclosure','categoryDatasetSync','trustedScatter','sourceFunnel','globalTapeRemoved','scrollCueRemoved','homeIntentTitle','budgetDeepLinks','rankingIntentH1','compareDirectAnswer','koreanParticleFix','v42VisualLanguagePreserved'])if(manifest.v11_47?.[k]!==true)err.push(`flag ${k}`);
if(manifest.v11_47?.candidateSetChanged!==false||manifest.v11_47?.indexPolicyChanged!==false||manifest.v11_47?.dataSemanticsChanged!==false||manifest.v11_47?.productionDeployed!==false||report.productionDeployed!==false)err.push('immutable contracts');
if(Number(snapshot.brand_count)!==136||Number(snapshot.category_count)!==20||candidates.length!==184||candidateCategorySlugs.size!==16)err.push(`counts ${snapshot.brand_count}/${snapshot.category_count}/${candidates.length}/${candidateCategorySlugs.size}`);
if(report.allHtmlPages!==htmlFiles.length||report.categoryPagesPatched!==20||report.candidateCategoryPages!==16||report.categoryCorePagesPatched!==16||report.categoryDatasetsPatched!==16||report.categorySampleNotesPatched!==16||report.scattersRebuilt!==16||report.categoryHubCardsPatched!==20||report.compareAnswersPatched!==7||report.budgetLinksPatched!==4||report.sourceFunnelPatched!==true)err.push(`report ${report.allHtmlPages}/${report.categoryPagesPatched}/${report.candidateCategoryPages}/${report.categoryCorePagesPatched}/${report.categoryDatasetsPatched}/${report.categorySampleNotesPatched}/${report.scattersRebuilt}/${report.categoryHubCardsPatched}/${report.compareAnswersPatched}/${report.budgetLinksPatched}/${report.sourceFunnelPatched}`);
if((css.match(/\/\* v11\.47 trust signal \*\//g)||[]).length!==1||(css.match(/\/\* v11\.47 trust signal end \*\//g)||[]).length!==1)err.push('css markers');
for(const t of ['.v47-sample-note','.v47-source-funnel','.v47-direct-answer','.v47-home-sub','@media(max-width:430px)'])if(!css.includes(t))err.push(`css ${t}`);

let body=0,noindex=0,tapes=0,cues=0;
for(const f of htmlFiles){const h=await fs.readFile(f,'utf8');if(/<body\b[^>]*\bv47-trust-ui\b[^>]*data-v47-trust-ui="1"/i.test(h))body++;else err.push(`body ${path.relative(out,f)}`);if(h.includes('v41-global-tape'))tapes++;if(h.includes('v41-scroll-cue'))cues++;}
if(body!==htmlFiles.length||tapes!==0||cues!==0)err.push(`global ${body}/${htmlFiles.length} tape=${tapes} cue=${cues}`);
for(const r of candidates){const h=await fs.readFile(fileFor(r),'utf8');if(/<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/i.test(h))noindex++;else err.push(`noindex ${r}`)}
if(noindex!==184)err.push(`noindex ${noindex}`);

const home=await fs.readFile(fileFor('/'),'utf8');
if(!home.includes('<h1 class="v44-home-title">프랜차이즈 창업비용 비교</h1>')||!home.includes('가맹점·평균매출·업종 중앙값까지 2025 공개자료로 비교'))err.push('home intent');
for(const [value,label] of [['5000','5천만원'],['7000','7천만원'],['10000','1억원'],['15000','1억5천']])if(!home.includes(`/explore/?budget=${value}#finder"><span>${label} 이하`))err.push(`budget ${value}`);

const categories=await fs.readFile(fileFor('/categories/'),'utf8');
let trustedScatters=0,categoryDatasets=0,sampleNotes=0;
for(const c of snapshotCategories){
  if(!categories.includes(`<strong>${c.name}</strong><span>공식 매칭`)||!categories.includes(`분석 ${c.count}개 · 분석 중앙값 ${won(c.cost?.median)}`))err.push(`category hub ${c.slug}`);
  const p=fileFor(`/categories/${c.slug}/`);
  const h=await fs.readFile(p,'utf8');
  if(!h.includes(`신뢰 게이트 분석 ${c.count}개 브랜드`))err.push(`category meta ${c.slug}`);
  if(!candidateCategorySlugs.has(String(c.slug)))continue;
  if(h.includes(`data-v47-category-sample="${c.slug}"`))sampleNotes++;else err.push(`sample note ${c.slug}`);
  const rows=(snapshot.brands||[]).filter(b=>b.categorySlug===c.slug&&finite(b.cost)&&finite(b.stores));
  const circles=(h.match(/<circle cx=/g)||[]).length;
  if(circles!==rows.length)err.push(`scatter ${c.slug} ${circles}/${rows.length}`);
  if(h.includes('data-v47-trusted-scatter="1"'))trustedScatters++;else err.push(`trusted scatter ${c.slug}`);
  const m=h.match(/<script type="application\/ld\+json" data-v11-category-dataset>([\s\S]*?)<\/script>/);
  if(!m){err.push(`dataset missing ${c.slug}`);continue}
  try{const d=JSON.parse(m[1]);const vm=d.variableMeasured||[];const analysis=vm.find(x=>x.name==='신뢰 게이트 분석 표본');const cost=vm.find(x=>x.name==='공개 창업비용 중앙값');if(Number(analysis?.value)!==Number(c.count)||Number(cost?.value)!==Math.round(Number(c.cost?.median)*10)/10)err.push(`dataset values ${c.slug}`);else categoryDatasets++}catch{err.push(`dataset parse ${c.slug}`)}
}
if(sampleNotes!==16||trustedScatters!==16||categoryDatasets!==16)err.push(`category core ${sampleNotes}/${trustedScatters}/${categoryDatasets}`);

const sources=await fs.readFile(fileFor('/sources/'),'utf8');
if(!sources.includes('data-v47-source-funnel="1"')||!sources.includes('원천 레코드')||!sources.includes('카탈로그')||!sources.includes('공식 매칭')||!sources.includes('신뢰 게이트'))err.push('source funnel');

let rankingCount=0;
for(const c of snapshotCategories){const p=path.join(out,'rankings',c.slug,'index.html');try{const h=await fs.readFile(p,'utf8');rankingCount++;if(!h.includes(`<h1>${c.name} 프랜차이즈 가맹점 수 정렬</h1>`))err.push(`ranking h1 ${c.slug}`)}catch{}}
if(rankingCount!==report.rankingH1Patched)err.push(`ranking report ${rankingCount}/${report.rankingH1Patched}`);

let direct=0;
for(const r of candidates.filter(x=>/^\/compare\/[^/]+-vs-[^/]+\/$/.test(x))){
  const h=await fs.readFile(fileFor(r),'utf8');
  if(h.includes('data-v47-direct-answer="1"'))direct++;else err.push(`direct ${r}`);
  const hm=h.match(/<h1>([^<]+) vs ([^<]+)<\/h1>/);
  if(hm){const a=hm[1],b=hm[2],wrong=`${a}${jong(a)?'와':'과'} ${b}`;if(h.includes(wrong))err.push(`particle ${r}`)}
}
if(direct!==7)err.push(`direct count ${direct}`);

if(err.length){console.error(JSON.stringify({v11_47TrustSignalValidation:'FAIL',count:err.length,htmlPages:htmlFiles.length,body,noindex,tapes,cues,candidateCategoryPages:candidateCategorySlugs.size,sampleNotes,trustedScatters,categoryDatasets,rankingCount,direct,errors:err.slice(0,200)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_47TrustSignalValidation:'PASS',htmlPages:htmlFiles.length,body,candidates:184,noindex,categories:20,candidateCategoryPages:16,categoryHubCards:20,sampleNotes,trustedScatters,categoryDatasets,rankingIntentPages:rankingCount,directAnswers:direct,globalTapeRemoved:true,scrollCueRemoved:true,v42VisualLanguagePreserved:true,productionDeployed:false},null,2));
