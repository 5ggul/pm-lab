import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve('interior-cost-core/v6-review');
const priceFile=path.join(root,'data/public-unit-prices.json'),quoteFile=path.join(root,'data/quote-public-segments.json');
const originalPrice=fs.readFileSync(priceFile,'utf8'),originalQuote=fs.readFileSync(quoteFile,'utf8');
const out='/tmp/interior-v6-production-ready',base='https://ready.example.test/',readiness='/tmp/interior-v6-launch-readiness-full-data.json';
const errors=[];
const syntheticPrice={dataset:'공공 공사비 참고단가',data_type:'REFERENCE',schema_version:'1.1',generated_at:'2026-09-11T00:00:00.000Z',status:'ready',source:{provider:'조달청',name:'나라장터 가격정보현황서비스 · 표준시장단가및시장시공가격',public_data_id:'15129415',api_operation:'getStdMarkUprcinfoList',query_start_date:'2025-01-01',query_end_date:'2026-09-11',source_row_count:2,raw_collected_row_count:2,valid_row_count:2,collected_row_count:2,completeness_floor_rows:2,latest_published_date:'2026-08-01',total_cost_method:'재료비단가 + 노무비단가 + 경비단가',license:'이용허락범위 제한 없음',source_url:'https://www.data.go.kr/data/15129415/openapi.do'},fields:['published_date','work_code','name','spec','unit','material_cost_won','labor_cost_won','expense_cost_won','total_cost_won','application_condition'],rows:[{published_date:'2026-08-01',work_code:'A01',name:'도기질 타일 붙임',spec:'벽 300×600',unit:'㎡',material_cost_won:1000,labor_cost_won:2000,expense_cost_won:300,total_cost_won:3300,application_condition:'건축 · 표준시장단가 · 실내'},{published_date:'2026-08-01',work_code:'B02',name:'시멘트 액체방수',spec:'2종',unit:'㎡',material_cost_won:900,labor_cost_won:1500,expense_cost_won:200,total_cost_won:2600,application_condition:'설비 · 시장시공가격 · 욕실'}]};
const syntheticQuote={dataset:'익명 인테리어 견적 공개 집계',data_type:'QUOTE',schema_version:'1.0',generated_at:'2026-09-11T00:00:00.000Z',status:'published_segments_available',minimum_public_sample:80,segments:[{segment_key:'서울|32-34|전체|욕실2|샷시제외|VAT포함|폐기물포함',conditions:{region:'서울',area_band:'32-34',scope:'전체',bathrooms:2,windows:'exclude',vat:'included',waste:'included'},sample_count:84,p25:4800,median:5300,p75:5900,work_items:[]}]};
function run(script,extra={}){const r=spawnSync(process.execPath,[script],{cwd:process.cwd(),encoding:'utf8',env:{...process.env,BASE_URL:base,OUT_DIR:out,PPS_MIN_PUBLISHED_ROWS:'2',...extra}});if(r.status!==0)throw new Error(`${script} failed\n${r.stdout}\n${r.stderr}`);return r.stdout}
function has(rel,text){const file=path.join(out,rel);return fs.existsSync(file)&&fs.readFileSync(file,'utf8').includes(text)}
try{
  fs.writeFileSync(priceFile,JSON.stringify(syntheticPrice,null,2)+'\n');fs.writeFileSync(quoteFile,JSON.stringify(syntheticQuote,null,2)+'\n');
  run('interior-cost-core/build-production-v6.mjs');run('interior-cost-core/inject-production-trust-v6.mjs');run('interior-cost-core/validate-production-v6.mjs');
  for(const rel of ['reference-prices/index.html','statistics/index.html']){if(has(rel,'content="noindex,nofollow"'))errors.push(`still-noindex:${rel}`);if(!has(rel,'"@type":"Dataset"'))errors.push(`dataset-schema:${rel}`)}
  const sitemap=fs.readFileSync(path.join(out,'sitemap.xml'),'utf8');for(const u of [new URL('reference-prices/',base).href,new URL('statistics/',base).href])if(!sitemap.includes(u))errors.push(`sitemap:${u}`);
  const catalog=JSON.parse(fs.readFileSync(path.join(out,'data/catalog.json'),'utf8')),byId=Object.fromEntries(catalog.datasets.map(x=>[x.id,x]));if(byId['public-unit-prices']?.indexable!==true)errors.push('catalog-public-not-ready');if(byId['quote-public-segments']?.indexable!==true)errors.push('catalog-quote-not-ready');
  const llms=fs.readFileSync(path.join(out,'llms.txt'),'utf8');if(!llms.includes('/data/public-unit-prices.json'))errors.push('llms-public-missing');if(!llms.includes('/data/quote-public-segments.json'))errors.push('llms-quote-missing');
  run('interior-cost-core/build-launch-readiness-v6.mjs',{OWNER_APPROVED:'true',PRODUCTION_VALIDATED:'true',READINESS_OUT:readiness,MIN_INDEXABLE_PAGES:'35'});
  const report=JSON.parse(fs.readFileSync(readiness,'utf8'));
  if(report.summary?.core_technical_ready!==true)errors.push('readiness-core');
  if(report.summary?.owner_approved!==true)errors.push('readiness-owner');
  if(report.summary?.deploy_ready!==true)errors.push('readiness-deploy');
  if(report.summary?.full_data_ready!==true)errors.push('readiness-full-data');
  if(report.summary?.recommended_release_mode!=='full_data')errors.push(`readiness-mode:${report.summary?.recommended_release_mode}`);
  if(report.critical_blockers?.length)errors.push('readiness-critical-blockers');
}finally{fs.writeFileSync(priceFile,originalPrice);fs.writeFileSync(quoteFile,originalQuote)}
if(fs.readFileSync(priceFile,'utf8')!==originalPrice||fs.readFileSync(quoteFile,'utf8')!==originalQuote)errors.push('source-restore-failed');
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,synthetic_only:true,source_files_restored:true,public_price_transition:'noindex->index',quote_statistics_transition:'noindex->index',dataset_schema:true,sitemap_reentry:true,catalog_reentry:true,llms_reentry:true,launch_readiness:{owner_approved:true,deploy_ready:true,full_data_ready:true,release_mode:'full_data'}},null,2));
