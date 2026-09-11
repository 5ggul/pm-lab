import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('interior-cost-core/v6-review');
const errors=[];
const files={
  html:path.join(root,'statistics/index.html'),
  js:path.join(root,'assets/statistics-v6.js'),
  css:path.join(root,'assets/statistics-v6.css'),
  data:path.join(root,'data/quote-public-segments.json'),
  search:path.join(root,'assets/search-v6.js')
};
for(const [k,p] of Object.entries(files))if(!fs.existsSync(p))errors.push(`missing:${k}`);
if(!errors.length){
  const html=fs.readFileSync(files.html,'utf8'),js=fs.readFileSync(files.js,'utf8'),css=fs.readFileSync(files.css,'utf8'),search=fs.readFileSync(files.search,'utf8'),data=JSON.parse(fs.readFileSync(files.data,'utf8'));
  for(const token of ['noindex,nofollow','data-statistics-explorer','인테리어 견적 통계','data-total-range','data-work-distribution','data-work-table','data-user-total','data-copy-stat-url','다른 조건의 표본을 섞어 대신 표시하지 않습니다','적정가·권장가·시장 전체 평균을 의미하지 않습니다'])if(!html.includes(token))errors.push(`html:${token}`);
  const filters=[...html.matchAll(/data-stat-filter="([^"]+)"/g)].map(x=>x[1]);
  const expected=['region_level1','pyeong_band','scope','bathroom_count','window_status','vat_status','waste_status'];
  if(filters.length!==7||expected.some(k=>!filters.includes(k)))errors.push(`filters:${filters.join(',')}`);
  for(const token of ["const FIELDS=['region_level1','pyeong_band','scope','bathroom_count','window_status','vat_status','waste_status']","FIELDS.every(k=>String(a[k]??'')===String(b?.[k]??''))","minimum_public_sample:80","quote-public-segments.json","Number(s.sample_count)>=min","history.replaceState","shareUrl()","data-stat-filter","data-work-distribution"])if(!js.includes(token))errors.push(`js:${token}`);
  if(/searchParams\.set\([^\n)]*total/i.test(js))errors.push('share-url-leaks-user-total');
  if(/nearest|closest|approximate|fallback segment/i.test(js))errors.push('approximate-segment-fallback');
  if(/@keyframes|animation\s*:|transition\s*:/i.test(css))errors.push('statistics-animation');
  if(!search.includes("['견적 통계','statistics/']")||!search.includes("['시장 통계','statistics/']"))errors.push('search-route');
  if(Number(data.minimum_public_sample)!==80)errors.push(`data-threshold:${data.minimum_public_sample}`);
  if(!Array.isArray(data.segments))errors.push('data-segments');
  for(const segment of data.segments||[]){
    if(Number(segment.sample_count)<80)errors.push(`segment-below-80:${segment.key||'unknown'}`);
    for(const [name,stats] of Object.entries(segment.work_items||{}))if(Number(stats.sample_count)<80)errors.push(`item-below-80:${name}`);
  }
  const exact=(wanted,dimensions)=>expected.every(k=>String(wanted[k]??'')===String(dimensions[k]??''));
  const base={region_level1:'서울',pyeong_band:'30-34평',scope:'전체',bathroom_count:'2',window_status:'excluded',vat_status:'included',waste_status:'included'};
  if(!exact(base,{...base}))errors.push('exact-match-self');
  for(const key of expected){const changed={...base,[key]:base[key]+'-other'};if(exact(base,changed))errors.push(`partial-match:${key}`)}
}
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,route:'/statistics/',filters:7,match:'exact_all_dimensions',minimum_public_sample:80,work_item_minimum:80,user_total_in_share_url:false,animation:false,no_approximate_fallback:true},null,2));
