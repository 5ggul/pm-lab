import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const source25=path.join(here,'run-generate-v11-25-final.mjs');
const temp25=path.join(here,`.tmp-v11-25-sales-safe-${process.pid}.mjs`);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const norm=r=>r==='/'?'/':`/${String(r||'').split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`;
const fileFor=r=>path.join(out,...norm(r).split('/').filter(Boolean),'index.html');

function replaceOnce(src,from,to,label){
  const count=src.split(from).length-1;
  if(count!==1)throw new Error(`v11.37 transform ${label}: expected 1 match, got ${count}`);
  return src.replace(from,to);
}

let src=await fs.readFile(source25,'utf8');
src=replaceOnce(
  src,
  "const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));",
  "const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));\nconst positive=v=>finite(v)&&Number(v)>0;",
  'positive helper'
);
src=replaceOnce(
  src,
  "function rank(rows,key,value,desc=false){const a=rows.map(x=>x[key]).filter(finite).map(Number).sort((a,b)=>desc?b-a:a-b);return a.indexOf(Number(value))+1}",
  "function rank(rows,key,value,desc=false){if(!finite(value))return null;const a=rows.map(x=>x[key]).filter(finite).map(Number).sort((a,b)=>desc?b-a:a-b),i=a.indexOf(Number(value));return i<0?null:i+1}",
  'null-safe rank'
);
src=replaceOnce(
  src,
  "function percentile(rows,key,value){const a=rows.map(x=>x[key]).filter(finite).map(Number).sort((a,b)=>a-b);if(a.length<2)return 50;const below=a.filter(v=>v<Number(value)).length,equal=a.filter(v=>v===Number(value)).length;return (below+(equal-1)/2)/(a.length-1)*100}",
  "function percentile(rows,key,value){if(!finite(value))return null;const a=rows.map(x=>x[key]).filter(finite).map(Number).sort((a,b)=>a-b);if(a.length<2)return 50;const below=a.filter(v=>v<Number(value)).length,equal=a.filter(v=>v===Number(value)).length;return (below+(equal-1)/2)/(a.length-1)*100}",
  'null-safe percentile'
);
src=replaceOnce(
  src,
  "sales:+x.metrics.sales,growth,history:h,components:",
  "sales:positive(x.metrics.sales)?+x.metrics.sales:null,growth,history:h,components:",
  'average sales zero semantics'
);

await fs.writeFile(temp25,src,'utf8');
try{
  await import(`${pathToFileURL(temp25).href}?v1137=${Date.now()}`);
}finally{
  await fs.rm(temp25,{force:true});
}

const downstream=[
  'run-fix-v11-25-brand-top.mjs',
  'run-enhance-v11-25-benchmarks-compare.mjs',
  'run-generate-v11-26-final.mjs',
  'run-enhance-v11-26-core-surfaces.mjs',
  'run-polish-v11-26-seo-floor.mjs',
  'run-polish-v11-27-visual-qa.mjs',
  'run-polish-v11-28-screen-diet.mjs',
  'run-generate-v11-29-budget-category-matrix.mjs',
  'run-generate-v11-30-category-metric-table.mjs',
  'run-generate-v11-31-ranking-ux.mjs',
  'run-generate-v11-32-category-rankings.mjs',
  'run-generate-v11-33-category-distribution.mjs',
  'run-generate-v11-34-compare-workspace.mjs',
  'run-generate-v11-35-brand-detail.mjs',
  'run-fix-v11-35-area-rank-sample.mjs',
  'run-enhance-v11-35-seo-depth.mjs',
  'run-prep-v11-36-startup-boundary.mjs',
  'run-generate-v11-36-startup-workspace.mjs'
];
for(const name of downstream){
  await import(`${pathToFileURL(path.join(here,name)).href}?v1137=${Date.now()}-${name}`);
}

const snapPath=path.join(out,'data-snapshot-v11-26.json');
const snap=JSON.parse(await fs.readFile(snapPath,'utf8'));
if(snap.brand_count!==136||snap.category_count!==20)throw new Error(`v11.37 baseline ${snap.brand_count}/${snap.category_count}`);
const unavailable=snap.brands.filter(b=>!positive(b.sales));
const nonPositive=snap.brands.filter(b=>finite(b.sales)&&Number(b.sales)<=0);
if(nonPositive.length)throw new Error(`v11.37 non-positive average sales survived: ${nonPositive.map(b=>b.slug).join(',')}`);

let denominatorFixes=0;
for(const b of snap.brands){
  const c=snap.categories?.[b.categorySlug];
  if(!c)continue;
  const expectedPositive=snap.brands.filter(x=>x.categorySlug===b.categorySlug&&positive(x.sales)).length;
  if(c.sales?.count!==expectedPositive)throw new Error(`v11.37 sales sample mismatch ${b.categorySlug}: ${c.sales?.count}/${expectedPositive}`);
  if(c.sales?.count&&(!positive(c.sales.min)||!positive(c.sales.max)))throw new Error(`v11.37 non-positive category sales bound ${b.categorySlug}`);
  if(!finite(b.category?.salesRank)||!finite(b.category?.salesPercentile)||c.sales.count===b.category?.count)continue;
  const file=fileFor(b.route);
  let html=await fs.readFile(file,'utf8');
  const pct=Number(b.category.salesPercentile).toFixed(0);
  const oldText=`${b.category.salesRank}/${b.category.count} · ${pct}%`;
  const newText=`${b.category.salesRank}/${c.sales.count} · ${pct}%`;
  if(html.includes(oldText)){
    html=html.replace(oldText,newText);
    await fs.writeFile(file,html,'utf8');
    denominatorFixes++;
  }
}

snap.policy=String(snap.policy||'').split(';').filter(Boolean).filter(x=>x!=='AVERAGE_SALES_POSITIVE_ONLY').concat('AVERAGE_SALES_POSITIVE_ONLY').join(';');
snap.metrics={...(snap.metrics||{}),sales:{label:'평균매출',basis:'가맹점 연간 평균매출 공개값',unit:'만원/연',missingRule:'non-positive public API values are treated as unavailable for average-sales comparison',benchmark:'positive public values only'}};
await fs.writeFile(snapPath,JSON.stringify(snap,null,2),'utf8');

const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.37';
manifest.v11_37={averageSalesPositiveOnly:true,brandCount:snap.brand_count,categoryCount:snap.category_count,unavailableAverageSales:unavailable.length,metricSpecificSampleDenominators:true,candidateSetChanged:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const report={schemaVersion:1,uiVersion:'11.37',generatedAt:new Date().toISOString(),snapshot:snap.snapshot_id,brandCount:snap.brand_count,categoryCount:snap.category_count,unavailableAverageSales:unavailable.map(b=>({name:b.name,slug:b.slug,category:b.categorySlug})),denominatorFixes,semantics:{averageSales:'positive-only; zero/non-positive is unavailable',salesPerArea:'raw zero retained; positive-only benchmark',costComponents:'zero retained as published value',storeEvents:'zero retained as valid event count'},productionDeployed:false};
await fs.writeFile(path.join(out,'v11-37-sales-semantics.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_37:'PASS',unavailableAverageSales:unavailable.length,denominatorFixes,snapshot:snap.snapshot_id},null,2));
