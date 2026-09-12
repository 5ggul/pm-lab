import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const norm=r=>r==='/'?'/':`/${String(r||'').split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`;
const fileFor=r=>path.join(out,...norm(r).split('/').filter(Boolean),'index.html');
const datasetRe=/<script type="application\/ld\+json" data-v11-dataset>([\s\S]*?)<\/script>/;
const err=[];

const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-37-sales-semantics.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];

if(snap.brand_count!==136||report.brandCount!==136)err.push(`brand count ${snap.brand_count}/${report.brandCount}`);
if(snap.category_count!==20||report.categoryCount!==20)err.push(`category count ${snap.category_count}/${report.categoryCount}`);
if(candidates.length!==184)err.push(`candidate count ${candidates.length}`);
if(manifest.uiVersion!=='11.37'||manifest.v11_37?.averageSalesPositiveOnly!==true)err.push('manifest v11.37');
if(manifest.v11_37?.structuredDataSalesSemantics!==true)err.push('manifest structured sales semantics');
if(!String(snap.policy||'').includes('AVERAGE_SALES_POSITIVE_ONLY'))err.push('snapshot policy');
if(!Number.isFinite(Number(report.structuredDataFixes))||Number(report.structuredDataFixes)<1)err.push('structured data fix report');

const nonPositive=snap.brands.filter(b=>finite(b.sales)&&Number(b.sales)<=0);
if(nonPositive.length)err.push(`non-positive average sales ${nonPositive.map(b=>b.slug).join(',')}`);
const unavailable=snap.brands.filter(b=>!positive(b.sales));
if(report.unavailableAverageSales?.length!==unavailable.length)err.push(`unavailable report ${report.unavailableAverageSales?.length}/${unavailable.length}`);

for(const [slug,c] of Object.entries(snap.categories||{})){
  const rows=snap.brands.filter(b=>b.categorySlug===slug);
  const positives=rows.filter(b=>positive(b.sales));
  if(c.sales?.count!==positives.length)err.push(`sales sample ${slug} ${c.sales?.count}/${positives.length}`);
  if(positives.length&&(!positive(c.sales?.min)||!positive(c.sales?.max)))err.push(`sales bounds ${slug}`);
  if(c.sales?.count>c.count)err.push(`sales sample over total ${slug}`);
}

for(const b of snap.brands){
  const h=await fs.readFile(fileFor(b.route),'utf8');
  const c=snap.categories[b.categorySlug];
  if(!positive(b.sales)){
    if(!h.includes('data-v35-kpi="sales" data-v35-value="null"'))err.push(`null sales kpi ${b.slug}`);
    if(!h.includes('data-v35-benchmark="sales" data-v35-value="null"'))err.push(`null sales benchmark ${b.slug}`);
  }else if(finite(b.category?.salesRank)&&c?.sales?.count){
    const pct=Number(b.category.salesPercentile).toFixed(0);
    const expected=`${b.category.salesRank}/${c.sales.count} · ${pct}%`;
    if(!h.includes(expected))err.push(`sales denominator ${b.slug} expected ${expected}`);
  }

  const dm=h.match(datasetRe);
  if(!dm){
    err.push(`dataset jsonld ${b.slug}`);
    continue;
  }
  let data;
  try{data=JSON.parse(dm[1])}catch(e){err.push(`dataset parse ${b.slug}: ${e.message}`);continue}
  const measured=Array.isArray(data.variableMeasured)?data.variableMeasured:[];
  const salesMetric=measured.find(x=>String(x?.name||'')==='평균매출 공개지표');
  const rankMetric=measured.find(x=>String(x?.name||'').includes('평균매출 공개지표 높은 순 위치'));
  if(!positive(b.sales)){
    if(salesMetric)err.push(`structured zero/missing sales leaked ${b.slug}`);
    if(rankMetric)err.push(`structured missing sales rank leaked ${b.slug}`);
  }else{
    if(!salesMetric||Number(salesMetric.value)!==Number(b.sales))err.push(`structured sales value ${b.slug}`);
    if(finite(b.category?.salesRank)&&c?.sales?.count){
      if(!rankMetric||Number(rankMetric.value)!==Number(b.category.salesRank))err.push(`structured sales rank ${b.slug}`);
      if(rankMetric?.unitText!==`${c.sales.count}개 공개값 중 순위`)err.push(`structured sales denominator ${b.slug}`);
    }
  }
}

const startup=await fs.readFile(fileFor('/tools/startup-cost/'),'utf8');
if(!startup.includes('data-v36-startdata'))err.push('startup data payload');
if(/"sales":0(?:[,}])/g.test(startup))err.push('startup leaked zero average sales');
if(!startup.includes('누락값을 0으로 바꾸지 않습니다'))err.push('startup missing-value method');

if(err.length){
  console.error(JSON.stringify({v11_37Validation:'FAIL',count:err.length,errors:err.slice(0,160)},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_37Validation:'PASS',brands:snap.brand_count,categories:snap.category_count,candidates:candidates.length,unavailableAverageSales:unavailable.length,denominatorFixes:report.denominatorFixes,structuredDataFixes:report.structuredDataFixes},null,2));
