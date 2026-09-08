import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {CURATED_COMPARE_NAMES} from './content.mjs';
import {brandSlugFor} from './routing-v3.mjs';
import {buildOfficialMergePlan} from './official-merge.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const catalogPath=path.join(repo,'docs/franchise-data-preview/data-final.js');
const officialPath=path.join(repo,'data/franchise/official/brands-2025.json');
const mergedRuntimePath=path.join(here,'.official-merged-data-runtime.js');
const v3SourcePath=path.join(here,'run-generate-v3.mjs');
const v4RuntimePath=path.join(here,'.run-generate-v4-runtime.mjs');

async function loadClassic(file,expr){const code=await fs.readFile(file,'utf8');const context={console};vm.createContext(context);vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,context);return context.__EXPORT__}
const catalog=await loadClassic(catalogPath,'{categories,brands,areas,guides}');
let official={status:'MISSING',records:[],promotion:{allowPreviewOverlay:false}};try{official=JSON.parse(await fs.readFile(officialPath,'utf8'))}catch{}
const criticalBrandNames=[...new Set([...CURATED_COMPARE_NAMES.flat(),...catalog.brands.slice(0,12).map(x=>x.name)])];
const plan=buildOfficialMergePlan({catalogBrands:catalog.brands,officialDoc:official,criticalBrandNames});

if(plan.active){
  const classic=`'use strict';\nconst categories=${JSON.stringify(catalog.categories)};\nconst brands=${JSON.stringify(plan.mergedBrands)};\nconst areas=${JSON.stringify(catalog.areas)};\nconst guides=${JSON.stringify(catalog.guides)};\n`;
  await fs.writeFile(mergedRuntimePath,classic,'utf8');
  process.env.SSG_DATA_FILE=path.relative(repo,mergedRuntimePath).replaceAll('\\','/');
  process.env.SSG_OFFICIAL_MERGE_ACTIVE='1';
}else{
  delete process.env.SSG_DATA_FILE;
  process.env.SSG_OFFICIAL_MERGE_ACTIVE='0';
}

let source=await fs.readFile(v3SourcePath,'utf8');
const baseAnchor="let base=await fs.readFile(baseSourcePath,'utf8');";
const baseInject=`${baseAnchor}\nif(process.env.SSG_DATA_FILE){base=base.replace(\"path.join(repo,'docs/franchise-data-preview/data-final.js')\",\"path.resolve(repo,process.env.SSG_DATA_FILE)\");}`;
if(!source.includes(baseAnchor))throw new Error('run-generate-v3 base source anchor missing');
source=source.replace(baseAnchor,baseInject);
const v2Anchor="let source=await fs.readFile(v2SourcePath,'utf8');";
const v2Inject=`${v2Anchor}\nif(process.env.SSG_DATA_FILE){source=source.replace(\"path.join(repo,'docs/franchise-data-preview/data-final.js')\",\"path.resolve(repo,process.env.SSG_DATA_FILE)\");}`;
if(!source.includes(v2Anchor))throw new Error('run-generate-v3 v2 source anchor missing');
source=source.replace(v2Anchor,v2Inject);
await fs.writeFile(v4RuntimePath,source,'utf8');
try{await import(`${pathToFileURL(v4RuntimePath).href}?run=${Date.now()}`)}finally{await fs.rm(v4RuntimePath,{force:true});await fs.rm(mergedRuntimePath,{force:true})}

await fs.writeFile(path.join(out,'official-match-report.json'),JSON.stringify(plan.report,null,2)+'\n','utf8');
const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.coverage.officialMatchedBrands=plan.report.coverage.matched;
manifest.coverage.officialUnmatchedBrands=plan.report.coverage.unmatched;
manifest.coverage.officialAmbiguousBrands=plan.report.coverage.ambiguous;
manifest.productionGates.officialMetricMergeReady=true;
manifest.productionGates.officialSnapshotReady=plan.report.snapshot.status==='READY'&&plan.report.snapshot.allowPreviewOverlay;
manifest.officialMerge={engineReady:true,active:plan.active,snapshot:plan.report.snapshot,coverage:plan.report.coverage,activationBlockers:plan.report.activationBlockers};
if(plan.active)manifest.dataMode='FTC_OFFICIAL_PREVIEW';
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');

if(plan.active){
  const files=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}await walk(out);
  for(const f of files){let h=await fs.readFile(f,'utf8');h=h.replaceAll('외부 검수용 SSG 프리뷰 · 검색엔진 제외(noindex) · 합성 수치는 정식 공개 전 공식 스냅샷으로 교체','외부 검수용 프리뷰 · 검색엔진 제외(noindex) · 공정거래위원회 공개데이터 매칭값');h=h.replaceAll('비용·점포·매출 숫자는 구조 검수용 예시값입니다. 정식 공개에는 공식 원문·기준연도·확인일이 있는 값만 사용합니다.','표시된 비용·점포·매출 값은 공정거래위원회 공개데이터 스냅샷과 매칭한 값입니다. 기준연도와 출처가 없는 값은 표시하지 않습니다.');h=h.replaceAll('이 SSG 프리뷰의 비용·점포·매출 수치는 화면과 문서 구조 검수용 합성값입니다. 정식 도메인에서는 공정거래위원회 정보공개서·공공데이터 스냅샷 검증을 통과한 값만 색인합니다.','표시된 비용·점포·매출 값은 공정거래위원회 공개데이터 스냅샷과 매칭한 값입니다. 정식 도메인에서는 별도 품질 게이트를 통과한 URL만 색인합니다.');h=h.replaceAll('현재 SSG 프리뷰는 구조 검수용 합성값입니다. 정식 페이지에서는 공식 스냅샷의 기준연도와 수집일을 숫자 바로 옆에 표시합니다.','현재 표시값은 공정거래위원회 공개데이터 스냅샷과 매칭한 값이며 기준연도와 확인일을 함께 표시합니다.');await fs.writeFile(f,h,'utf8')}
  const byName=new Map(plan.matches.map(x=>[x.brand.name,x.record]));
  for(const brand of catalog.brands){const record=byName.get(brand.name);if(!record)continue;const file=path.join(out,'brands',brandSlugFor(brand.name,brand.slug),'index.html');try{let h=await fs.readFile(file,'utf8');const sourceUrl=record.sourceUrl||record.source?.url||'';const checked=String(official.generatedAt||'').slice(0,10);const line=`<p class="updated">공정거래위원회 공개데이터 · ${record.referenceYear||official.referenceYear||''}년 기준${checked?` · 확인 ${checked}`:''}${sourceUrl?` · <a href="${sourceUrl}" target="_blank" rel="noopener">원문 출처</a>`:''}</p>`;h=h.replace(/(<p class="answer">[\s\S]*?<\/p>)/,`$1${line}`);await fs.writeFile(file,h,'utf8')}catch{}}
}

console.log(JSON.stringify({officialMergeEngine:true,active:plan.active,coverage:plan.report.coverage,activationBlockers:plan.report.activationBlockers,dataMode:manifest.dataMode},null,2));
