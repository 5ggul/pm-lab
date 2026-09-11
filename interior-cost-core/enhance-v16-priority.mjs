import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='16.0.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const exists=r=>fs.existsSync(path.join(ROOT,r));
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const strip=s=>String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
const prod15=json('data/production-url-set-v15.json',{indexable:[]});
const core15=json('data/v15-core.json',{core_pages:[]});
const queryMap=json('data/query-map.json',{queries:[]});
const fresh=json('data/source-freshness-v11.json',{update_required:false});
const quote=json('data/quote-statistics.json',{sample_count:0});
const answers15=json('data/answer-index-v15.json',{answers:[]});
const coreSet=new Set(core15.core_pages||[]);

function files(){const out=[];const walk=(d,b='')=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const r=path.posix.join(b,e.name),f=path.join(d,e.name);e.isDirectory()?walk(f,r):e.name.endsWith('.html')&&out.push(r)}};walk(ROOT);return out.sort()}
const route=r=>r==='index.html'?'/':r==='404.html'?'/404.html':'/'+r.replace(/index\.html$/,'');
const previewUrl=r=>SITE+route(r);
const title=h=>(h.match(/<title>(.*?)<\/title>/i)?.[1]||'').trim();
const desc=h=>(h.match(/<meta name="description" content="([^"]*)"/i)?.[1]||'').trim();
const h1=h=>(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').replace(/<[^>]+>/g,'').trim();
const schemaTypes=h=>{const out=[];for(const m of h.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)){try{const o=JSON.parse(m[1]);const nodes=Array.isArray(o)?o:Array.isArray(o?.['@graph'])?o['@graph']:[o];for(const n of nodes){const t=n?.['@type'];Array.isArray(t)?out.push(...t):t&&out.push(t)}}catch{}}return[...new Set(out)]};
const targetPath=u=>{if(!u)return null;let x=String(u).split('#')[0].split('?')[0];if(x.startsWith(SITE))x=x.slice(SITE.length)||'/';else if(x.startsWith(BASE))x=x.slice(BASE.length)||'/';else if(!x.startsWith('/'))return null;if(x==='/')return'index.html';x=x.replace(/^\//,'');return x.endsWith('/')?x+'index.html':x.endsWith('.html')?x:x+'/index.html'};

const baseCandidates=(prod15.indexable||[]).map(x=>x.path).filter(p=>exists(p)&&p!=='data/answers-v15/index.html');
const extraAnswers=[
 ['v16-wave','SEO','왜 모든 production 후보를 한 번에 색인하지 않나요?','첫 공개에서는 핵심 도구·평수·공종·공공근거를 먼저 열고 보조 페이지는 내부 링크와 실제 이용 흐름이 확인된 뒤 두 번째 공개 묶음으로 남깁니다.'],
 ['v16-score','SEO','v16 준비도 점수는 검색 순위 점수인가요?','아닙니다. 검색량이나 순위 확률을 추정하지 않고 본문 깊이·내부 연결·메타·구조화데이터·질의 소유권 같은 출시 준비 상태만 계산합니다.'],
 ['v16-hold','SEO','HOLD 페이지는 삭제하나요?','삭제하지 않습니다. 프리뷰와 내부 탐색에는 남기고 색인 조건이 충족될 때까지 첫 공개 sitemap에서 제외합니다.'],
 ['v16-region','데이터','지역별 페이지는 언제 1군이 되나요?','지역 또는 지역×평수 세부 셀은 실제 익명 견적 표본이 N 20 이상인 경우에만 가격 통계 공개 후보가 됩니다.'],
 ['v16-depth','SEO','첫 공개 페이지의 클릭 깊이도 확인하나요?','네. 홈에서 핵심 허브를 연결한 뒤 첫 공개 페이지의 내부 탐색 깊이를 계산하고 3단계보다 깊은 페이지는 1군에서 제외합니다.'],
 ['v16-intent','SEO','같은 검색어가 여러 페이지를 경쟁하면 어떻게 하나요?','query map에서 검색어마다 대표 소유 페이지를 하나로 고정하고 보조 페이지는 내부 링크 역할로 남깁니다.'],
 ['v16-batch','운영','색인 요청은 한 번에 전부 제출하나요?','첫 공개 URL도 core·tool·content·data 묶음과 소규모 배치 순서를 만들어 검수하지만 실제 Search Console 제출은 자동 실행하지 않습니다.'],
 ['v16-source','AEO','공식 데이터가 오래되면 1군에서 빠지나요?','공식 공사비지수·임금·표준시장단가 신선도 감시에서 갱신 필요가 확인되면 관련 공식 데이터 페이지를 우선 재검수 대상으로 표시합니다.'],
 ['v16-answer','AEO','이전 답변 허브도 검색에 남나요?','아니요. v16 최신 답변 허브만 첫 공개 후보로 두고 이전 버전 허브는 기록용 noindex 대상으로 유지합니다.'],
 ['v16-launch','운영','v16 1군이 자동으로 실제 색인되나요?','아니요. Wave 1 sitemap과 robots는 시뮬레이션이며 운영 도메인과 소유자 승인이 있어야 실제 전환합니다.']
].map(([id,category,question,answer])=>({id,category,question,answer,source:`${BASE}/data/index-priority-v16/`,url:`${BASE}/data/index-priority-v16/`,status:'published'}));
const answers=[...(answers15.answers||[]),...extraAnswers];
write('data/answer-index-v16.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,count:answers.length,answers},null,2));

const css15=read('assets/site-v15-bundle.css'),js15=read('assets/app-v15-bundle.js'),css16=fs.readFileSync(path.join(CORE,'site-v16.css'),'utf8');
const bundleHash=crypto.createHash('sha1').update(css15+'\n'+css16+'\n'+js15).digest('hex').slice(0,12);
write('assets/site-v16-bundle.css',css15+'\n/* v16 */\n'+css16);
write('assets/app-v16-bundle.js',js15+'\n/* v16 index priority: static launch-wave metadata */\n');
const cssRef=`<link rel="stylesheet" href="${BASE}/assets/site-v16-bundle.css?v=${bundleHash}">`;
const jsRef=`<script src="${BASE}/assets/app-v16-bundle.js?v=${bundleHash}" defer></script>`;

const template=read('data/index.html'),header=template.match(/<header[\s\S]*?<\/header>/)?.[0]||'',footer=template.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const ansRel='data/answers-v16/index.html',ansCanonical=previewUrl(ansRel),ansCards=answers.map(x=>`<article class="v10-answer-card"><span>${esc(x.category)}</span><h3>${esc(x.question)}</h3><p>${esc(x.answer)}</p><a href="${esc(x.source)}">근거/도구</a></article>`).join('');
write(ansRel,`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>인테리어 견적 질문 ${answers.length}개 | 최신 검색 근거 허브</title><meta name="description" content="인테리어 견적·평수·공종·공공단가·검색 공개 기준을 최신 근거 페이지와 연결합니다."><link rel="canonical" href="${ansCanonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="견적검수실"><meta property="og:title" content="인테리어 견적 질문 ${answers.length}개"><meta property="og:description" content="최신 검색·데이터 근거 허브"><meta property="og:url" content="${ansCanonical}">${cssRef}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:'인테리어 견적 질문 최신 검색 근거 허브',url:ansCanonical,dateModified:reviewed})}</script></head><body class="v16-ui">${header}<main><section class="v62-data-hero"><div class="site-shell"><p class="kicker">ANSWER INDEX v16</p><h1>인테리어 견적 질문 ${answers.length}개</h1><p>검색 의도 대표 페이지와 최신 근거 연결 · 표본 미달 가격 생성 없음</p></div></section><section class="v14-section"><div class="site-shell"><div class="v10-answer-grid">${ansCards}</div></div></section></main>${footer}${jsRef}</body></html>`);

let candidates=[...new Set([...baseCandidates,ansRel])].sort();
const candidateSet=new Set(candidates);
const queryOwnerCount=new Map(candidates.map(p=>[p,0]));
const intentRows=[];
for(const q of queryMap.queries||[]){const raw=q.canonical||q.target||q.url;const p=targetPath(raw);if(p&&queryOwnerCount.has(p))queryOwnerCount.set(p,(queryOwnerCount.get(p)||0)+1);intentRows.push({query:q.query||'',intent:q.intent||'',owner:p,secondary:targetPath(q.secondary),publication:q.publication||'published',in_release_set:Boolean(p&&candidateSet.has(p))})}
const byQuery=new Map();for(const r of intentRows){if(!r.query)continue;if(!byQuery.has(r.query))byQuery.set(r.query,new Set());r.owner&&byQuery.get(r.query).add(r.owner)}
const intentConflicts=[...byQuery.entries()].filter(([,s])=>s.size>1).map(([query,s])=>({query,owners:[...s]}));
write('data/intent-owner-v16.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,query_count:intentRows.length,conflict_count:intentConflicts.length,conflicts:intentConflicts,rows:intentRows},null,2));

function role(p){if(p==='index.html')return'home';if(coreSet.has(p))return'core';if(p.startsWith('data/public-unit-cost/'))return'public_reference';if(['data/cost-index/index.html','data/construction-wage/index.html','data/sources/index.html','data/methodology/index.html'].includes(p))return'official_data';if(p.startsWith('guides/'))return'guide';if(p.startsWith('interior-cost/'))return'pyeong';if(p.startsWith('cost/'))return'trade';if(p.startsWith('quote-')||['calculator/index.html','checklist/index.html','one-set/index.html','cost-combination/index.html'].includes(p))return'tool';if(p.startsWith('data/answers-v16/'))return'answer';if(p==='about/index.html')return'about';if(p.startsWith('data/'))return'data';return'content'}
function internalLinks(h){return[...h.matchAll(/href="([^"]+)"/g)].map(x=>targetPath(x[1])).filter(Boolean)}
const inbound=new Map(candidates.map(p=>[p,0]));
for(const p of candidates){const h=read(p);for(const t of internalLinks(h))if(inbound.has(t))inbound.set(t,(inbound.get(t)||0)+1)}
function baseScore(r){return({home:30,core:27,public_reference:26,official_data:25,pyeong:24,trade:24,tool:22,answer:23,guide:18,about:12,data:12,content:12})[r]||10}
function scorePage(p){const h=read(p),r=role(p),text=strip(h),types=schemaTypes(h),inb=inbound.get(p)||0,q=queryOwnerCount.get(p)||0,external=(h.match(/href="https?:\/\//g)||[]).length;let score=baseScore(r);score+=text.length>=1800?20:text.length>=1200?16:text.length>=800?12:text.length>=500?8:0;score+=inb>=5?15:inb>=3?12:inb>=1?7:0;score+=title(h)&&desc(h)&&/<link rel="canonical"/i.test(h)?10:0;score+=types.length?10:0;score+=q>=2?10:q===1?7:0;score+=external>0||/출처|근거|공공|reviewed_on|표본 N/.test(text)?8:0;return Math.min(100,score)}
const hardHold=p=>((p.startsWith('region/')&&(quote.sample_count||0)<20)||(p==='data/quote-statistics/index.html'&&(quote.sample_count||0)<30)||['data/changelog/index.html','data/catalog/index.html','data/citations/index.html'].includes(p));
let rows=candidates.map(p=>{const s=scorePage(p),r=role(p);let wave=hardHold(p)?'HOLD':(coreSet.has(p)||p===ansRel||s>=80?'WAVE1':s>=65?'WAVE2':'HOLD');let reason=hardHold(p)?'하드게이트: 표본 또는 검색 역할 조건 미충족':wave==='WAVE1'?'첫 공개: 핵심 기능·근거 또는 준비도 기준 충족':wave==='WAVE2'?'두 번째 공개: 품질 충족, 첫 공개 내부 흐름 확인 후':'보류: 준비도 기준 보강 필요';return{path:p,url:previewUrl(p),role:r,score:s,wave,reason,text_chars:strip(read(p)).length,inbound:inbound.get(p)||0,query_owners:queryOwnerCount.get(p)||0,schema_types:schemaTypes(read(p))}});
const wave1=rows.filter(x=>x.wave==='WAVE1'),wave2=rows.filter(x=>x.wave==='WAVE2'),hold=rows.filter(x=>x.wave==='HOLD');
write('data/index-priority-v16.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,method:'technical launch readiness only; no search-volume or ranking-probability claim',source_candidates:candidates.length,wave1_count:wave1.length,wave2_count:wave2.length,hold_count:hold.length,official_source_update_required:Boolean(fresh.update_required),quote_sample_count:quote.sample_count||0,rows},null,2));

const home='index.html';let hh=read(home);const launchLinks=[['견적 검사','/quote-check/'],['평수별','/interior-cost/'],['공사별','/cost/'],['공공단가','/data/public-unit-cost/topics/'],['가이드','/guides/'],['공식 데이터','/data/'],['최신 답변','/data/answers-v16/']];if(!hh.includes('v16-wave-strip')){const stripHtml=`<section class="v16-wave-strip"><div class="site-shell"><div class="v16-wave-head"><span>INDEX RELEASE</span><strong>첫 공개 경로</strong></div>${launchLinks.slice(0,3).map(([n,p])=>`<a class="v16-wave-link" href="${BASE}${p}"><span>OPEN</span><strong>${n}</strong></a>`).join('')}</div></section><div class="site-shell"><nav class="v10-actions" aria-label="검색 공개 핵심 허브">${launchLinks.slice(3).map(([n,p])=>`<a href="${BASE}${p}">${n}</a>`).join('')}</nav></div>`;const pos=hh.indexOf('</section>',hh.indexOf('<main>'));if(pos>=0)hh=hh.slice(0,pos+10)+stripHtml+hh.slice(pos+10)}hh=hh.replace(/site-v15-bundle\.css[^\"]*/g,`site-v16-bundle.css?v=${bundleHash}`).replace(/app-v15-bundle\.js[^\"]*/g,`app-v16-bundle.js?v=${bundleHash}`).replace(/데이터 v15\.0\.0/g,'데이터 v16.0.0');write(home,hh)}
for(const x of rows){let h=read(x.path);h=h.replace(/site-v15-bundle\.css[^\"]*/g,`site-v16-bundle.css?v=${bundleHash}`).replace(/app-v15-bundle\.js[^\"]*/g,`app-v16-bundle.js?v=${bundleHash}`);if(!h.includes('data-v16-wave='))h=h.replace(/<body([^>]*)>/,`<body$1 data-v16-wave="${x.wave}" data-v16-score="${x.score}">`);write(x.path,h)}

function graphDepth(){const depth=new Map([[home,0]]),queue=[home];while(queue.length){const p=queue.shift(),d=depth.get(p);for(const t of internalLinks(read(p))){if(!exists(t)||depth.has(t))continue;depth.set(t,d+1);queue.push(t)}}return depth}
const depths=graphDepth();rows=rows.map(x=>({...x,click_depth:depths.has(x.path)?depths.get(x.path):null}));
for(const x of rows)if(x.wave==='WAVE1'&&(x.click_depth===null||x.click_depth>3)){x.wave='WAVE2';x.reason='두 번째 공개: 첫 공개 클릭 깊이 3단계 이내 조건 미충족'}
const finalWave1=rows.filter(x=>x.wave==='WAVE1'),finalWave2=rows.filter(x=>x.wave==='WAVE2'),finalHold=rows.filter(x=>x.wave==='HOLD');
write('data/index-priority-v16.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,method:'technical launch readiness only; no search-volume or ranking-probability claim',source_candidates:candidates.length,wave1_count:finalWave1.length,wave2_count:finalWave2.length,hold_count:finalHold.length,official_source_update_required:Boolean(fresh.update_required),quote_sample_count:quote.sample_count||0,rows},null,2));
write('data/crawl-depth-v16.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,home,reachable:depths.size,wave1_max_depth:Math.max(0,...finalWave1.map(x=>x.click_depth??99)),unreachable_wave1:finalWave1.filter(x=>x.click_depth===null).map(x=>x.path),rows:rows.map(x=>({path:x.path,wave:x.wave,depth:x.click_depth}))},null,2));
write('data/wave1-url-set-v16.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,simulation_only:true,actual_preview_noindex_unchanged:true,count:finalWave1.length,urls:finalWave1.map(x=>({path:x.path,url:x.url,score:x.score,role:x.role,depth:x.click_depth}))},null,2));
write('data/wave2-url-set-v16.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,count:finalWave2.length,urls:finalWave2.map(x=>({path:x.path,url:x.url,score:x.score,role:x.role,reason:x.reason}))},null,2));
write('data/hold-url-set-v16.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,count:finalHold.length,urls:finalHold.map(x=>({path:x.path,url:x.url,score:x.score,role:x.role,reason:x.reason}))},null,2));
const parts={core:[],tools:[],content:[],data:[]};for(const x of finalWave1){const k=x.role==='home'?'core':['tool','core'].includes(x.role)?'tools':['pyeong','trade','guide','content'].includes(x.role)?'content':'data';parts[k].push(x.url)}
for(const [k,urls] of Object.entries(parts))write(`data/sitemap-wave1-${k}-v16-preview.xml`,`<?xml version="1.0" encoding="UTF-8"?>\n<!-- SIMULATION ONLY -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
write('data/sitemap-wave1-index-v16-preview.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<!-- SIMULATION ONLY -->\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(parts).map(k=>`  <sitemap><loc>${SITE}/data/sitemap-wave1-${k}-v16-preview.xml</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`);
write('data/robots-wave1-v16-preview.txt',`# SIMULATION ONLY - NOT APPLIED\nUser-agent: *\nAllow: /\nSitemap: ${SITE}/data/sitemap-wave1-index-v16-preview.xml\n`);
const batches=[];for(let i=0;i<finalWave1.length;i+=12)batches.push({batch:batches.length+1,urls:finalWave1.slice(i,i+12).map(x=>x.url)});write('data/index-request-batches-v16.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,simulation_only:true,search_console_submitted:false,batch_size:12,batches},null,2));
write('data/v16-priority.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,bundle_hash:bundleHash,candidates:candidates.length,wave1:finalWave1.length,wave2:finalWave2.length,hold:finalHold.length,answers:answers.length,intent_conflicts:intentConflicts.length,wave1_max_depth:Math.max(0,...finalWave1.map(x=>x.click_depth??99)),source_update_required:Boolean(fresh.update_required)},null,2));
console.log(JSON.stringify(json('data/v16-priority.json',{}),null,2));
