import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
if(snap.brand_count!==136)throw new Error(`unexpected brand count ${snap.brand_count}`);

let patched=0,ranked=0,zeroOrMissing=0;
for(const b of snap.brands){
  const file=path.join(out,...String(b.route).split('/').filter(Boolean),'index.html');
  let html=await fs.readFile(file,'utf8');
  const sample=Number(b.category?.salesPerAreaSample||0);
  const rank=Number(b.category?.salesPerAreaRank||0);
  const percentile=Number(b.category?.salesPerAreaPercentile);
  const value=Number(b.salesPerArea);
  const re=/(<div class="v35-benchmark" data-v35-benchmark="salesPerArea"[^>]*)(>\s*<div class="v35-benchmark-head"><span>3\.3㎡매출<\/span><strong>[^<]*<\/strong><em>)([^<]*)(<\/em>)/;
  if(!re.test(html))throw new Error(`salesPerArea benchmark missing ${b.slug}`);
  const hasRank=Number.isFinite(value)&&value>0&&sample>0&&rank>0&&Number.isFinite(percentile);
  const text=hasRank?`${rank}/${sample} · ${percentile.toFixed(0)}%`:`n=${sample}`;
  const next=html.replace(re,(m,open,head,old,close)=>`${open} data-v35-rank-sample="${sample}" data-v35-rank="${hasRank?rank:0}"${head}${text}${close}`);
  if(next!==html){await fs.writeFile(file,next,'utf8');patched++}
  if(hasRank)ranked++;else zeroOrMissing++;
}

const report={schemaVersion:1,uiVersion:'11.35',patched,ranked,zeroOrMissing,policy:'SALES_PER_AREA_RANK_DENOMINATOR_USES_POSITIVE_BENCHMARK_SAMPLE;RAW_ZERO_RETAINED'};
await fs.writeFile(path.join(out,'v11-35-area-rank-sample.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_35AreaRankSample:'PASS',...report},null,2));
