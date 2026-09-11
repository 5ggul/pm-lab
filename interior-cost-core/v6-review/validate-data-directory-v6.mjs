import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('interior-cost-core/v6-review'),errors=[];
const files={html:path.join(root,'data/index.html'),sourcePage:path.join(root,'sources/index.html'),contract:path.join(root,'data/data-contract.json'),rules:path.join(root,'data/work-match-rules.json'),sources:path.join(root,'data/public-price-sources.json'),index:path.join(root,'data/construction-cost-index.json'),prices:path.join(root,'data/public-unit-prices.json'),quotes:path.join(root,'data/quote-public-segments.json'),search:path.join(root,'assets/search-v6.js')};
for(const [k,p] of Object.entries(files))if(!fs.existsSync(p))errors.push(`missing:${k}`);
if(!errors.length){
  const html=fs.readFileSync(files.html,'utf8'),sourcePage=fs.readFileSync(files.sourcePage,'utf8'),search=fs.readFileSync(files.search,'utf8'),contract=JSON.parse(fs.readFileSync(files.contract,'utf8')),rules=JSON.parse(fs.readFileSync(files.rules,'utf8')),sources=JSON.parse(fs.readFileSync(files.sources,'utf8'));
  for(const token of ['noindex,nofollow','DATA DIRECTORY','인테리어 데이터 모음','construction-cost-index.json','public-unit-prices.json','quote-public-segments.json','work-match-rules.json','data-contract.json','public-price-sources.json','../sources/','공식 출처','5,000행','세그먼트 80건'])if(!html.includes(token))errors.push(`html:${token}`);
  for(const token of ['공식 출처','한국건설기술연구원','공사비원가관리센터','15129415','getStdMarkUprcinfoList','KOSIS','https://cost.kict.re.kr/index.html','https://www.data.go.kr/data/15129415/openapi.do','https://kosis.kr/openapi/'])if(!sourcePage.includes(token))errors.push(`source-page:${token}`);
  if(!search.includes("['데이터 모음','data/']")||!search.includes("['데이터셋','data/']")||!search.includes("['원자료','data/']")||!search.includes("['공식 출처','sources/']")||!search.includes("['KICT','sources/']")||!search.includes("['KOSIS','sources/']"))errors.push('search-routes');
  if(contract.version!=='6.3-review'||contract.production_quality?.orphan_indexable_pages_allowed!==0||contract.production_quality?.minimum_indexable_text_length!==220)errors.push('data-contract-production');
  if(contract.production_quality?.release_manifest?.required!==true||contract.release_policy?.explicit_owner_approval_required!==true||contract.release_policy?.release_modes?.core_only===undefined||contract.release_policy?.release_modes?.full_data===undefined)errors.push('data-contract-release');
  if(contract.release_policy?.preflight_workflows?.public_price_api?.artifact_only!==true||contract.release_policy?.preflight_workflows?.public_price_api?.mutates_repository!==false||contract.release_policy?.preflight_workflows?.production_domain?.artifact_only!==true||contract.release_policy?.preflight_workflows?.production_domain?.deploys!==false)errors.push('data-contract-preflight');
  if(contract.production_quality?.production_base_url?.https_required!==true||contract.production_quality?.production_base_url?.github_pages_preview_forbidden_by_default!==true)errors.push('data-contract-base-url');
  if(contract.public_price_policy?.primary_source_id!=='15129415'||contract.public_price_policy?.minimum_published_rows!==5000||contract.public_price_policy?.maximum_latest_row_age_days!==730)errors.push('data-contract-public-price');
  if(contract.public_price_policy?.live_preflight?.mode!=='artifact_only'||contract.public_price_policy?.live_preflight?.repository_write!==false||contract.public_price_policy?.live_preflight?.production_deploy!==false)errors.push('data-contract-public-price-preflight');
  if(rules.rules_version!=='work-match-v6.1'||rules.standard_work_items?.length!==12||!rules.aliases?.length||!rules.bundles?.length)errors.push('work-match-rules');
  const live=sources.sources?.find(x=>x.public_data_id==='15129415');if(!live||live.status!=='primary_collector_ready'||live.refresh_policy?.minimum_published_rows!==5000)errors.push('source-registry-live');
}
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,route:'/data/',source_route:'/sources/',datasets:6,official_sources:3,standard_work_items:12,data_contract:'6.3-review',release_modes:['blocked_technical','blocked_manual_approval','core_only','full_data'],preflight_workflows:['public_price_api','production_domain'],public_price_source:'15129415',machine_readable_links:true},null,2));
