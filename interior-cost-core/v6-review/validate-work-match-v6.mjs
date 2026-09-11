import fs from 'node:fs';
import path from 'node:path';
import {matchLine,matchLines,matchPublicRows,parseLineFlags} from './assets/work-match-v6.js';

const root=path.resolve('interior-cost-core/v6-review'),errors=[];
const files={html:path.join(root,'work-match/index.html'),js:path.join(root,'assets/work-match-v6.js'),css:path.join(root,'assets/work-match-v6.css'),rules:path.join(root,'data/work-match-rules.json'),prices:path.join(root,'data/public-unit-prices.json'),search:path.join(root,'assets/search-v6.js'),standards:path.join(root,'standards/index.html')};
for(const [k,p] of Object.entries(files))if(!fs.existsSync(p))errors.push(`missing:${k}`);
if(!errors.length){
  const html=fs.readFileSync(files.html,'utf8'),js=fs.readFileSync(files.js,'utf8'),css=fs.readFileSync(files.css,'utf8'),search=fs.readFileSync(files.search,'utf8'),standards=fs.readFileSync(files.standards,'utf8'),rules=JSON.parse(fs.readFileSync(files.rules,'utf8')),prices=JSON.parse(fs.readFileSync(files.prices,'utf8'));
  for(const token of ['noindex,nofollow','data-work-match','견적 문구 공종 매칭','자동 확정하지 않으며','1식 금액을 세부 항목에 임의 배분하지 않습니다','data-match-input','data-match-results','data-match-confirmed','공공단가 검색어'])if(!html.includes(token))errors.push(`html:${token}`);
  for(const token of ['matchLine','matchLines','matchPublicRows','parseLineFlags','confirmed:false','work-match-rules.json','public-unit-prices.json'])if(!js.includes(token))errors.push(`js:${token}`);
  if(/localStorage|sessionStorage/.test(js))errors.push('matcher-persistent-storage');
  if(/@keyframes|animation\s*:|transition\s*:/i.test(css))errors.push('matcher-animation');
  const expected=['철거','폐기물','방수','욕실','주방','도배','바닥','목공','전기','창호','현장관리비','VAT'];
  if(JSON.stringify(rules.standard_work_items)!==JSON.stringify(expected))errors.push('standard-work-items');
  if(rules.data_type!=='REFERENCE'||rules.rules_version!=='work-match-v6.1')errors.push('rules-contract');
  if(!rules.bundles?.some(x=>x.id==='bathroom-set')||!rules.bundles?.some(x=>x.id==='kitchen-set')||!rules.bundles?.some(x=>x.id==='window-set'))errors.push('bundle-rules');
  const rulesText=JSON.stringify(rules);if(/amount_manwon|total_cost_won|price_won|unit_price/i.test(rulesText))errors.push('rules-contain-price');
  const bath=matchLine('욕실공사 1식',rules),bathLabels=bath.candidates.map(x=>x.label),bathWorks=new Set(bath.candidates.map(x=>x.standard_work));
  for(const label of ['욕실 철거','욕실 방수','욕실 타일','위생도기','수전','천장·환풍기','배관'])if(!bathLabels.includes(label))errors.push(`bath-bundle:${label}`);
  for(const work of ['철거','방수','욕실'])if(!bathWorks.has(work))errors.push(`bath-work:${work}`);
  if(bath.candidates.some(x=>x.confirmed!==false))errors.push('auto-confirmed-candidate');
  const mix=matchLine('도배 + 장판',rules),mixWorks=new Set(mix.candidates.map(x=>x.standard_work));if(!mixWorks.has('도배')||!mixWorks.has('바닥'))errors.push('multi-work-match');
  const electric=matchLine('콘센트 증설 10개',rules);if(!electric.candidates.some(x=>x.standard_work==='전기'))errors.push('electric-match');if(parseLineFlags('콘센트 증설 10개').quantity!=='10 개')errors.push('quantity-parse');
  const tile=matchLine('타일',rules);if(!tile.candidates.some(x=>x.standard_work==='욕실')||!tile.candidates.some(x=>x.standard_work==='바닥')||!tile.candidates.every(x=>x.certainty==='ambiguous'))errors.push('ambiguous-tile');
  if(matchLines('욕실공사 1식\n도배 + 장판',rules).length!==2)errors.push('multi-line');
  const sampleRows=[{work_code:'A01',name:'도기질 타일 붙임',spec:'벽 300×600',application_condition:'실내',unit:'㎡',total_cost_won:12000},{work_code:'B02',name:'시멘트 액체방수',spec:'2종',application_condition:'욕실',unit:'㎡',total_cost_won:9000},{work_code:'E03',name:'전선관 배선',spec:'16mm',application_condition:'전기',unit:'m',total_cost_won:3000}];
  const tileCandidate=bath.candidates.find(x=>x.label==='욕실 타일');if(matchPublicRows(sampleRows,tileCandidate,5)[0]?.work_code!=='A01')errors.push('public-row-match');
  if(prices.status!=='source_not_collected'||prices.rows.length!==0)errors.push('review-price-data-must-remain-empty');
  if(!search.includes("['공종 매칭','work-match/']")||!search.includes("['1식 분해','work-match/']"))errors.push('search-route');
  if(!standards.includes('../work-match/')||!standards.includes('공종 매칭기'))errors.push('standards-link');
}
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,route:'/work-match/',standard_work_items:12,auto_confirm:false,persistent_storage:false,bathroom_bundle:true,kitchen_bundle:true,window_bundle:true,ambiguous_tile_kept:true,price_rules:false,official_rows_in_review:0},null,2));
