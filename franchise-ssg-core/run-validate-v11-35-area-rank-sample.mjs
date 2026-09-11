import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-35-area-rank-sample.json'),'utf8'));
const errors=[];
let ranked=0,zeroOrMissing=0;

if(report.uiVersion!=='11.35'||report.schemaVersion!==1)errors.push('report version');
if(!report.policy?.includes('SALES_PER_AREA_RANK_DENOMINATOR_USES_POSITIVE_BENCHMARK_SAMPLE'))errors.push('policy');

for(const b of snap.brands){
  const file=path.join(out,...String(b.route).split('/').filter(Boolean),'index.html');
  const html=await fs.readFile(file,'utf8');
  const sample=Number(b.category?.salesPerAreaSample||0);
  const rank=Number(b.category?.salesPerAreaRank||0);
  const percentile=Number(b.category?.salesPerAreaPercentile);
  const value=Number(b.salesPerArea);
  const m=html.match(/<div class="v35-benchmark" data-v35-benchmark="salesPerArea"[^>]*data-v35-rank-sample="(\d+)" data-v35-rank="(\d+)"[^>]*>\s*<div class="v35-benchmark-head"><span>3\.3㎡매출<\/span><strong>[^<]*<\/strong><em>([^<]*)<\/em>/);
  if(!m){errors.push(`rank block ${b.slug}`);continue}
  const renderedSample=Number(m[1]),renderedRank=Number(m[2]),renderedText=m[3];
  if(renderedSample!==sample)errors.push(`sample ${b.slug} ${renderedSample}/${sample}`);
  const hasRank=Number.isFinite(value)&&value>0&&sample>0&&rank>0&&Number.isFinite(percentile);
  if(hasRank){
    ranked++;
    if(renderedRank!==rank)errors.push(`rank ${b.slug} ${renderedRank}/${rank}`);
    const expected=`${rank}/${sample} · ${percentile.toFixed(0)}%`;
    if(renderedText!==expected)errors.push(`text ${b.slug} ${renderedText}/${expected}`);
  }else{
    zeroOrMissing++;
    if(renderedRank!==0)errors.push(`unranked ${b.slug} ${renderedRank}`);
    if(renderedText!==`n=${sample}`)errors.push(`unranked text ${b.slug} ${renderedText}/n=${sample}`);
  }
}
if(report.patched!==136||report.ranked!==ranked||report.zeroOrMissing!==zeroOrMissing)errors.push(`report totals ${report.patched}/${report.ranked}/${report.zeroOrMissing} vs 136/${ranked}/${zeroOrMissing}`);
if(errors.length){console.error(JSON.stringify({v11_35AreaRankSampleValidation:'FAIL',errorCount:errors.length,errors:errors.slice(0,80)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_35AreaRankSampleValidation:'PASS',brands:136,ranked,zeroOrMissing,rawZeroRetained:true},null,2));
