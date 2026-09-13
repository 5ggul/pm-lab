import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const snapshot=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-48-brand-distinctness.json'),'utf8'));
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const fileFor=r=>path.join(out,...String(r).split('/').filter(Boolean),'index.html');
const positive=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0;
const strip=s=>String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

if(manifest.uiVersion!=='11.48')err.push(`manifest ${manifest.uiVersion}`);
for(const k of ['brandDistinctness','genericEvidenceSummaryRemoved','genericReadingCopyRemoved','dataDrivenTopSignals','methodologyLinkCentralized','v42VisualLanguagePreserved'])if(manifest.v11_48?.[k]!==true)err.push(`flag ${k}`);
if(manifest.v11_48?.candidateSetChanged!==false||manifest.v11_48?.indexPolicyChanged!==false||manifest.v11_48?.dataSemanticsChanged!==false||manifest.v11_48?.productionDeployed!==false||report.productionDeployed!==false)err.push('immutable contracts');
if(Number(snapshot.brand_count)!==136||Number(snapshot.category_count)!==20||candidates.length!==184)err.push(`counts ${snapshot.brand_count}/${snapshot.category_count}/${candidates.length}`);
for(const [k,v] of [['brandPages',136],['uniqueBriefs',136],['genericSummaryRemoved',136],['genericReadingRemoved',136],['methodLinksAdded',136],['missingSalesBriefs',2],['candidatePages',184]])if(Number(report[k])!==v)err.push(`report ${k}=${report[k]}`);
if(report.copyPolishApplied!==true||!Number.isFinite(Number(report.copyPolishFiles))||Number(report.copyPolishFiles)<1||!Number.isFinite(Number(report.copyPolishPhrases))||Number(report.copyPolishPhrases)<1)err.push(`copy polish ${report.copyPolishApplied}/${report.copyPolishFiles}/${report.copyPolishPhrases}`);
if((css.match(/\/\* v11\.48 brand distinctness \*\//g)||[]).length!==1||(css.match(/\/\* v11\.48 brand distinctness end \*\//g)||[]).length!==1)err.push('css markers');
for(const t of ['.v48-brand-brief','.v48-profile','.v48-insight','.v48-method-link','@media(max-width:620px)'])if(!css.includes(t))err.push(`css ${t}`);

const briefTexts=new Set();let briefs=0,insights=0,profiles=0,methodLinks=0,missingSales=0,noindex=0,awkwardCopy=0;
for(const b of snapshot.brands||[]){
  const html=await fs.readFile(fileFor(b.route),'utf8');
  const rel=b.slug;
  if(!/\bv48-brand-distinct\b/.test(html)||!html.includes('data-v48-brand-distinct="1"'))err.push(`body ${rel}`);
  const block=html.match(/<!-- v11\.48 brand distinctness -->([\s\S]*?)<!-- v11\.48 brand distinctness end -->/);
  if(!block){err.push(`brief ${rel}`);continue}
  briefs++;
  const text=strip(block[1]);
  if(briefTexts.has(text))err.push(`duplicate brief ${rel}`);briefTexts.add(text);
  if(!block[1].includes('<h2>브랜드 핵심 해석</h2>'))err.push(`heading ${rel}`);
  const i=(block[1].match(/data-v48-insight="/g)||[]).length;
  if(i!==3)err.push(`insights ${rel}=${i}`);insights+=i;
  const p=(block[1].match(/<span><b>/g)||[]).length;
  if(p!==5)err.push(`profile ${rel}=${p}`);profiles+=p;
  if(!block[1].includes('추천·수익성 점수가 아닙니다'))err.push(`caution ${rel}`);
  if(html.includes('<div class="v39-summary">'))err.push(`legacy summary ${rel}`);
  if(html.includes('<div class="v39-reading">'))err.push(`legacy reading ${rel}`);
  if(html.includes(`<p class="v48-method-link"><a href="/pm-lab/franchise-ssg-preview/methodology/">표본·누락값·매출 해석 기준</a></p>`))methodLinks++;else err.push(`method link ${rel}`);
  for(const key of ['metrics','components','history'])if(!html.includes(`data-v39-table="${key}"`))err.push(`evidence table ${key} ${rel}`);
  if(!positive(b.sales)){
    missingSales++;
    if(!text.includes('가맹점 연간 평균매출은 양수 공개값이 확인되지 않아 0원 매출로 해석하지 않습니다'))err.push(`missing sales ${rel}`);
  }
  if(/\b(?:낮고|높고|적고|많고) \([-+]?\d+(?:\.\d+)?%\)\./.test(text)){awkwardCopy++;err.push(`awkward comparative ${rel}`)}
  if(/샘플 데이터|예시 데이터|합성 데이터/.test(text))err.push(`synthetic ${rel}`);
}
if(briefs!==136||briefTexts.size!==136||insights!==408||profiles!==680||methodLinks!==136||missingSales!==2||awkwardCopy!==0)err.push(`coverage briefs=${briefs} unique=${briefTexts.size} insights=${insights} profiles=${profiles} links=${methodLinks} missing=${missingSales} awkward=${awkwardCopy}`);

for(const r of candidates){const p=r==='/'?path.join(out,'index.html'):fileFor(r);const h=await fs.readFile(p,'utf8');if(/<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/i.test(h))noindex++;else err.push(`noindex ${r}`)}
if(noindex!==184)err.push(`noindex ${noindex}`);

const mega=await fs.readFile(fileFor('/brands/mega-mgc-coffee/'),'utf8');
for(const t of ['메가MGC커피','3,325개','+24.0%','기타','76.4%','많습니다 (+356.1%).'])if(!mega.includes(t))err.push(`mega ${t}`);
const missing=await fs.readFile(fileFor('/brands/666버거/'),'utf8');
if(!missing.includes('data-v48-insight="sales-missing"'))err.push('666 missing sales signal');

if(err.length){console.error(JSON.stringify({v11_48BrandDistinctnessValidation:'FAIL',count:err.length,briefs,uniqueBriefs:briefTexts.size,insights,profiles,methodLinks,missingSales,awkwardCopy,noindex,copyPolishFiles:report.copyPolishFiles,copyPolishPhrases:report.copyPolishPhrases,errors:err.slice(0,200)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_48BrandDistinctnessValidation:'PASS',brands:136,uniqueBriefs:briefTexts.size,insights,profiles,methodLinks,missingSales,awkwardCopy,noindex,candidates:184,copyPolishFiles:report.copyPolishFiles,copyPolishPhrases:report.copyPolishPhrases,genericSummaryRemoved:true,genericReadingRemoved:true,v42VisualLanguagePreserved:true,productionDeployed:false},null,2));
