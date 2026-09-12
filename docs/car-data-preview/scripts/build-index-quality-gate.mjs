import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {pageUrl,siteConfig} from './site-config.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const pages=[];
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(entry.isDirectory()&&['assets','data','scripts'].includes(entry.name))continue;
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())walk(file);else if(entry.name.endsWith('.html'))pages.push(file);
 }
}
walk(root);

const count=(html,re)=>[...html.matchAll(re)].length;
const decode=s=>String(s||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const text=html=>decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<!--([\s\S]*?)-->/g,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const tagText=(html,tag)=>decode(html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))?.[1]?.replace(/<[^>]+>/g,' ')||'').replace(/\s+/g,' ').trim();
const hasSchema=(html,type)=>[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].some(m=>{try{return JSON.stringify(JSON.parse(m[1])).includes(`"@type":"${type}"`)}catch{return false}});
const check=(name,pass,actual)=>({name,pass:Boolean(pass),...(actual===undefined?{}:{actual})});

function classify(rel){
 if(rel==='index.html')return 'home';
 if(rel==='cars/index.html')return 'catalog';
 if(['cars/hyundai/index.html','cars/kia/index.html','cars/genesis/index.html'].includes(rel))return 'manufacturer_hub';
 if(rel==='cars/models/index.html')return 'vehicle_directory';
 if(/^cars\/[^/]+\/[^/]+\/index\.html$/.test(rel))return 'vehicle';
 if(/^cars\/[^/]+\/[^/]+\/.+\/index\.html$/.test(rel))return 'vehicle_spec';
 if(rel==='compare/index.html')return 'comparison_hub';
 if(/^compare\/[^/]+\/index\.html$/.test(rel))return 'comparison';
 if(rel==='rankings/index.html')return 'ranking_hub';
 if(/^rankings\/[^/]+\/index\.html$/.test(rel))return 'ranking';
 if(rel==='tools/index.html')return 'tool_hub';
 if(/^tools\/[^/]+\/index\.html$/.test(rel))return 'tool';
 if(rel==='guide/index.html')return 'guide_hub';
 if(/^guide\/[^/]+\/index\.html$/.test(rel))return 'guide';
 if(rel==='recalls/index.html')return 'recall_hub';
 if(/^recalls\/[^/]+\/index\.html$/.test(rel))return 'recall';
 return 'information';
}
function holdReason(rel){
 if(rel==='404.html'||rel==='qa.html'||rel.startsWith('qa/')||rel.startsWith('search/')||rel.startsWith('cars/family/')||rel.startsWith('cars/record/'))return 'Internal or query-based route';
 if(['cars/hyundai/grandeur-gn7/3-5/index.html','cars/hyundai/grandeur-gn7/3-5/automobile-tax/index.html','cars/hyundai/grandeur-gn7/compare/index.html'].includes(rel))return 'Navigation-only compatibility route';
 return null;
}

const forbidden=['준비 중','검수상태','검수 상태','숫자를 읽는 기준','갈립니다','대표 답변','공식 데이터명 +','공식 데이터이','과거 데이터으로','기준으로차'];
const reports=[];
for(const file of pages){
 const rel=path.relative(root,file).replaceAll('\\','/'),html=fs.readFileSync(file,'utf8'),visible=text(html),kind=classify(rel),hold=holdReason(rel),checks=[];
 const redirect=/<meta\b[^>]*http-equiv="refresh"/i.test(html);
 const title=tagText(html,'title'),h1=tagText(html,'h1'),description=decode(html.match(/<meta\b[^>]*name="description"[^>]*content="([^"]+)"[^>]*>/i)?.[1]||'').trim();
 checks.push(check('one_title',count(html,/<title\b[^>]*>/gi)===1,count(html,/<title\b[^>]*>/gi)));
 checks.push(check('one_h1',count(html,/<h1\b[^>]*>/gi)===1,count(html,/<h1\b[^>]*>/gi)));
 checks.push(check('meta_description',description.length>=25,description.length));
 checks.push(check('canonical',count(html,/<link\b[^>]*rel="canonical"[^>]*>/gi)===1&&html.includes(`href="${pageUrl(rel)}"`)));
 checks.push(check('preview_noindex',/<meta\b[^>]*name="robots"[^>]*content="noindex,nofollow,noarchive"/i.test(html)));
 checks.push(check('finished_copy',!forbidden.some(term=>visible.includes(term)||html.includes(term)),forbidden.filter(term=>visible.includes(term)||html.includes(term))));
 checks.push(check('meaningful_links',count(html,/<a\b[^>]*href=/gi)>=3,count(html,/<a\b[^>]*href=/gi)));
 if(!hold){
  if(kind==='home')checks.push(check('decision_paths',[/action="\.\/cars\/"/,/href="\.\/compare\/"/,/href="\.\/rankings\/"/,/href="\.\/recalls\/"/].every(re=>re.test(html))),check('website_schema',hasSchema(html,'WebSite')),check('hero_photo',/<(?:picture|img)\b/i.test(html)));
  if(kind==='catalog')checks.push(check('static_vehicle_cards',count(html,/class="home-car"/g)>=6,count(html,/class="home-car"/g)),check('search_controls',/<input\b[^>]*type="search"/i.test(html)),check('photos',count(html,/<(?:picture|img)\b/gi)>=6,count(html,/<(?:picture|img)\b/gi)));
  if(kind==='manufacturer_hub'){
   const rows=count(html,/<article\b[^>]*class="maker-model"/g),pictures=count(html,/<picture\b/gi),empty=count(html,/class="maker-photo-empty"/g);
   checks.push(check('static_model_rows',rows>=5,rows),check('model_photos',pictures+empty===rows,{pictures,empty,rows}),check('itemlist_schema',hasSchema(html,'ItemList')),check('breadcrumb_schema',hasSchema(html,'BreadcrumbList')));
  }
  if(kind==='vehicle_directory')checks.push(check('static_model_links',count(html,/class="pm-model-link"/g)>=10,count(html,/class="pm-model-link"/g)),check('collection_schema',hasSchema(html,'CollectionPage')));
  if(kind==='vehicle')checks.push(check('vehicle_photo',/<(?:picture|img)\b/i.test(html)),check('structured_specification',/<(?:table|dl)\b/i.test(html)||/class="(?:metrics-strip|data-grid|spec-grid|spec-card|model-metrics)"/.test(html)),check('efficiency',/복합\s*(?:연비|전비)/.test(visible)),check('tax',/자동차세/.test(visible)),check('cost',/(?:연료비|충전비|에너지비)/.test(visible)),check('official_source',/(?:한국에너지공단|제조사 자료|공식 연비|공식 전비)/.test(visible)),check('vehicle_schema',hasSchema(html,'Vehicle')));
  if(kind==='vehicle_spec')checks.push(check('editorial_depth',visible.length>=450,visible.length),check('specific_metric',/(?:복합\s*(?:연비|전비)|자동차세)/.test(visible)),check('official_source',/(?:한국에너지공단|오피넷|지방세법|제조사 자료|공식 연비|공식 전비)/.test(visible)),check('structured_values',/<(?:table|dl)\b/i.test(html)||/class="(?:metrics-strip|data-grid|spec-grid|spec-card|rows)"/.test(html)));
  if(kind==='comparison_hub')checks.push(check('static_comparisons',count(html,/href="\.\.\/compare\/[^"#?]+\/"/g)>=15,count(html,/href="\.\.\/compare\/[^"#?]+\/"/g)),check('calculator_controls',count(html,/<select\b/gi)>=2&&count(html,/<input\b/gi)>=4),check('application_schema',hasSchema(html,'WebApplication')));
  if(kind==='comparison')checks.push(check('two_vehicles',count(html,/data-(?:decision-side|pilot-car)=/g)===2,count(html,/data-(?:decision-side|pilot-car)=/g)),check('two_photos',count(html,/data-optimized-photo="true"/g)>=2,count(html,/data-optimized-photo="true"/g)),check('comparison_matrix',count(html,/class="reference-matrix"/g)===1),check('metric_charts',count(html,/class="[^"]*\bmetric-chart\b/g)>=2,count(html,/class="[^"]*\bmetric-chart\b/g)),check('official_sources',count(html,/>공식 연비·전비 자료</g)>=2,count(html,/>공식 연비·전비 자료</g)),check('breadcrumb_schema',hasSchema(html,'BreadcrumbList')));
  if(kind==='ranking_hub')checks.push(check('eight_rankings',count(html,/class="rank-hub-row"/g)===8,count(html,/class="rank-hub-row"/g)),check('three_groups',count(html,/class="rank-hub-group"/g)===3,count(html,/class="rank-hub-group"/g)),check('leader_photos',count(html,/data-optimized-photo="true"/g)===8,count(html,/data-optimized-photo="true"/g)),check('breadcrumb_schema',hasSchema(html,'BreadcrumbList')));
  if(kind==='ranking'){
   const rows=count(html,/class="rank-row"/g);checks.push(check('rank_rows',rows>=5,rows),check('row_photos',count(html,/class="rank-photo"/g)===rows,count(html,/class="rank-photo"/g)),check('row_meters',count(html,/class="rank-meter"/g)===rows,count(html,/class="rank-meter"/g)),check('itemlist_schema',hasSchema(html,'ItemList')));
  }
  if(kind==='tool_hub')checks.push(check('five_calculators',count(html,/href="\.\/[^"/]+\/"/g)>=5,count(html,/href="\.\/[^"/]+\/"/g)));
  if(kind==='tool')checks.push(check('calculator_controls',/<form\b/i.test(html)||(count(html,/<input\b/gi)>=2&&/<button\b/i.test(html))),check('five_faqs',count(html,/<details\b/gi)>=5,count(html,/<details\b/gi)),check('application_schema',hasSchema(html,'WebApplication')));
  if(kind==='guide_hub')checks.push(check('guide_directory',count(html,/href="\.\/[^"/]+\/"/g)>=10,count(html,/href="\.\/[^"/]+\/"/g)));
  if(kind==='guide')checks.push(check('editorial_depth',visible.length>=700,visible.length),check('section_depth',count(html,/<h2\b/gi)>=4,count(html,/<h2\b/gi)),check('source_link',/(한국에너지공단|오피넷|지방세법|제조사 자료)/.test(visible)));
  if(kind==='recall_hub')checks.push(check('recall_search',/id="recall-search"/.test(html)),check('static_notices',count(html,/class="decision-recall"/g)>=5,count(html,/class="decision-recall"/g)),check('webpage_schema',hasSchema(html,'WebPage')));
  if(kind==='recall')checks.push(check('recall_depth',visible.length>=550,visible.length),check('production_period',/생산기간/.test(visible)),check('repair_method',/(시정방법|수리 방법)/.test(visible)),check('official_action',/공식.*(?:확인|조회)|자동차리콜센터/.test(visible)),check('breadcrumb_schema',hasSchema(html,'BreadcrumbList')));
  if(kind==='information')checks.push(check('information_depth',visible.length>=350,visible.length),check('sections',count(html,/<h2\b/gi)>=1,count(html,/<h2\b/gi)));
 }
 const failures=checks.filter(item=>!item.pass).map(item=>item.name);
 reports.push({path:'/'+rel.replace(/index\.html$/,''),kind,status:redirect?'redirect':hold?'excluded':failures.length?'failed':'release_ready',reason:redirect?'Compatibility redirect':hold||undefined,title,h1,visible_characters:visible.length,checks,failures});
}

const ready=reports.filter(p=>p.status==='release_ready');
const duplicates=(field)=>Object.entries(Object.groupBy(ready,p=>p[field])).filter(([value,items])=>value&&items.length>1).map(([value,items])=>({value,paths:items.map(p=>p.path)}));
const duplicateTitles=duplicates('title'),duplicateH1=duplicates('h1');
const failed=reports.filter(p=>p.status==='failed');
const byKind=Object.fromEntries([...new Set(reports.map(p=>p.kind))].sort().map(kind=>[kind,{total:reports.filter(p=>p.kind===kind).length,release_ready:reports.filter(p=>p.kind===kind&&p.status==='release_ready').length,excluded:reports.filter(p=>p.kind===kind&&p.status==='excluded').length,redirect:reports.filter(p=>p.kind===kind&&p.status==='redirect').length,failed:reports.filter(p=>p.kind===kind&&p.status==='failed').length}]));
const report={schema_version:2,generated_at:new Date().toISOString(),preview_noindex_unchanged:siteConfig.indexingEnabled===false,production_switch:false,production_origin:null,summary:{total:reports.length,release_ready:ready.length,excluded:reports.filter(p=>p.status==='excluded').length,redirect:reports.filter(p=>p.status==='redirect').length,failed:failed.length,by_kind:byKind},duplicates:{titles:duplicateTitles,h1:duplicateH1},pages:reports.sort((a,b)=>a.path.localeCompare(b.path))};
fs.writeFileSync(path.join(root,'data/index-quality-gate.json'),JSON.stringify(report,null,2)+'\n');
assert.equal(siteConfig.indexingEnabled,false,'Preview indexing must remain disabled');
assert.deepEqual(duplicateTitles,[],'Release-ready titles must be unique');
assert.deepEqual(duplicateH1,[],'Release-ready H1 headings must be unique');
assert.deepEqual(failed.map(p=>({path:p.path,failures:p.failures})),[],'Release-ready page quality failures');
console.log(JSON.stringify(report.summary,null,2));
