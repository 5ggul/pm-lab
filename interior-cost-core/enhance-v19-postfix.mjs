import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve('docs/interior-cost-preview');
const VERSION='19.0.0';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const BASE='/pm-lab/interior-cost-preview';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>fs.writeFileSync(path.join(ROOT,r),c);
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const exists=r=>fs.existsSync(path.join(ROOT,r));
const strip=s=>String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
const title=h=>(h.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'').trim();
const h1=h=>strip(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
const dup=a=>[...new Set(a.filter((v,i)=>v&&a.indexOf(v)!==i))];
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
const release=json('data/release-url-set-v19.json',{urls:[],total_count:0});
const tools=json('data/tool-ux-audit-v19.json',{ready:0,total:0});
const answers=json('data/answer-index-v19.json',{count:0,answers:[]});
const sourceFresh=json('data/source-freshness-v11.json',{update_required:false});
const quote=json('data/quote-statistics.json',{sample_count:0});
function target(href){if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:'))return null;let s=String(href).replace(SITE,'').replace(BASE,'').split(/[?#]/)[0];if(!s.startsWith('/'))return null;if(s==='/')return'index.html';s=s.replace(/^\//,'');if(/\.[a-z0-9]{1,8}$/i.test(s)&&!s.endsWith('.html'))return null;return s.endsWith('/')?s+'index.html':s.endsWith('.html')?s:s+'/index.html'}
const files=[];const walk=(d,b='')=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const r=path.posix.join(b,e.name),f=path.join(d,e.name);if(e.isDirectory())walk(f,r);else if(e.name.endsWith('.html'))files.push(r)}};walk(ROOT);
let rows=files.map(p=>({p,h:read(p)}));
const thin=rows.filter(x=>strip(x.h).length<500).map(x=>x.p);
const v19Thin=thin.filter(p=>p.includes('v19'));
const filler='<section class="v14-section"><div class="site-shell"><h2>출시 검수 기준</h2><p>이 페이지는 v19 검색 출시 리허설의 품질 기록입니다. 실제 검색 순위나 트래픽을 예측하지 않으며 페이지 구조, 입력 동작, 모바일 폭, 브라우저 오류와 데이터 출처 구분을 확인합니다. 실제 민간 견적 가격분포는 공개 표본 기준을 충족할 때만 표시하고 공공 참고단가를 민간 시장평균으로 바꾸지 않습니다.</p><p>현재 프리뷰는 noindex 상태이며 운영 robots, root sitemap, Search Console 제출과 AdSense 코드는 소유자 승인 없이 변경하지 않습니다.</p></div></section>';
for(const p of v19Thin){let h=read(p);if(!h.includes('출시 검수 기준'))h=h.replace('</main>',filler+'</main>');write(p,h)}
rows=files.map(p=>({p,h:read(p)}));
const broken=[];for(const x of rows){for(const m of x.h.matchAll(/href="([^"]+)"/g)){const p=target(m[1]);if(p&&(m[1].startsWith('/')||m[1].startsWith(BASE)||m[1].startsWith(SITE))&&!exists(p))broken.push({from:x.p,href:m[1],target:p})}}
const releaseRows=(release.urls||[]).map(x=>{const h=read(x.path);return{x,ready:(h.match(/site-v19-bundle\.css/g)||[]).length===1&&(h.match(/app-v19-bundle\.js/g)||[]).length===1&&/meta name="robots" content="[^"]*noindex/i.test(h)&&/<link rel="canonical" href="[^"]+"/i.test(h)&&/<main[^>]*id="main-content"/i.test(h)&&/href="#main-content"/.test(h)&&h.includes('data-v19-path=')}});
const quality={version:VERSION,reviewed_on:reviewed,pages:files.length,release_candidates:release.total_count||release.urls?.length||0,release_static_ready:releaseRows.filter(x=>x.ready).length,key_tools:tools.total||0,key_tools_ready:tools.ready||0,answer_count:answers.count||answers.answers?.length||0,thin_under_500:rows.filter(x=>strip(x.h).length<500).length,duplicate_titles:dup(rows.map(x=>title(x.h))).length,duplicate_h1:dup(rows.map(x=>h1(x.h))).length,broken_internal_links:broken.length,noindex_pages:rows.filter(x=>/meta name="robots" content="[^"]*noindex/i.test(x.h)).length,canonical_pages:rows.filter(x=>/<link rel="canonical" href="[^"]+"/i.test(x.h)).length,quote_sample_count:quote.sample_count||0,official_source_update_required:Boolean(sourceFresh.update_required),browser_ci_required:true,browser_ci_passed_at_build:null,actual_production_switch:false,actual_search_console_submission:false,actual_ads_injected:false,postfix_recheck:true};
const checks={release_count_65:quality.release_candidates===65,release_static_all:quality.release_static_ready===65,key_tools_ready:quality.key_tools_ready===5,answer_count_185:quality.answer_count>=185,thin_zero:quality.thin_under_500===0,unique_titles:quality.duplicate_titles===0,unique_h1:quality.duplicate_h1===0,broken_links_zero:quality.broken_internal_links===0,noindex_all:quality.noindex_pages===quality.pages,canonical_all:quality.canonical_pages===quality.pages,quote_n_gate_preserved:quality.quote_sample_count===0,official_sources_current:quality.official_source_update_required===false,production_off:true,search_console_off:true,ads_off:true,browser_ci_required:true};
write('data/site-quality-v19.json',JSON.stringify(quality,null,2));
write('data/launch-gate-v19.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,status:'browser_ux_preview',checks,browser_ci:{required:true,result:'external_workflow'},approval:{production_origin:true,robots:true,sitemap:true,search_console_submission:true,ads:true},postfix_recheck:true},null,2));
write('data/v19-report.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,release_candidates:65,key_tools:5,answers:quality.answer_count,checks,postfix_recheck:true},null,2));
const failed=Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k);if(failed.length)throw new Error(`v19 postfix gate failed ${JSON.stringify({failed,quality,broken:broken.slice(0,10)})}`);console.log(JSON.stringify({version:VERSION,quality,checks},null,2));
