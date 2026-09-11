import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='19.0.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const exists=r=>fs.existsSync(path.join(ROOT,r));
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const strip=s=>String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
const title=h=>(h.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'').trim();
const h1=h=>strip(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
const dup=a=>[...new Set(a.filter((v,i)=>v&&a.indexOf(v)!==i))];
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
const release18=json('data/release-url-set-v18.json',{urls:[],total_count:0});
const answers18=json('data/answer-index-v18.json',{answers:[],count:0});
const quote=json('data/quote-statistics.json',{sample_count:0});
const sourceFresh=json('data/source-freshness-v11.json',{update_required:false});
if(release18.total_count!==65||release18.urls?.length!==65)throw new Error(`v19 requires 65 v18 release candidates; got ${release18.urls?.length||0}`);

const css18=read('assets/site-v18-bundle.css');
const js18=read('assets/app-v18-bundle.js');
const css19=fs.readFileSync(path.join(CORE,'site-v19.css'),'utf8');
const js19=fs.readFileSync(path.join(CORE,'app-v19.js'),'utf8');
const bundleHash=crypto.createHash('sha1').update(css18+'\n'+css19+'\n'+js18+'\n'+js19).digest('hex').slice(0,12);
write('assets/site-v19-bundle.css',css18+'\n/* v19 browser UX */\n'+css19);
write('assets/app-v19-bundle.js',js18+'\n/* v19 browser UX */\n'+js19);
const cssRef=`<link rel="stylesheet" href="${BASE}/assets/site-v19-bundle.css?v=${bundleHash}">`;
const jsRef=`<script src="${BASE}/assets/app-v19-bundle.js?v=${bundleHash}" defer></script>`;

const v19Answers=[
 ['v19-live','UX','핵심 도구의 입력 상태를 어디서 확인하나요?','예산·견적 비교·견적 검사·체크리스트·텍스트 분류 도구 상단에 현재 입력 수, 미기재 수, 합계 또는 검토 필요 수를 실시간으로 표시합니다.','data/ux-v19/'],
 ['v19-no-fill','데이터','v19이 빈 금액이나 조건을 자동으로 채우나요?','아니요. v19은 사용자가 입력한 상태를 요약하고 필터링할 뿐 금액·수량·조건을 임의 평균값으로 채우지 않습니다.','data/ux-v19/'],
 ['v19-budget','도구','예산 설계에서 입력한 공종만 볼 수 있나요?','입력 공종만 보기 필터를 제공하며 계산 결과는 기존과 동일하게 사용자가 넣은 수량·단가·VAT 조건만 사용합니다.','calculator/'],
 ['v19-compare','도구','3견적 비교에서 조건 차이를 빨리 찾을 수 있나요?','기재 조건 수와 업체 간 상태가 다른 공종 수를 상단에서 실시간 집계하고 기존 다른 조건만 보기 필터를 바로 제어합니다.','quote-compare/'],
 ['v19-check','도구','견적 검사에서 미기재 항목만 볼 수 있나요?','미기재만 보기와 첫 미기재 항목 이동 기능을 제공하며 원문 견적에 없는 조건을 자동 확정하지 않습니다.','quote-check/'],
 ['v19-browser','품질','실제 브라우저에서도 65개 후보를 검사하나요?','Chromium에서 모바일 390×844와 데스크톱 1440×900으로 65개 출시 후보를 모두 열어 콘솔 오류, 가로 넘침, 본문 접근, v19 런타임 준비 상태를 검사합니다.','data/browser-v19/'],
 ['v19-touch','모바일','모바일 입력 버튼이 너무 작지 않은지 검사하나요?','텍스트 입력·선택·버튼에 모바일 최소 높이 규칙을 적용하고 핵심 도구의 실제 입력 동작을 Chromium에서 확인합니다.','data/browser-v19/'],
 ['v19-interaction','품질','브라우저 테스트는 페이지가 열리는지만 확인하나요?','아니요. 예산 합계 계산, A/B/C 입력 합계, 견적 검사 진행상태, 체크리스트 체크, 견적 텍스트 분류까지 실제 입력 이벤트를 실행합니다.','data/browser-v19/'],
 ['v19-shot','품질','모바일과 데스크톱 화면 기록도 남기나요?','홈·예산 설계·3견적 비교·견적 검사 대표 화면의 Chromium 스크린샷을 CI artifact로 남기도록 구성합니다.','data/browser-v19/'],
 ['v19-n','데이터','실제 민간 견적 표본 기준은 v19에서 바뀌나요?','바뀌지 않습니다. 전체 가격분포 N≥30, 세부 셀 N≥20을 유지하며 현재 N=0이므로 민간 가격분포를 만들지 않습니다.','data/methodology/'],
 ['v19-release','운영','v19 브라우저 검증을 통과하면 바로 색인되나요?','아니요. 브라우저 검증은 출시 후보 품질 게이트일 뿐 preview noindex, 실제 robots·sitemap·Search Console·AdSense는 소유자 승인 전까지 변경하지 않습니다.','data/launch-gate-v19/'],
 ['v19-visual','디자인','v19에서 화려한 애니메이션이나 카드형 장식을 늘리나요?','아니요. 실시간 상태·입력 필터·포커스 이동처럼 기능적인 요소만 추가하고 그라데이션·애니메이션·의미 없는 게이지는 넣지 않습니다.','data/ux-v19/']
].map(([id,category,question,answer,src])=>({id,category,question,answer,source:`${BASE}/${src}`,url:`${BASE}/${src}`,status:'published'}));
const answerMap=new Map();for(const x of [...(answers18.answers||[]),...v19Answers])answerMap.set(x.id||x.question,x);const answers=[...answerMap.values()];
write('data/answer-index-v19.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,count:answers.length,answers},null,2));

const template=read('data/index.html');
const header=template.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=template.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const answerPath='data/answers-v19/index.html';
const answerCanonical=SITE+'/data/answers-v19/';
const answerCards=answers.map(x=>`<article class="v10-answer-card"><span>${esc(x.category)}</span><h3>${esc(x.question)}</h3><p>${esc(x.answer)}</p><a href="${esc(x.source)}">근거/도구</a></article>`).join('');
write(answerPath,`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>인테리어 견적 질문 ${answers.length}개 | v19 브라우저 검수 답변</title><meta name="description" content="인테리어 견적·평수·공종·공공 참고단가와 v19 실제 브라우저 UX 검수 질문을 대표 근거에 연결합니다."><meta property="og:title" content="인테리어 견적 질문 ${answers.length}개 | v19"><meta property="og:description" content="v19 브라우저 검수·도구 UX 근거 허브"><meta property="og:url" content="${answerCanonical}"><link rel="canonical" href="${answerCanonical}">${cssRef}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:'인테리어 견적 질문 v19 브라우저 검수 답변',url:answerCanonical,dateModified:reviewed})}</script></head><body class="v19-audit-page v19-release-candidate" data-v19-role="answer" data-v19-path="${answerPath}"><a class="v18-skip" href="#main-content">본문 바로가기</a>${header}<main id="main-content"><section class="v62-data-hero"><div class="site-shell"><p class="kicker">ANSWER INDEX V19</p><h1>인테리어 견적 질문 ${answers.length}개</h1><p>검색 근거 · 실제 브라우저 검수 · 도구 UX</p></div></section><section class="v14-section"><div class="site-shell"><div class="v10-answer-grid">${answerCards}</div></div></section></main>${footer}${jsRef}</body></html>`);

const releaseUrls=release18.urls.map(x=>x.path==='data/answers-v18/index.html'?{...x,path:answerPath,url:answerCanonical,role:'answer',primary_intent:`인테리어 견적 질문 ${answers.length}개`}:{...x});
const releaseSet=new Set(releaseUrls.map(x=>x.path));
for(const x of releaseUrls){
  if(!exists(x.path))throw new Error(`v19 release page missing: ${x.path}`);
  let h=read(x.path);
  h=h.replace(/<link rel="stylesheet" href="[^"]*site-v18-bundle\.css[^"]*">/g,cssRef).replace(/<script src="[^"]*app-v18-bundle\.js[^"]*" defer><\/script>/g,jsRef);
  if(!h.includes('site-v19-bundle.css'))h=h.replace('</head>',cssRef+'</head>');
  if(!h.includes('app-v19-bundle.js'))h=h.replace('</body>',jsRef+'</body>');
  if(/<body\b/.test(h)&&!h.includes('data-v19-path='))h=h.replace(/<body([^>]*)>/,`<body$1 data-v19-role="${esc(x.role||'content')}" data-v19-path="${esc(x.path)}">`);
  if(!/\bv19-release-candidate\b/.test(h))h=h.replace(/<body([^>]*)class="([^"]*)"/,`<body$1class="$2 v19-release-candidate"`);
  write(x.path,h);
}
write('data/release-url-set-v19.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,simulation_only:true,actual_preview_noindex_unchanged:true,total_count:releaseUrls.length,urls:releaseUrls},null,2));

const tools=[
 {path:'calculator/index.html',name:'예산 설계',root:'data-budget-builder',summary:'budget',core:['data-budget-total','data-unit-price']},
 {path:'quote-compare/index.html',name:'3견적 비교',root:'data-compare-table',summary:'compare',core:['data-compare-row','data-vendor']},
 {path:'quote-check/index.html',name:'견적 검사',root:'data-quote-form',summary:'quote-check',core:['data-qrow','data-context']},
 {path:'checklist/index.html',name:'계약 체크리스트',root:'data-checklist',summary:'checklist',core:['data-check-id']},
 {path:'quote-paste/index.html',name:'견적 텍스트 분류',root:'data-v10-paste-tool',summary:'paste',core:['data-v10-paste','data-v10-run']}
];
const toolRows=tools.map(t=>{const h=read(t.path);return{...t,exists:true,root_present:h.includes(t.root),core_present:t.core.every(k=>h.includes(k)),v19_bundle:h.includes('site-v19-bundle.css')&&h.includes('app-v19-bundle.js')}});
write('data/tool-ux-audit-v19.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,total:toolRows.length,ready:toolRows.filter(x=>x.root_present&&x.core_present&&x.v19_bundle).length,no_autofill:true,rows:toolRows},null,2));
write('data/ux-contract-v19.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,principles:['no automatic market-price fill','live input-state summary','filter without mutating values','keyboard focus path','mobile minimum control height'],tools:toolRows.map(x=>({path:x.path,name:x.name,summary:x.summary})),actual_quote_rows_public:false,market_average_fabrication:false},null,2));

const browserContract={version:VERSION,reviewed_on:reviewed,release_count:65,engine:'Chromium',viewports:[{name:'mobile',width:390,height:844},{name:'desktop',width:1440,height:900}],all_release_checks:['HTTP success','pageerror zero','console.error zero','horizontal viewport overflow zero','H1 present','main#main-content present','v19 runtime ready'],mobile_checks:['text/select/button minimum control height','table wrappers contain wide tables'],interaction_checks:['calculator total','A/B/C quote totals','quote-check live progress','checklist live progress','quote text classification'],screenshots:['mobile-home.png','mobile-calculator.png','mobile-quote-compare.png','desktop-home.png'],ci_only:true,production_switch:false};
write('data/browser-contract-v19.json',JSON.stringify(browserContract,null,2));
write('data/visual-routes-v19.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,routes:[{path:'index.html',name:'home'},{path:'calculator/index.html',name:'calculator'},{path:'quote-compare/index.html',name:'quote-compare'},{path:'quote-check/index.html',name:'quote-check'}],artifact_only:true},null,2));

const releaseAudit=releaseUrls.map(x=>{const h=read(x.path);const css=(h.match(/site-v19-bundle\.css/g)||[]).length,js=(h.match(/app-v19-bundle\.js/g)||[]).length;return{path:x.path,role:x.role||'content',phase:x.phase||'',css_bundle_refs:css,js_bundle_refs:js,noindex:/meta name="robots" content="[^"]*noindex/i.test(h),canonical:/<link rel="canonical" href="[^"]+"/i.test(h),main:/<main[^>]*id="main-content"/i.test(h),skip:/href="#main-content"/.test(h),v19_path:h.includes('data-v19-path=')}});
write('data/release-browser-readiness-v19.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,total:releaseAudit.length,static_ready:releaseAudit.filter(x=>x.css_bundle_refs===1&&x.js_bundle_refs===1&&x.noindex&&x.canonical&&x.main&&x.skip&&x.v19_path).length,rows:releaseAudit},null,2));

const common=`<p>v19은 검색 후보를 더 늘리지 않고 v18에서 확정한 65개를 실제 사용자 화면과 도구 동작 기준으로 다시 검수합니다. 계산기와 견적 도구는 빈 값을 시장평균으로 채우지 않으며 사용자가 입력한 값, 포함·별도·미기재 상태와 로컬 분류 결과만 요약합니다.</p><p>실제 민간 견적은 현재 N=${quote.sample_count||0}입니다. 전체 가격분포 N≥30, 세부 셀 N≥20 기준을 유지하고 공공 표준시장단가는 REFERENCE 자료로만 표시하며 민간 아파트 인테리어 적정가격으로 환산하지 않습니다.</p><p>브라우저 검증은 로컬 정적 프리뷰를 Chromium으로 열어 모바일 390×844와 데스크톱 1440×900을 검사합니다. 실제 production robots·root sitemap·Search Console 제출·AdSense 삽입은 이 배치에서 수행하지 않습니다.</p>`;
const pageHead=(t,d,r)=>`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>${esc(t)}</title><meta name="description" content="${esc(d)}"><link rel="canonical" href="${SITE}/${r.replace(/index\.html$/,'')}">${cssRef}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:t.replace(/ \|.*$/,''),url:`${SITE}/${r.replace(/index\.html$/,'')}`,dateModified:reviewed})}</script></head><body class="v19-audit-page"><a class="v18-skip" href="#main-content">본문 바로가기</a>`;
const makePage=(r,t,k,d,b)=>write(r,`${pageHead(t,d,r)}${header}<main id="main-content"><section class="v62-data-hero"><div class="site-shell"><p class="kicker">${k}</p><h1>${esc(t.replace(/ \|.*$/,''))}</h1><p>${esc(d)}</p></div></section><section class="v14-section"><div class="site-shell">${b}${common}</div></section></main>${footer}${jsRef}</body></html>`);
const kpis=(items)=>`<div class="v19-kpis">${items.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`;
makePage('data/ux-v19/index.html','v19 핵심 도구 UX 감사 | 입력 상태·필터·포커스','TOOL UX V19','빈 값을 자동 생성하지 않고 입력 상태를 더 빠르게 확인하는 핵심 도구 UX를 검사합니다.',`${kpis([['핵심 도구',String(toolRows.length)],['정적 준비',String(toolRows.filter(x=>x.root_present&&x.core_present&&x.v19_bundle).length)],['자동 평균 채움','0'],['실제 견적 N',String(quote.sample_count||0)]])}<div class="table-wrap"><table class="v19-audit-table"><thead><tr><th>도구</th><th>루트</th><th>핵심 필드</th><th>v19 번들</th></tr></thead><tbody>${toolRows.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.root_present?'PASS':'FAIL'}</td><td>${x.core_present?'PASS':'FAIL'}</td><td>${x.v19_bundle?'PASS':'FAIL'}</td></tr>`).join('')}</tbody></table></div>`);
makePage('data/browser-v19/index.html','v19 실제 브라우저 검증 계약 | 모바일·데스크톱 Chromium','BROWSER QA V19','65개 출시 후보를 실제 Chromium에서 모바일과 데스크톱으로 열고 도구 입력까지 검증하는 CI 계약입니다.',`${kpis([['출시 후보','65'],['모바일','390×844'],['데스크톱','1440×900'],['핵심 동작','5개']])}<h2>실제 CI 검사</h2><p>페이지 오류와 console.error, 가로 넘침, H1·main·본문 바로가기, v19 런타임 준비를 65개 전체에서 확인합니다. 핵심 도구는 실제 값을 입력해 계산·상태 요약·분류 결과가 갱신되는지 확인합니다.</p><h2>화면 기록</h2><p>홈·예산 설계·3견적 비교의 모바일 화면과 홈 데스크톱 화면을 CI artifact로 저장합니다. 이 페이지 자체는 브라우저 실행 결과를 꾸며서 표시하지 않으며 CI 성공 여부를 별도 품질 게이트로 사용합니다.</p>`);
makePage('data/launch-gate-v19/index.html','v19 실제 화면 출시 게이트 | 65개 브라우저 검수','LAUNCH GATE V19','정적 품질과 실제 Chromium 검증을 함께 통과해야 하는 검색 출시 직전 게이트입니다.',`${kpis([['후보','65'],['핵심 도구','5'],['답변',String(answers.length)],['브라우저 CI','필수']])}<h2>게이트 범위</h2><p>정적 생성 단계에서는 release set·번들·noindex·canonical·Thin·중복·공식 출처 상태를 검사합니다. 별도 browser CI에서는 65개 모바일/데스크톱 로딩과 핵심 도구 동작을 실제 Chromium에서 검사합니다.</p>`);

function allHtml(){const out=[];const walk=(d,b='')=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const r=path.posix.join(b,e.name),f=path.join(d,e.name);if(e.isDirectory())walk(f,r);else if(e.name.endsWith('.html'))out.push(r)}};walk(ROOT);return out.sort()}
const all=allHtml(),rows=all.map(p=>({p,h:read(p)}));
const quality={version:VERSION,reviewed_on:reviewed,pages:all.length,release_candidates:releaseUrls.length,release_static_ready:releaseAudit.filter(x=>x.css_bundle_refs===1&&x.js_bundle_refs===1&&x.noindex&&x.canonical&&x.main&&x.skip&&x.v19_path).length,key_tools:toolRows.length,key_tools_ready:toolRows.filter(x=>x.root_present&&x.core_present&&x.v19_bundle).length,answer_count:answers.length,thin_under_500:rows.filter(x=>strip(x.h).length<500).length,duplicate_titles:dup(rows.map(x=>title(x.h))).length,duplicate_h1:dup(rows.map(x=>h1(x.h))).length,noindex_pages:rows.filter(x=>/meta name="robots" content="[^"]*noindex/i.test(x.h)).length,canonical_pages:rows.filter(x=>/<link rel="canonical" href="[^"]+"/i.test(x.h)).length,quote_sample_count:quote.sample_count||0,official_source_update_required:Boolean(sourceFresh.update_required),browser_ci_required:true,browser_ci_passed_at_build:null,actual_production_switch:false,actual_search_console_submission:false,actual_ads_injected:false};
const checks={release_count_65:quality.release_candidates===65,release_static_all:quality.release_static_ready===65,key_tools_ready:quality.key_tools_ready===5,answer_count_185:quality.answer_count>=185,thin_zero:quality.thin_under_500===0,unique_titles:quality.duplicate_titles===0,unique_h1:quality.duplicate_h1===0,noindex_all:quality.noindex_pages===quality.pages,canonical_all:quality.canonical_pages===quality.pages,quote_n_gate_preserved:quality.quote_sample_count===0,official_sources_current:quality.official_source_update_required===false,production_off:quality.actual_production_switch===false,search_console_off:quality.actual_search_console_submission===false,ads_off:quality.actual_ads_injected===false,browser_ci_required:quality.browser_ci_required===true};
write('data/site-quality-v19.json',JSON.stringify(quality,null,2));
write('data/launch-gate-v19.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,status:'browser_ux_preview',checks,browser_ci:{required:true,result:'external_workflow'},approval:{production_origin:true,robots:true,sitemap:true,search_console_submission:true,ads:true}},null,2));
write('data/v19-report.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,release_candidates:65,key_tools:5,answers:answers.length,bundle_hash:bundleHash,checks},null,2));
let home=read('index.html');if(!home.includes('v19-compat-marker'))home=home.replace('</body>','<!-- v19-compat-marker: 데이터 v19.0.0 -->\n</body>');write('index.html',home);
let ll=read('llms.txt');if(!ll.includes('v19 browser ux'))ll+=`\n\n## v19 browser ux\n- Release set: ${BASE}/data/release-url-set-v19.json\n- Tool UX audit: ${BASE}/data/tool-ux-audit-v19.json\n- Browser contract: ${BASE}/data/browser-contract-v19.json\n- Browser CI tests all 65 release candidates at mobile and desktop viewports.\n- Preview remains noindex; production/Search Console/ads require owner approval.\n`;write('llms.txt',ll);
const failed=Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k);if(failed.length)throw new Error(`v19 static gate failed ${JSON.stringify({failed,quality})}`);console.log(JSON.stringify({version:VERSION,quality,checks},null,2));
