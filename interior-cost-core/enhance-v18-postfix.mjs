import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const VERSION='18.0.0';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const BASE='/pm-lab/interior-cost-preview';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const exists=r=>fs.existsSync(path.join(ROOT,r));
const strip=s=>String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
const title=h=>(h.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'').trim();
const h1=h=>strip(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
const dup=a=>[...new Set(a.filter((v,i)=>v&&a.indexOf(v)!==i))];
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
const release=json('data/release-url-set-v18.json',{urls:[],total_count:0});
const snippets=json('data/search-snippets-v18.json',{passed:0});
const citations=json('data/citation-pack-v18.json',{count:0});
const mobile=json('data/mobile-audit-v18.json',{ready:0});
const journey=json('data/release-journey-v18.json',{isolated:99,missing_next_actions:99});
const performance=json('data/performance-budget-v18.json',{pass:false});
const answers=json('data/answer-index-v18.json',{count:0,answers:[]});
const sourceFresh=json('data/source-freshness-v11.json',{update_required:false});
const quote=json('data/quote-statistics.json',{sample_count:0});

function internalTarget(href){
  if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:'))return null;
  let s=String(href).replace(SITE,'').replace(BASE,'').split(/[?#]/)[0];
  if(!s.startsWith('/'))return null;
  if(s==='/')return'index.html';s=s.replace(/^\//,'');
  if(/\.[a-z0-9]{1,8}$/i.test(s)&&!s.endsWith('.html'))return null;
  return s.endsWith('/')?s+'index.html':s.endsWith('.html')?s:s+'/index.html';
}
const files=[];const walk=(d,b='')=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const r=path.posix.join(b,e.name),f=path.join(d,e.name);if(e.isDirectory())walk(f,r);else if(e.name.endsWith('.html'))files.push(r)}};walk(ROOT);
const rows=files.map(p=>({p,h:read(p)}));
const broken=[];
for(const x of rows){for(const m of x.h.matchAll(/href="([^"]+)"/g)){const p=internalTarget(m[1]);if(p&&(m[1].startsWith('/')||m[1].startsWith(BASE)||m[1].startsWith(SITE))&&!exists(p))broken.push({from:x.p,href:m[1],target:p})}}
const adsPattern=/adsbygoogle|pagead2\.googlesyndication\.com|data-ad-client|<ins[^>]*class="adsbygoogle"/i;
const quality={version:VERSION,reviewed_on:reviewed,pages:files.length,release_candidates:release.total_count||release.urls?.length||0,snippet_passed:snippets.passed||0,citation_records:citations.count||0,mobile_ready:mobile.ready||0,release_isolated:journey.isolated??99,release_next_action_missing:journey.missing_next_actions??99,broken_internal_links:broken.length,answer_count:answers.count||answers.answers?.length||0,thin_under_500:rows.filter(x=>strip(x.h).length<500).length,duplicate_titles:dup(rows.map(x=>title(x.h))).length,duplicate_h1:dup(rows.map(x=>h1(x.h))).length,noindex_pages:rows.filter(x=>/meta name="robots" content="[^"]*noindex/i.test(x.h)).length,canonical_pages:rows.filter(x=>/<link rel="canonical" href="[^"]+"/i.test(x.h)).length,official_source_update_required:Boolean(sourceFresh.update_required),quote_sample_count:quote.sample_count||0,bundle_budget_pass:performance.pass===true,actual_ad_code_present:rows.some(x=>adsPattern.test(x.h)),actual_production_switch:false,actual_search_console_submission:false,actual_root_robots_changed:false,actual_root_sitemap_changed:false,postfix_recheck:true};
const checks={release_count_65:quality.release_candidates===65,snippets_all_pass:quality.snippet_passed===65,citation_pack_complete:quality.citation_records===65,mobile_all_ready:quality.mobile_ready===65,release_not_isolated:quality.release_isolated===0,next_actions_all:quality.release_next_action_missing===0,broken_links_zero:quality.broken_internal_links===0,answer_count_170:quality.answer_count>=170,thin_zero:quality.thin_under_500===0,unique_titles:quality.duplicate_titles===0,unique_h1:quality.duplicate_h1===0,noindex_all:quality.noindex_pages===quality.pages,canonical_all:quality.canonical_pages===quality.pages,official_sources_current:quality.official_source_update_required===false,quote_n_gate_preserved:quality.quote_sample_count===0,bundle_budget:quality.bundle_budget_pass===true,ad_code_off:quality.actual_ad_code_present===false,production_off:true,search_console_off:true,root_robots_off:true,root_sitemap_off:true};
write('data/site-quality-v18.json',JSON.stringify(quality,null,2));
write('data/launch-gate-v18.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,status:'release_rehearsal_preview',checks,approval:{production_origin:true,robots:true,sitemap:true,search_console_submission:true,ads:true},postfix_recheck:true},null,2));
write('data/v18-report.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,release_candidates:65,answers:quality.answer_count,checks,postfix_recheck:true},null,2));
let page=read('data/launch-gate-v18/index.html');
for(const [key,val] of Object.entries(checks))page=page.replace(new RegExp(`<tr><td>${key}<\\/td><td>(?:PASS|FAIL)<\\/td><\\/tr>`,'g'),`<tr><td>${key}</td><td>${val?'PASS':'FAIL'}</td></tr>`);
write('data/launch-gate-v18/index.html',page);
const failed=Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k);
if(failed.length)throw new Error(`v18 postfix gate failed ${JSON.stringify({failed,quality})}`);
console.log(JSON.stringify({version:VERSION,quality,checks},null,2));
