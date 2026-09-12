import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const norm=r=>r==='/'?'/':`/${String(r||'').split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`;
const fileFor=r=>path.join(out,...norm(r).split('/').filter(Boolean),'index.html');
const safe=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const datasetRe=/<script type="application\/ld\+json" data-v11-dataset>([\s\S]*?)<\/script>/;

const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
let structuredDataFixes=0;
let unavailableMetricsRemoved=0;
let rankDenominatorsFixed=0;

for(const b of snap.brands){
  const file=fileFor(b.route);
  let html=await fs.readFile(file,'utf8');
  const m=html.match(datasetRe);
  if(!m)throw new Error(`v11.37 Dataset JSON-LD missing: ${b.slug}`);

  let data;
  try{data=JSON.parse(m[1])}catch(e){throw new Error(`v11.37 Dataset JSON-LD parse failed ${b.slug}: ${e.message}`)}
  if(!Array.isArray(data.variableMeasured))throw new Error(`v11.37 variableMeasured missing: ${b.slug}`);

  const c=snap.categories?.[b.categorySlug];
  if(!c)throw new Error(`v11.37 category missing for ${b.slug}`);
  const before=JSON.stringify(data.variableMeasured);
  const next=[];

  for(const metric of data.variableMeasured){
    const name=String(metric?.name||'');
    if(name==='평균매출 공개지표'){
      if(!positive(b.sales)){
        unavailableMetricsRemoved++;
        continue;
      }
      next.push({...metric,value:Number(b.sales)});
      continue;
    }
    if(name.includes('평균매출 공개지표 높은 순 위치')){
      if(!positive(b.sales)||!finite(b.category?.salesRank)){
        unavailableMetricsRemoved++;
        continue;
      }
      next.push({...metric,value:Number(b.category.salesRank),unitText:`${c.sales.count}개 공개값 중 순위`});
      rankDenominatorsFixed++;
      continue;
    }
    next.push(metric);
  }

  data.variableMeasured=next;
  if(!positive(b.sales)&&typeof data.description==='string'){
    data.description=data.description.replace('평균매출 공개지표와','평균매출 공개 여부와');
  }
  const after=JSON.stringify(data.variableMeasured);
  if(before!==after||m[1]!==safe(data)){
    html=html.replace(datasetRe,`<script type="application/ld+json" data-v11-dataset>${safe(data)}</script>`);
    await fs.writeFile(file,html,'utf8');
    structuredDataFixes++;
  }
}

const reportPath=path.join(out,'v11-37-sales-semantics.json');
const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
report.structuredDataFixes=structuredDataFixes;
report.unavailableStructuredSalesMetricsRemoved=unavailableMetricsRemoved;
report.structuredSalesRankDenominatorsFixed=rankDenominatorsFixed;
report.structuredDataPolicy='AVERAGE_SALES_ZERO_NEVER_EMITTED_AS_MEASURED_ZERO;RANK_DENOMINATOR_USES_METRIC_SAMPLE';
await fs.writeFile(reportPath,JSON.stringify(report,null,2),'utf8');

const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.v11_37={...(manifest.v11_37||{}),structuredDataSalesSemantics:true};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

console.log(JSON.stringify({v11_37StructuredSales:'PASS',structuredDataFixes,unavailableMetricsRemoved,rankDenominatorsFixed},null,2));
