import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const exists=p=>fs.existsSync(path.join(ROOT,p));
const textOf=html=>html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{const full=path.join(dir,ent.name);return ent.isDirectory()?walk(full):[full]});
const rel=f=>path.relative(ROOT,f).split(path.sep).join('/');
const fail=[];
const checks={};
const assert=(name,ok,detail='')=>{checks[name]=!!ok;if(!ok)fail.push(detail?`${name}: ${detail}`:name)};

const htmlFiles=walk(ROOT).filter(f=>f.endsWith('.html')).map(rel);
assert('preview_all_noindex',htmlFiles.every(p=>/name="robots" content="[^"]*noindex/i.test(read(p))),`${htmlFiles.filter(p=>!/name="robots" content="[^"]*noindex/i.test(read(p))).slice(0,5).join(', ')}`);
assert('no_cname',!exists('CNAME'));

const critical=['index.html','quote-check/index.html','quote-compare/index.html','calculator/index.html','cost/index.html',...['bathroom','kitchen','window','wallpaper','floor','demolition','electrical','carpentry','insulation'].map(s=>`cost/${s}/index.html`),...['24','30','32','34','40'].map(n=>`interior-cost/${n}-pyeong/index.html`),'search/index.html','about/index.html','contact/index.html','privacy/index.html','terms/index.html','disclaimer/index.html','editorial-policy/index.html','corrections/index.html'];
assert('critical_pages_exist',critical.every(exists),critical.filter(p=>!exists(p)).join(', '));

const forbidden=/PRIMARY ANSWER|EVIDENCE TYPE|RELEASE CANDIDATE|PRIVATE QUOTE SAMPLE|NEXT CHECK|INDEX RELEASE|PREVIEW|NOINDEX|출시 후보|검수 후보/i;
const leaks=[];
for(const p of critical.filter(exists)){
  const t=textOf(read(p));
  if(forbidden.test(t))leaks.push(p);
}
assert('critical_internal_copy_zero',leaks.length===0,leaks.join(', '));

const home=read('index.html');
const homeText=textOf(home);
const firstHeading=home.match(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/i);
assert('home_first_heading_h1',firstHeading?.[1]==='1',firstHeading?.[0]||'missing heading');
assert('home_task_h1',/인테리어 견적 검사·비교/.test(homeText));
assert('home_primary_actions',/견적 검사 시작/.test(homeText)&&/3견적 비교/.test(homeText));
assert('home_no_empty_sample_kpi',!/(실제 견적\s*N=0|Actual index|Mobile ready|Release candidate)/i.test(homeText));
assert('home_no_english_launch_cards',!/(^|\s)(CHECK|COMPARE|CALCULATE)(\s|$)/.test(homeText));

assert('insulation_hub_exists',exists('cost/insulation/index.html'));
assert('cost_hub_links_insulation',read('cost/index.html').includes('/cost/insulation/'));
const insulationText=textOf(read('cost/insulation/index.html'));
assert('insulation_has_real_conditions',/단열재 종류/.test(insulationText)&&/실제 작업면적/.test(insulationText)&&/기밀/.test(insulationText));

for(const n of [24,30,32,34,40]){
  const p=`interior-cost/${n}-pyeong/index.html`,h=read(p),t=textOf(h);
  assert(`pyeong_${n}_no_empty_stats`,!/(N=0|P25\s*보류|중앙값\s*보류|평당 중앙값\s*보류)/.test(t));
  assert(`pyeong_${n}_intent_title`,new RegExp(`${n}평 인테리어 비용 비교`).test(h.match(/<title>(.*?)<\/title>/i)?.[1]||''));
  assert(`pyeong_${n}_boundary`,/가격 통계 공개 전/.test(t));
}

for(const p of ['quote-check/index.html','quote-compare/index.html']){
  assert(`${p}_import_discovery`,read(p).includes('/compare/quote-lines/'));
}
assert('search_filter_present',read('search/index.html').includes('data-v26-search-filter'));

const manifest=JSON.parse(read('data/v26-launch-manifest.json'));
const matrixDetails=manifest.pages.filter(x=>/^\/interior-cost\/matrix\/.+\/.+\/$/.test(x.route));
assert('matrix_25_not_launch_indexed',matrixDetails.length===25&&matrixDetails.every(x=>x.state==='hold_noindex'),`count=${matrixDetails.length}`);
const regionDetails=manifest.pages.filter(x=>/^\/region\/.+\/$/.test(x.route));
assert('region_details_not_launch_indexed',regionDetails.every(x=>x.state==='hold_noindex'));
const internalOps=manifest.pages.filter(x=>x.state==='exclude_production');
assert('internal_ops_excluded',internalOps.length>0);
const indexCandidates=manifest.pages.filter(x=>x.state==='index_candidate');
assert('index_candidates_exist',indexCandidates.length>=20,`count=${indexCandidates.length}`);
assert('index_candidates_files_exist',indexCandidates.every(x=>exists(x.file)));
assert('preview_not_switched_by_manifest',manifest.preview_noindex_preserved===true&&manifest.production_index_not_enabled===true);
assert('manual_launch_gates_explicit',manifest.manual_launch_gates.includes('production_origin')&&manifest.manual_launch_gates.includes('public_contact_email'));

const keyMeta=['quote-check/index.html','quote-compare/index.html','calculator/index.html','cost/index.html',...['bathroom','kitchen','window','wallpaper','floor','demolition','electrical','carpentry','insulation'].map(s=>`cost/${s}/index.html`)];
const titles=keyMeta.map(p=>read(p).match(/<title>(.*?)<\/title>/i)?.[1]||'');
const descs=keyMeta.map(p=>read(p).match(/<meta name="description" content="([^"]*)"/i)?.[1]||'');
assert('key_titles_unique',new Set(titles).size===titles.length);
assert('key_descriptions_unique',new Set(descs).size===descs.length);
assert('key_descriptions_quality',descs.every(x=>x.length>=45&&x.length<=170),descs.map((x,i)=>`${keyMeta[i]}:${x.length}`).filter((_,i)=>descs[i].length<45||descs[i].length>170).join(', '));

let ads=false,forbiddenData=false;
for(const f of walk(ROOT).filter(f=>/\.(?:html|js|css|json|txt)$/i.test(f))){
  const s=fs.readFileSync(f,'utf8');
  if(/adsbygoogle|pagead2\.googlesyndication\.com/i.test(s))ads=true;
  if(/serviceKey|invstDeptTelNo|invstOfclNm|cntrctCorpTelNo/i.test(s))forbiddenData=true;
}
assert('ads_not_injected',!ads);
assert('forbidden_data_absent',!forbiddenData);

const report={version:'26.0.0',generated_at:new Date().toISOString(),checks,metrics:{html_pages:htmlFiles.length,critical_pages:critical.length,index_candidates:indexCandidates.length,hold_noindex:manifest.pages.filter(x=>x.state==='hold_noindex').length,review_before_index:manifest.pages.filter(x=>x.state==='review_before_index').length,exclude_production:internalOps.length,matrix_hold:matrixDetails.length,region_hold:regionDetails.length},manual_launch_gates:manifest.manual_launch_gates,ready_for_domain_review:fail.length===0,ready_for_index_activation:false,preview_boundary:{production_switch:false,search_console_submission:false,ads_injected:false,merge_to_main:false},failures:fail};
fs.writeFileSync(path.join(ROOT,'data/v26-launch-quality-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(fail.length)throw new Error(`v26 launch quality failed: ${fail.join(' | ')}`);
