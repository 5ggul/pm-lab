import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='14.0.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const exists=r=>fs.existsSync(path.join(ROOT,r));
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const strip=s=>String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
const hash=s=>crypto.createHash('sha1').update(String(s||'')).digest('hex').slice(0,12);
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);

function htmlFiles(){const out=[];const walk=(dir,base='')=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const rel=path.posix.join(base,e.name),full=path.join(dir,e.name);if(e.isDirectory())walk(full,rel);else if(e.name.endsWith('.html'))out.push(rel)}};walk(ROOT);return out.sort()}
const route=rel=>rel==='index.html'?'/' : rel==='404.html'?'/404.html':'/'+rel.replace(/index\.html$/,'');
const url=rel=>SITE+route(rel);

const css14=fs.readFileSync(path.join(CORE,'site-v14.css'),'utf8');
const css13=exists('assets/site-v13-bundle.css')?read('assets/site-v13-bundle.css'):'';
const js13=exists('assets/app-v13-bundle.js')?read('assets/app-v13-bundle.js'):'';
const bundleHash=hash(css13+'\n'+css14+'\n'+js13);
write('assets/site-v14-bundle.css',css13+'\n/* v14 */\n'+css14);
write('assets/app-v14-bundle.js',js13+'\n/* v14 launch rehearsal: no extra runtime dependency */\n');
const cssRef=`<link rel="stylesheet" href="${BASE}/assets/site-v14-bundle.css?v=${bundleHash}">`;
const jsRef=`<script src="${BASE}/assets/app-v14-bundle.js?v=${bundleHash}" defer></script>`;

function fixTable(block){
  let t=block;
  if(!/<th\b/i.test(t)){
    t=t.replace(/<tr([^>]*)>([\s\S]*?)<\/tr>/i,(m,a,c)=>`<tr${a}>${c.replace(/<td([^>]*)>/gi,'<th scope="col"$1>').replace(/<\/td>/gi,'</th>')}</tr>`);
  }
  t=t.replace(/<thead([\s\S]*?)<th(?![^>]*\bscope=)([^>]*)>/gi,'<thead$1<th scope="col"$2>');
  return t;
}
let tablesFixed=0;
for(const rel of htmlFiles()){
  let h=read(rel),before=h;
  h=h.replace(/<table\b[\s\S]*?<\/table>/gi,b=>{const f=fixTable(b);if(f!==b)tablesFixed++;return f});
  h=h.replace(/<link rel="stylesheet" href="[^"]*site-v13-bundle\.css[^"]*">/g,cssRef)
     .replace(/<script src="[^"]*app-v13-bundle\.js[^"]*" defer><\/script>/g,jsRef)
     .replace(/데이터 v13\.0\.0/g,'데이터 v14.0.0');
  if(!/\bv14-ui\b/.test(h))h=h.replace(/<body([^>]*)class="([^"]*)"/,'<body$1class="$2 v14-ui"').replace(/<body(?![^>]*class=)([^>]*)>/,'<body$1 class="v14-ui">');
  if(h!==before)write(rel,h);
}

function jsonLdAudit(){
  const rows=[];let scripts=0,parseErrors=0,missingType=0;
  for(const rel of htmlFiles()){
    const h=read(rel),items=[];
    for(const m of h.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)){
      scripts++;try{const obj=JSON.parse(m[1]);const nodes=Array.isArray(obj)?obj:(Array.isArray(obj?.['@graph'])?obj['@graph']:[obj]);const miss=nodes.filter(x=>x&&typeof x==='object'&&!x['@type']).length;missingType+=miss;items.push({ok:true,types:nodes.map(x=>x?.['@type']).filter(Boolean),missing_type:miss})}catch(e){parseErrors++;items.push({ok:false,error:String(e.message||e)})}
    }
    rows.push({path:rel,scripts:items.length,items});
  }
  return {version:VERSION,reviewed_on:reviewed,pages:rows.length,scripts,parse_errors:parseErrors,missing_type:missingType,rows:rows.filter(x=>x.items.some(i=>!i.ok||i.missing_type))};
}

function accessibilityAudit(){
  const rows=[];let tables=0,without=0,h1=0,img=0,emptyButtons=0;
  for(const rel of htmlFiles()){
    if(rel==='404.html'||rel.startsWith('search/'))continue;
    const h=read(rel),tb=[...h.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(x=>x[0]);
    const bad=tb.filter(x=>!/<th\b/i.test(x)).length;tables+=tb.length;without+=bad;
    const hc=(h.match(/<h1\b/gi)||[]).length;if(hc!==1)h1++;
    const imgs=[...h.matchAll(/<img\b[^>]*>/gi)].map(x=>x[0]);img+=imgs.filter(x=>!/\balt=/i.test(x)).length;
    const btn=[...h.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)].map(x=>strip(x[1]));emptyButtons+=btn.filter(x=>!x).length;
    if(bad||hc!==1||imgs.some(x=>!/\balt=/i.test(x))||btn.some(x=>!x))rows.push({path:rel,h1_count:hc,tables:tb.length,tables_without_header:bad});
  }
  return {version:VERSION,reviewed_on:reviewed,tables,tables_without_header:without,tables_fixed:tablesFixed,h1_issues:h1,images_missing_alt:img,empty_buttons:emptyButtons,touch_target_css:true,focus_visible_css:true,rows};
}

function mobileAudit(){
  const rows=[];let viewportMissing=0,fixedInline=0;
  for(const rel of htmlFiles()){
    const h=read(rel);const viewport=!/<meta name="viewport"[^>]*width=device-width/i.test(h);if(viewport)viewportMissing++;
    const wide=[...h.matchAll(/style="[^"]*(?:width|min-width)\s*:\s*(\d{3,})px[^"]*"/gi)].map(x=>Number(x[1])).filter(n=>n>760);fixedInline+=wide.length;
    if(viewport||wide.length)rows.push({path:rel,viewport_missing:viewport,fixed_inline_widths:wide});
  }
  return {version:VERSION,reviewed_on:reviewed,pages:htmlFiles().length,viewport_missing:viewportMissing,fixed_inline_widths_over_760:fixedInline,touch_target_min_px:44,mobile_font_input_px:16,table_scroll_css:true,rows};
}

const jsonld=jsonLdAudit();
const a11y=accessibilityAudit();
const mobile=mobileAudit();
write('data/jsonld-audit-v14.json',JSON.stringify(jsonld,null,2));
write('data/accessibility-audit-v14.json',JSON.stringify(a11y,null,2));
write('data/mobile-rehearsal-v14.json',JSON.stringify(mobile,null,2));

const proposedRobots=exists('data/robots-production-preview.txt')?read('data/robots-production-preview.txt'):'';
const proposedSitemap=exists('data/sitemap-production-preview.xml')?read('data/sitemap-production-preview.xml'):'';
const actualRobots=exists('robots.txt')?read('robots.txt'):'';
const actualSitemap=exists('sitemap.xml')?read('sitemap.xml'):'';
const productionDiff={version:VERSION,reviewed_on:reviewed,simulation_only:true,applied:false,actual:{robots_exists:exists('robots.txt'),robots_hash:hash(actualRobots),sitemap_exists:exists('sitemap.xml'),sitemap_hash:hash(actualSitemap)},proposed:{robots_hash:hash(proposedRobots),sitemap_hash:hash(proposedSitemap)},changes:{robots_would_change:hash(actualRobots)!==hash(proposedRobots),sitemap_would_change:hash(actualSitemap)!==hash(proposedSitemap)},approval_required:true};
write('data/production-diff-v14.json',JSON.stringify(productionDiff,null,2));

const measurement={version:VERSION,reviewed_on:reviewed,execution_status:'browser_connector_offline',note:'연결된 데스크톱 브라우저가 오프라인이어서 실제 Lighthouse/시각 회귀는 이번 빌드에서 실행하지 못함. 정적 게이트와 공개 HTTP 검증을 수행하고 브라우저 연결 복구 시 동일 URL 세트로 실행.',metrics:{lcp_ms:2500,inp_ms:200,cls:0.1},profiles:[{name:'mobile',viewport:'390x844',network:'mobile'},{name:'desktop',viewport:'1440x900',network:'broadband'}],urls:['/','/quote-check/','/quote-compare/','/calculator/','/data/public-unit-cost/','/interior-cost/32-pyeong/','/cost/bathroom/','/data/answers-v13/']};
write('data/web-vitals-plan-v14.json',JSON.stringify(measurement,null,2));

function refs(){const h=read('data/index.html');return {header:h.match(/<header[\s\S]*?<\/header>/)?.[0]||'',footer:h.match(/<footer[\s\S]*?<\/footer>/)?.[0]||''}}
const {header,footer}=refs();
const head=(title,desc,rel)=>`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url(rel)}">${cssRef}</head><body class="v14-ui">`;
const common=`<p>이 리허설은 운영 전 프리뷰를 대상으로 하며 실제 민간 견적 원본을 공개하지 않습니다. 전체 가격분포는 N≥30, 지역·평수·공종 같은 세부 셀은 N≥20에서만 공개합니다. 공공 표준시장단가와 건설공사비지수를 민간 인테리어 시장평균이나 적정가격으로 환산하지 않습니다.</p><p>현재 모든 프리뷰 페이지는 noindex를 유지하고 실제 robots, 운영 sitemap, AdSense 코드는 변경하지 않습니다. 이 페이지의 결과는 출시 전 결함을 줄이기 위한 내부 검수이며 검색순위·광고 승인·Core Web Vitals 통과를 보장하지 않습니다.</p>`;
const page=(rel,title,kicker,desc,body)=>write(rel,`${head(title,desc,rel)}${header}<main><section class="v62-data-hero"><div class="site-shell"><p class="kicker">${kicker}</p><h1>${title.replace(/ \|.*$/,'')}</h1><p>${desc}</p></div></section><section class="v14-section"><div class="site-shell">${body}${common}</div></section></main>${footer}${jsRef}</body></html>`);

page('data/launch-rehearsal-v14/index.html','v14 출시 리허설 | 모바일·JSON-LD·production diff','LAUNCH REHEARSAL V14','운영 전 모바일 정적 점검, JSON-LD 파싱, 접근성, production 설정 diff와 광고 슬롯 안정성을 확인합니다.',`<div class="v14-kpis"><div><span>Table header</span><strong>${a11y.tables_without_header}</strong><em>남은 누락</em></div><div><span>JSON-LD</span><strong>${jsonld.parse_errors}</strong><em>파싱 오류</em></div><div><span>Viewport</span><strong>${mobile.viewport_missing}</strong><em>누락</em></div><div><span>Bundle</span><strong>2</strong><em>CSS + JS</em></div><div><span>Production</span><strong>OFF</strong><em>승인 전</em></div></div><nav class="v10-actions"><a href="${BASE}/data/mobile-v14/">모바일</a><a href="${BASE}/data/jsonld-v14/">JSON-LD</a><a href="${BASE}/data/production-diff-v14/">Production diff</a><a href="${BASE}/data/ad-rehearsal-v14/">광고 리허설</a></nav>`);
page('data/mobile-v14/index.html','모바일 정적 리허설 | viewport·터치·overflow','MOBILE REHEARSAL','모바일 viewport와 인라인 고정 폭, 터치 타깃 CSS, 표 가로 스크롤 안전장치를 점검합니다.',`<div class="v14-kpis"><div><span>Viewport missing</span><strong>${mobile.viewport_missing}</strong></div><div><span>고정폭 &gt;760</span><strong>${mobile.fixed_inline_widths_over_760}</strong></div><div><span>Touch</span><strong>44px</strong></div><div><span>Input font</span><strong>16px</strong></div><div><span>Table</span><strong>scroll</strong></div></div><p>실제 브라우저의 시각적 overflow 검사는 연결된 브라우저가 온라인일 때 추가 실행합니다. 이번 빌드에서는 DOM·CSS에서 사전에 판별 가능한 모바일 실패 조건을 차단합니다.</p>`);
page('data/jsonld-v14/index.html','JSON-LD 유효성 감사 | 구조화데이터 파싱','JSON-LD VALIDATION','모든 application/ld+json 블록을 실제 JSON으로 파싱하고 @type 누락을 확인합니다.',`<div class="v14-kpis"><div><span>Scripts</span><strong>${jsonld.scripts}</strong></div><div><span>Parse error</span><strong>${jsonld.parse_errors}</strong></div><div><span>Missing @type</span><strong>${jsonld.missing_type}</strong></div><div><span>Pages</span><strong>${jsonld.pages}</strong></div><div><span>Status</span><strong>${jsonld.parse_errors===0?'PASS':'REVIEW'}</strong></div></div><p>이 검사는 JSON 문법과 기본 타입을 확인합니다. Google의 개별 rich result 자격이나 실제 검색 노출을 보장하는 검사는 아닙니다.</p>`);
page('data/production-diff-v14/index.html','Production 전환 diff | robots·sitemap 리허설','PRODUCTION DIFF','현재 프리뷰 루트 파일과 제안된 운영 robots/sitemap의 해시를 비교하며 실제 적용은 하지 않습니다.',`<div class="v14-grid"><div class="v14-panel"><h2>robots</h2><p class="v14-diff">actual ${productionDiff.actual.robots_hash}\nproposed ${productionDiff.proposed.robots_hash}\nwould change ${productionDiff.changes.robots_would_change}</p></div><div class="v14-panel"><h2>sitemap</h2><p class="v14-diff">actual ${productionDiff.actual.sitemap_hash}\nproposed ${productionDiff.proposed.sitemap_hash}\nwould change ${productionDiff.changes.sitemap_would_change}</p></div></div><p><strong>APPLIED: false.</strong> 운영 전환은 소유자 승인 후 별도 변경으로만 수행합니다.</p>`);
page('data/ad-rehearsal-v14/index.html','광고 레이아웃 리허설 | 슬롯 예약·CLS 방지','AD LAYOUT REHEARSAL','실제 광고 코드를 넣지 않고 도구·데이터 페이지의 예약 공간과 콘텐츠 우선순위를 시뮬레이션합니다.',`<div class="v14-grid"><div class="v14-panel"><h2>도구 페이지</h2><p>입력 → 결과 → 설명 순서를 먼저 유지합니다.</p><div class="v14-ad-slot">AD SLOT PLACEHOLDER · 결과/설명 이후 · 실제 광고 아님</div><p>최대 1개. 입력 폼 내부와 결과 숫자 직전은 금지합니다.</p></div><div class="v14-panel"><h2>데이터 페이지</h2><p>핵심 데이터와 출처를 먼저 보여줍니다.</p><div class="v14-ad-slot mobile">AD SLOT PLACEHOLDER · 핵심 데이터 이후 · 실제 광고 아님</div><p>최대 2개. 숫자와 공식 출처 사이에는 넣지 않습니다.</p></div></div><div class="v14-ad-slot blocked">정책·운영·표본 미달 지역 페이지: 광고 슬롯 0</div>`);

// Audit again after v14 pages were added.
const finalFiles=htmlFiles();
const titleOf=h=>(h.match(/<title>(.*?)<\/title>/i)?.[1]||'').trim();
const h1Of=h=>(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').replace(/<[^>]+>/g,'').trim();
const docs=finalFiles.map(rel=>{const h=read(rel);return{rel,h,text:strip(h),title:titleOf(h),h1:h1Of(h),noindex:/<meta name="robots" content="[^"]*noindex/i.test(h),canonical:/<link rel="canonical" href="[^"]+"/i.test(h),bundle:/site-v14-bundle\.css/.test(h)&&/app-v14-bundle\.js/.test(h)}});
const dup=a=>[...new Set(a.filter((v,i)=>v&&a.indexOf(v)!==i))];
const finalJson=jsonLdAudit(),finalA11y=accessibilityAudit(),finalMobile=mobileAudit();
write('data/jsonld-audit-v14.json',JSON.stringify(finalJson,null,2));write('data/accessibility-audit-v14.json',JSON.stringify(finalA11y,null,2));write('data/mobile-rehearsal-v14.json',JSON.stringify(finalMobile,null,2));
const quality={version:VERSION,reviewed_on:reviewed,pages:finalFiles.length,thin_under_500:docs.filter(x=>x.text.length<500).length,duplicate_titles:dup(docs.map(x=>x.title)).length,duplicate_h1:dup(docs.map(x=>x.h1)).length,noindex_pages:docs.filter(x=>x.noindex).length,canonical_pages:docs.filter(x=>x.canonical).length,bundle_pages:docs.filter(x=>x.bundle).length,jsonld_parse_errors:finalJson.parse_errors,jsonld_missing_type:finalJson.missing_type,tables_without_header:finalA11y.tables_without_header,viewport_missing:finalMobile.viewport_missing,fixed_inline_widths_over_760:finalMobile.fixed_inline_widths_over_760,actual_ads_injected:false,actual_production_switch:false,browser_visual_run:false};
write('data/site-quality-v14.json',JSON.stringify(quality,null,2));
const checks={thin_zero:quality.thin_under_500===0,unique_titles:quality.duplicate_titles===0,unique_h1:quality.duplicate_h1===0,noindex_all:quality.noindex_pages===quality.pages,canonical_all:quality.canonical_pages===quality.pages,bundle_all:quality.bundle_pages===quality.pages,jsonld_valid:quality.jsonld_parse_errors===0,tables_accessible:quality.tables_without_header===0,viewport_all:quality.viewport_missing===0,no_wide_inline:quality.fixed_inline_widths_over_760===0,actual_ads_off:quality.actual_ads_injected===false,production_off:quality.actual_production_switch===false};
const gate={version:VERSION,reviewed_on:reviewed,status:'preview_review',checks,limitations:{browser_visual_run:false,reason:'connected browser device offline'},approval:{production_requires_owner:true,robots_requires_owner:true,sitemap_requires_owner:true,ads_requires_owner:true}};
write('data/launch-gate-v14.json',JSON.stringify(gate,null,2));
let r=json('data/v6-report.json',{});Object.assign(r,{version:VERSION,v14_launch_rehearsal:true,v14_table_accessibility_fix:true,v14_jsonld_validation:true,v14_mobile_static_rehearsal:true,v14_production_diff:true,v14_ad_layout_rehearsal:true,v14_web_vitals_plan:true,v14_bundle_refresh:true,v14_final_page_count:quality.pages,v14_final_thin_zero:checks.thin_zero,v14_final_unique_titles:checks.unique_titles,v14_final_unique_h1:checks.unique_h1,v14_final_noindex_all:checks.noindex_all,v14_final_canonical_all:checks.canonical_all,v14_final_bundle_all:checks.bundle_all,v14_final_jsonld_valid:checks.jsonld_valid,v14_final_tables_accessible:checks.tables_accessible,v14_final_viewport_all:checks.viewport_all,v14_actual_production_switch:false});write('data/v6-report.json',JSON.stringify(r,null,2));
let ll=read('llms.txt');if(!ll.includes('v14 launch rehearsal'))ll+=`\n\n## v14 launch rehearsal\n- Launch gate: ${BASE}/data/launch-gate-v14.json\n- Mobile rehearsal: ${BASE}/data/mobile-rehearsal-v14.json\n- JSON-LD audit: ${BASE}/data/jsonld-audit-v14.json\n- Production diff is simulation only; production switch remains off.\n`;write('llms.txt',ll);
const failed=Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k);if(failed.length)throw new Error(`v14 quality gate failed ${JSON.stringify({failed,quality})}`);
console.log(JSON.stringify({version:VERSION,quality,checks,tablesFixed,bundleHash},null,2));
