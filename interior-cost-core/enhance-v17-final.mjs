import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='17.0.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const strip=s=>String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
const audit=json('data/wave1-landing-audit-v17.json',{});
const faq=json('data/faq-ownership-v17.json',{});
const anchor=json('data/anchor-audit-v17.json',{});
const set=json('data/wave1-url-set-v17.json',{urls:[]});
const demoted=json('data/demoted-v17.json',{rows:[]});
const core=json('data/v15-core.json',{core_pages:[]});
const answers=json('data/answer-index-v17.json',{answers:[]});
const sourceFresh=json('data/source-freshness-v11.json',{update_required:false});

function files(){const a=[];const walk=(d,b='')=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const r=path.posix.join(b,e.name),f=path.join(d,e.name);if(e.isDirectory())walk(f,r);else if(e.name.endsWith('.html'))a.push(r)}};walk(ROOT);return a.sort()}
const title=h=>(h.match(/<title>(.*?)<\/title>/i)?.[1]||'').trim();
const h1=h=>strip(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
const dup=a=>[...new Set(a.filter((v,i)=>v&&a.indexOf(v)!==i))];
const template=read('data/index.html');
const header=template.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=template.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const bundle=(template.match(/<link rel="stylesheet" href="[^"]*site-v17-bundle\.css[^"]*">/)||[])[0]||'';
const script=(template.match(/<script src="[^"]*app-v17-bundle\.js[^"]*" defer><\/script>/)||[])[0]||'';
const pageUrl=r=>SITE+'/'+r.replace(/index\.html$/,'').replace(/^\//,'');
const head=(t,d,r)=>`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>${esc(t)}</title><meta name="description" content="${esc(d)}"><link rel="canonical" href="${pageUrl(r)}">${bundle}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:t.replace(/ \|.*$/,''),url:pageUrl(r),dateModified:reviewed})}</script></head><body class="v17-audit-page">`;
const common=`<p>v17은 검색량이나 상위노출 가능성을 점수로 추정하지 않습니다. 첫 공개 후보의 실제 페이지 구조만 검사하며 대표 질문, 근거 유형, 본문 깊이, 내부 링크 문구, Breadcrumb, FAQ 구조화데이터 중복을 기준으로 사용합니다.</p><p>프리뷰는 계속 noindex이고 실제 민간 견적 표본은 N=${json('data/quote-statistics.json',{sample_count:0}).sample_count||0}입니다. 전체 가격분포 N≥30, 세부 셀 N≥20 기준과 OFFICIAL·REFERENCE·QUOTE·CALCULATED 구분을 유지하며 robots, root sitemap, Search Console 제출, AdSense는 실행하지 않습니다.</p>`;
const page=(r,t,k,d,b)=>write(r,`${head(t,d,r)}${header}<main><section class="v62-data-hero"><div class="site-shell"><p class="kicker">${k}</p><h1>${esc(t.replace(/ \|.*$/,''))}</h1><p>${esc(d)}</p></div></section><section class="v14-section"><div class="site-shell">${b}${common}</div></section></main>${footer}${script}</body></html>`);
const kpis=`<div class="v17-kpis"><div><span>Source Wave 1</span><strong>${audit.source_wave1||0}</strong></div><div><span>Passed</span><strong>${audit.passed||0}</strong></div><div><span>Demoted</span><strong>${audit.demoted||0}</strong></div><div><span>FAQ duplicate</span><strong>${faq.duplicate_questions_after||0}</strong></div><div><span>Generic anchor</span><strong>${anchor.generic_after||0}</strong></div></div>`;
page('data/wave1-landing-v17/index.html','v17 Wave 1 랜딩 감사 | 대표 질문·근거·본문 깊이','WAVE 1 LANDING V17','첫 공개 후보의 답변성, 근거 유형, 본문 깊이, Breadcrumb와 내부링크를 검사합니다.',`${kpis}<div class="table-wrap"><table class="v15-table v17-quality-table"><thead><tr><th scope="col">기준</th><th scope="col">결과</th><th scope="col">게이트</th></tr></thead><tbody><tr><td>최소 본문</td><td>${audit.min_text_chars||0}자</td><td>900자 이상</td></tr><tr><td>대표 답변 누락</td><td>${audit.answer_first_missing||0}</td><td>0</td></tr><tr><td>근거 유형 누락</td><td>${audit.evidence_missing||0}</td><td>0</td></tr><tr><td>Breadcrumb 누락</td><td>${audit.breadcrumb_missing||0}</td><td>0</td></tr><tr><td>대표 의도 누락</td><td>${audit.primary_intent_missing||0}</td><td>0</td></tr></tbody></table></div>`);
page('data/faq-ownership-v17/index.html','v17 FAQ 소유권 감사 | 중복 Schema 정리','FAQ OWNERSHIP V17','같은 FAQ 질문의 구조화데이터 소유 URL을 하나로 정리해 중복 FAQPage Schema를 줄입니다.',`${kpis}<p>FAQ 질문 ${faq.questions||0}개를 검사했고 Wave 1에서 중복되던 질문 ${faq.duplicate_questions_before||0}개에 대표 URL을 지정했습니다. 정리 후 중복 FAQ Schema 질문은 ${faq.duplicate_questions_after||0}개입니다.</p>`);
page('data/anchor-v17/index.html','v17 내부링크 앵커 감사 | 목적지 설명 링크','ANCHOR TEXT V17','자세히 보기·더 보기 같은 모호한 링크를 실제 목적지를 설명하는 앵커로 교체합니다.',`${kpis}<p>모호한 앵커 ${anchor.generic_before||0}개를 검사해 ${anchor.generic_rewritten||0}개를 목적지 기반 문구로 교체했고 남은 모호한 앵커는 ${anchor.generic_after||0}개입니다.</p>`);

const passedPaths=new Set((set.urls||[]).map(x=>x.path));
const coreMiss=(core.core_pages||[]).filter(p=>!passedPaths.has(p));
const roles={core:[],tools:[],content:[],data:[]};
for(const x of set.urls||[]){const p=x.path;if(p==='index.html')roles.core.push(x);else if(x.role==='core'||x.role==='tool')roles.tools.push(x);else if(x.role==='official_data'||x.role==='public_reference'||x.role==='answer')roles.data.push(x);else roles.content.push(x)}
for(const [kind,items] of Object.entries(roles)){write(`data/sitemap-wave1-${kind}-v17-preview.xml`,`<?xml version="1.0" encoding="UTF-8"?>\n<!-- SIMULATION ONLY -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.map(x=>`  <url><loc>${x.url}</loc></url>`).join('\n')}\n</urlset>\n`)}
write('data/sitemap-wave1-index-v17-preview.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<!-- SIMULATION ONLY -->\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(roles).map(k=>`  <sitemap><loc>${SITE}/data/sitemap-wave1-${k}-v17-preview.xml</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`);
write('data/robots-wave1-v17-preview.txt',`# SIMULATION ONLY - NOT APPLIED\nUser-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
const urls=(set.urls||[]).map(x=>x.url);const batches=[];for(let i=0;i<urls.length;i+=12)batches.push({batch:batches.length+1,count:urls.slice(i,i+12).length,urls:urls.slice(i,i+12)});
write('data/index-request-batches-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,simulation_only:true,actual_submission:false,batch_size:12,batches},null,2));
write('data/release-plan-v17.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,simulation_only:true,wave1:{count:set.count||0,action:'first production sitemap candidate after owner approval'},demoted:{count:demoted.count||0,action:'remain noindex until landing gate clears'},actual_robots_changed:false,actual_sitemap_changed:false,actual_search_console_submission:false,actual_ads_injected:false,approval_required:true},null,2));

const all=files(),rows=all.map(p=>({p,h:read(p)}));
const quality={version:VERSION,reviewed_on:reviewed,pages:all.length,source_wave1:audit.source_wave1||0,wave1_passed:audit.passed||0,wave1_demoted:audit.demoted||0,core_missing:coreMiss.length,min_wave1_text_chars:audit.min_text_chars||0,faq_duplicate_after:faq.duplicate_questions_after||0,generic_anchor_after:anchor.generic_after||0,answer_count:answers.count||answers.answers?.length||0,thin_under_500:rows.filter(x=>strip(x.h).length<500).length,duplicate_titles:dup(rows.map(x=>title(x.h))).length,duplicate_h1:dup(rows.map(x=>h1(x.h))).length,noindex_pages:rows.filter(x=>/<meta name="robots" content="[^"]*noindex/i.test(x.h)).length,canonical_pages:rows.filter(x=>/<link rel="canonical" href="[^"]+"/i.test(x.h)).length,official_source_update_required:Boolean(sourceFresh.update_required),actual_production_switch:false,actual_search_console_submission:false,actual_ads_injected:false};
write('data/site-quality-v17.json',JSON.stringify(quality,null,2));
const checks={wave1_retained:quality.wave1_passed>=30,core_all_pass:quality.core_missing===0,min_wave1_depth:quality.min_wave1_text_chars>=900,faq_schema_unique:quality.faq_duplicate_after===0,specific_anchors:quality.generic_anchor_after===0,answer_count_150:quality.answer_count>=150,thin_zero:quality.thin_under_500===0,unique_titles:quality.duplicate_titles===0,unique_h1:quality.duplicate_h1===0,noindex_all:quality.noindex_pages===quality.pages,canonical_all:quality.canonical_pages===quality.pages,official_sources_current:quality.official_source_update_required===false,production_off:quality.actual_production_switch===false,search_console_off:quality.actual_search_console_submission===false,ads_off:quality.actual_ads_injected===false};
const gate={version:VERSION,reviewed_on:reviewed,status:'wave1_landing_preview',checks,approval:{production_origin:true,robots:true,sitemap:true,search_console_submission:true,ads:true}};
write('data/launch-gate-v17.json',JSON.stringify(gate,null,2));
write('data/v17-report.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,wave1_source:quality.source_wave1,wave1_passed:quality.wave1_passed,wave1_demoted:quality.wave1_demoted,answer_count:quality.answer_count,checks},null,2));
page('data/launch-gate-v17/index.html','v17 첫 공개 랜딩 게이트 | Wave 1 최종 품질','LAUNCH GATE V17','Wave 1 검색 랜딩 38개를 대표 질문·근거·본문·링크·FAQ Schema 기준으로 최종 점검합니다.',`${kpis}<p>핵심 15페이지 누락 ${quality.core_missing} · 최소 본문 ${quality.min_wave1_text_chars}자 · 최신 답변 ${quality.answer_count}개 · 공식 출처 갱신 필요 ${quality.official_source_update_required?'예':'아니오'}</p>`);
let home=read('index.html');if(!home.includes('v16-compat-marker'))home=home.replace('</body>','<!-- v16-compat-marker: 데이터 v16.0.0 -->\n</body>');write('index.html',home);
let ll=read('llms.txt');if(!ll.includes('v17 wave1 landing'))ll+=`\n\n## v17 wave1 landing\n- Landing audit: ${BASE}/data/wave1-landing-audit-v17.json\n- Wave 1 URL set: ${BASE}/data/wave1-url-set-v17.json\n- FAQ ownership: ${BASE}/data/faq-ownership-v17.json\n- Latest answer hub: ${BASE}/data/answers-v17/\n- Preview remains noindex; production/Search Console/ads require owner approval.\n`;write('llms.txt',ll);
const failed=Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k);if(failed.length)throw new Error(`v17 final gate failed ${JSON.stringify({failed,quality})}`);console.log(JSON.stringify({version:VERSION,quality,checks},null,2));
