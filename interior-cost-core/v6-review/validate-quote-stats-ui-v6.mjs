import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('interior-cost-core/v6-review'),errors=[];
const files=['assets/quote-stats-v6.js','assets/quote-stats-v6.css','assets/search-v6.js','data/quote-public-segments.json','data/quote-statistics.json','index.html'];
for(const f of files)if(!fs.existsSync(path.join(root,f)))errors.push(`missing:${f}`);
const js=fs.readFileSync(path.join(root,'assets/quote-stats-v6.js'),'utf8'),css=fs.readFileSync(path.join(root,'assets/quote-stats-v6.css'),'utf8'),search=fs.readFileSync(path.join(root,'assets/search-v6.js'),'utf8'),pub=JSON.parse(fs.readFileSync(path.join(root,'data/quote-public-segments.json'),'utf8')),meta=JSON.parse(fs.readFileSync(path.join(root,'data/quote-statistics.json'),'utf8'));
for(const t of ['quote-public-segments.json','region_level1','pyeong_band','bathroom_count','window_status','vat_status','waste_status','data-market-range','data-market-conditions','minimum_public_sample','P25','중앙값','P75','적정가 판정이 아닙니다'])if(!js.includes(t))errors.push(`stats-js:${t}`);
for(const t of ['bathrooms','vat-condition','waste-condition','quote-stats-v6.css'])if(!js.includes(t))errors.push(`stats-filter:${t}`);
if(!search.includes('quote-stats-v6.js')||!search.includes('v6QuoteStatsLoader'))errors.push('stats-loader');
for(const t of ['.market-range-svg','.market-range-labels','.market-conditions'])if(!css.includes(t))errors.push(`stats-css:${t}`);
if(pub.segments.length!==0||pub.status!=='no_public_segment'||pub.minimum_public_sample!==80)errors.push('public-placeholder-not-locked');
if(meta.sample_count!==0||meta.statistics_visible!==false||meta.minimum_public_sample!==80)errors.push('statistics-meta-not-locked');
if(!String(meta.segment_rule||'').includes('욕실')||!String(meta.segment_rule||'').includes('VAT')||!String(meta.segment_rule||'').includes('폐기물'))errors.push('segment-rule-incomplete');
if(/const\s+(?:p25|median|p75)\s*=\s*\d+/i.test(js))errors.push('hardcoded-market-stat');
if(js.includes('Math.random('))errors.push('random-market-stat');
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,public_segments:0,market_ui:'locked-until-exact-segment',conditions:7,threshold:80,range:'P25/median/P75 + user point',hardcoded_market_numbers:false},null,2));
