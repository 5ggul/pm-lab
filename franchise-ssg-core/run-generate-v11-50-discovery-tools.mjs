import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE='/pm-lab/franchise-ssg-preview';
const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
if(manifest.uiVersion!=='11.49')throw new Error(`v11.50 requires v11.49 baseline, got ${manifest.uiVersion}`);
if(Number(snap.brand_count)!==136||Number(snap.category_count)!==20||candidates.length!==184)throw new Error(`v11.50 baseline ${snap.brand_count}/${snap.category_count}/${candidates.length}`);
const snapshotDate=String(snap.snapshot_id||'').match(/(\d{4}-\d{2}-\d{2})$/)?.[1]||String(snap.fetched_at||'').slice(0,10);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'정보 없음';
const count=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}개`:'정보 없음';
const pct=v=>finite(v)?`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%`:'정보 없음';
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');
const addBodyAttr=html=>html.includes('data-v50-discovery-tools="1"')?html:html.replace(/<body\b([^>]*)>/i,(m,a)=>`<body${a} data-v50-discovery-tools="1">`);
const addScript=(html,src)=>html.includes(src)?html:html.replace('</body>',`<script src="${src}" defer></script></body>`);
const stat={candidatePages:candidates.length,brandFilterCards:0,legacyBrandFilterCardsRemoved:0,categoryActionRails:0,toolContextPages:0,rankingsPatched:false,explorePatched:false};

// 1) Rebuild brand-filter strictly from trusted 136-brand snapshot.
{
  const p=fileFor('/tools/brand-filter/');
  let html=await fs.readFile(p,'utf8');
  const startTag='<div id="conditionResults" class="brand-grid">';
  const endMarker='</div></section><section class="block"><h2>이 도구가 하지 않는 것</h2>';
  const s=html.indexOf(startTag),e=html.indexOf(endMarker,s);
  if(s<0||e<0)throw new Error('brand-filter boundaries missing');
  const oldSlice=html.slice(s,e);
  stat.legacyBrandFilterCardsRemoved=(oldSlice.match(/<article class="brand-card"/g)||[]).length;
  const cards=(snap.brands||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko')).map(b=>`<article class="brand-card" data-v50-trusted-card="1" data-name="${esc(String(b.name).toLowerCase())}" data-cat="${esc(b.categorySlug)}" data-cost="${finite(b.cost)?Number(b.cost):''}" data-stores="${finite(b.stores)?Number(b.stores):''}" data-growth="${finite(b.growth)?Number(b.growth):''}"><a href="${BASE}${esc(b.route)}"><h3>${esc(b.name)}</h3><p>${esc(b.categoryName)}</p><dl><div><dt>공개비용</dt><dd>${money(b.cost)}</dd></div><div><dt>가맹점</dt><dd>${count(b.stores)}</dd></div><div><dt>이전 기준 증감</dt><dd>${pct(b.growth)}</dd></div></dl></a></article>`).join('');
  stat.brandFilterCards=(snap.brands||[]).length;
  html=html.slice(0,s)+startTag+cards+html.slice(e);
  html=html.replace(/(<form id="brandConditionForm" class="calculator"[^>]*)(>)/,(_,a,b)=>a.includes('data-v50-trusted-filter')?a+b:`${a} data-v50-trusted-filter="1"${b}`);
  html=html.replace(/(<b id="conditionCount">)[^<]*(<\/b>)/,`$1${snap.brand_count}개$2`);
  html=html.replace(/이 페이지의 브랜드 수치는 공정거래위원회 공개데이터 스냅샷과 안전 매칭한 값입니다\./,'이 페이지는 신뢰 게이트를 통과한 136개 브랜드만 필터링합니다.');
  html=html.replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="신뢰 게이트를 통과한 136개 프랜차이즈를 업종, 공개비용, 가맹점 수, 점포 변화 조건으로 직접 좁힙니다. 추천 순위가 아닙니다.">`);
  html=addBodyAttr(html);html=addScript(html,`${BASE}/assets/v50-discovery-tools.js`);
  await fs.writeFile(p,html,'utf8');
}

// 2) Add decision rails to production-candidate category pages.
const candidateCats=candidates.map(r=>String(r).match(/^\/categories\/([^/]+)\/$/)?.[1]).filter(Boolean);
for(const slug of candidateCats){
  const c=snap.categories?.[slug];if(!c)throw new Error(`missing category ${slug}`);
  const p=fileFor(`/categories/${slug}/`);let html=await fs.readFile(p,'utf8');
  html=html.replace(/<!-- v11\.50 category actions -->[\s\S]*?<!-- v11\.50 category actions end -->/g,'');
  const block=`<!-- v11.50 category actions --><nav class="v50-category-actions" data-v50-category-actions="1" aria-label="${esc(c.name)} 다음 단계"><a href="${BASE}/explore/?cat=${esc(slug)}#finder"><b>예산별 찾기</b><span>${esc(c.name)} 조건으로 좁히기</span></a><a href="${BASE}/rankings/${esc(slug)}/"><b>업종 정렬</b><span>가맹점 수 기준 확인</span></a><a href="${BASE}/compare/"><b>브랜드 비교</b><span>2~4개 같은 기준 비교</span></a><a href="${BASE}/tools/startup-cost/"><b>준비자금</b><span>공개비용+추가입력 계산</span></a></nav><!-- v11.50 category actions end -->`;
  const anchor=html.includes('data-v47-category-sample=')?/<div class="v47-sample-note"[\s\S]*?<\/div>/:/(<section class="block distribution-block"[^>]*>)/;
  if(anchor instanceof RegExp){const m=html.match(anchor);if(m)html=html.replace(m[0],m[0]+block);else throw new Error(`category anchor ${slug}`)}
  html=addBodyAttr(html);await fs.writeFile(p,html,'utf8');stat.categoryActionRails++;
}

// 3) Rankings and explore: make the next action and current state explicit.
{
  const p=fileFor('/rankings/');let html=await fs.readFile(p,'utf8');
  html=html.replace(/<!-- v11\.50 ranking actions -->[\s\S]*?<!-- v11\.50 ranking actions end -->/g,'');
  html=html.replace(/<span>갱신<\/span><strong>\d{4}-\d{2}-\d{2}<\/strong>/,`<span>갱신</span><strong>${snapshotDate}</strong>`);
  const block=`<!-- v11.50 ranking actions --><nav class="v50-decision-links" data-v50-ranking-actions="1" aria-label="순위 다음 단계"><a href="${BASE}/explore/#finder">조건으로 좁히기</a><a href="${BASE}/compare/">브랜드 비교</a><a href="${BASE}/tools/category-median/">업종 중앙값 비교</a></nav><!-- v11.50 ranking actions end -->`;
  const a='<!-- v11.31 ranking nav end -->';if(!html.includes(a))throw new Error('ranking nav anchor');html=html.replace(a,a+block);html=addBodyAttr(html);await fs.writeFile(p,html,'utf8');stat.rankingsPatched=true;
}
{
  const p=fileFor('/explore/');let html=await fs.readFile(p,'utf8');
  html=html.replace(/<!-- v11\.50 explore state -->[\s\S]*?<!-- v11\.50 explore state end -->/g,'');
  const block=`<!-- v11.50 explore state --><div class="v50-explore-state" data-v50-explore-state-wrap><span>현재 조건</span><strong data-v50-explore-state>1억원 이하 · 전체 업종 · 74개</strong><a href="${BASE}/compare/">선택 후 비교하기</a></div><!-- v11.50 explore state end -->`;
  const anchor='<p class="data-note">';if(!html.includes(anchor))throw new Error('explore anchor');html=html.replace(anchor,block+anchor);html=addBodyAttr(html);html=addScript(html,`${BASE}/assets/v50-discovery-tools.js`);await fs.writeFile(p,html,'utf8');stat.explorePatched=true;
}

// 4) Seven remaining approved tools: add a compact, tool-specific interpretation block.
const tools={
  '/tools/brand-filter/':['조건 필터','입력 조건을 모두 통과한 브랜드 집합만 남깁니다. 통과 개수는 추천점수가 아닙니다.'],
  '/tools/break-even/':['회수기간','초기투자금 ÷ 입력한 월 단순잉여의 산술 결과입니다. 매출·비용 가정이 바뀌면 결과도 바로 달라집니다.'],
  '/tools/category-median/':['업종 중앙값','브랜드 공개비용이 같은 업종 중앙값에서 얼마나 떨어져 있는지만 보여줍니다. 수익성·브랜드 우열을 뜻하지 않습니다.'],
  '/tools/disclosure-decoder/':['정보공개서 읽기','공개 항목의 의미와 확인 순서를 정리합니다. 누락값과 실제 0을 같은 뜻으로 처리하지 않습니다.'],
  '/tools/monthly-fixed-cost/':['월 고정비','사용자가 입력한 월 고정성 비용을 합산합니다. 원재료·플랫폼·카드수수료 같은 변동비는 별도로 봐야 합니다.'],
  '/tools/monthly-profit-simulator/':['월 손익','입력한 월매출에서 입력한 변동비·고정비만 차감한 단순 영업잔액입니다. 순이익 예측값이 아닙니다.'],
  '/tools/open-close-rate/':['점포 변동률','기준 점포 수 대비 신규·종료·해지 건수 비율을 같은 분모로 계산합니다. 성장성 추천지표가 아닙니다.']
};
for(const [route,[label,text]] of Object.entries(tools)){
  const p=fileFor(route);let html=await fs.readFile(p,'utf8');
  html=html.replace(/<!-- v11\.50 tool context -->[\s\S]*?<!-- v11\.50 tool context end -->/g,'');
  const block=`<!-- v11.50 tool context --><aside class="v50-tool-context" data-v50-tool-context="1"><b>${esc(label)}</b><p>${esc(text)}</p><a href="${BASE}/methodology/">계산·누락값 기준</a></aside><!-- v11.50 tool context end -->`;
  const calc=/<(?:form|div) class="calculator"[^>]*>/;const m=html.match(calc);if(m)html=html.replace(m[0],block+m[0]);else{const head=/<div class="page-head"[\s\S]*?<\/div>/;const hm=html.match(head);if(!hm)throw new Error(`tool anchor ${route}`);html=html.replace(hm[0],hm[0]+block)}
  html=addBodyAttr(html);html=addScript(html,`${BASE}/assets/v50-discovery-tools.js`);await fs.writeFile(p,html,'utf8');stat.toolContextPages++;
}

// JS for explore state and lightweight tool input state.
const js=`(()=>{const ready=()=>{const state=document.querySelector('[data-v50-explore-state]');const form=document.querySelector('[data-budget-form]');if(state&&form){const render=()=>{queueMicrotask(()=>{const b=Number(form.elements.budget?.value||0),cat=form.elements.cat?.selectedOptions?.[0]?.textContent?.trim()||'전체 업종',stores=String(form.elements.stores?.value||'').trim(),sales=String(form.elements.sales?.value||'').trim(),cnt=document.querySelector('[data-budget-count]')?.textContent?.trim()||'0개';const budget=b?Math.round(b).toLocaleString('ko-KR')+'만원 이하':'예산 제한 없음';state.textContent=[budget,cat,stores?'가맹점 '+Number(stores).toLocaleString('ko-KR')+'개 이상':'',sales?'평균매출 '+Number(sales).toLocaleString('ko-KR')+'만원 이상':'',cnt].filter(Boolean).join(' · ')})};form.querySelectorAll('input,select').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',render));document.querySelectorAll('[data-budget], [data-budget-reset]').forEach(el=>el.addEventListener('click',render));render()}
for(const box of document.querySelectorAll('[data-v50-tool-context]')){const calc=box.nextElementSibling;if(!calc)return;const fields=[...calc.querySelectorAll('input,select')];const mark=()=>{const changed=fields.some(el=>{if(el.tagName==='SELECT')return el.selectedIndex>0;return String(el.value||'').trim()!==''});box.classList.toggle('has-input',changed)};fields.forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',mark));mark()}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready()})();\n`;
await fs.writeFile(path.join(out,'assets/v50-discovery-tools.js'),js,'utf8');

// CSS keeps the v11.42/v11.49 flat data language.
const cssPath=path.join(out,'assets/site.css');let css=await fs.readFile(cssPath,'utf8');
css=css.replace(/\/\* v11\.50 discovery tools \*\/[\s\S]*?\/\* v11\.50 discovery tools end \*\//g,'').trimEnd();
css+=`\n\n/* v11.50 discovery tools */
.v50-category-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid #303831;border-bottom:1px solid #303831;margin:0 0 22px}.v50-category-actions a{display:grid;gap:3px;padding:12px 12px 12px 0;border-right:1px solid #303831;text-decoration:none}.v50-category-actions a:last-child{border-right:0}.v50-category-actions b{font-size:11px;color:#d8ded9}.v50-category-actions span{font-size:9px;color:#7f8981;line-height:1.45}
.v50-decision-links{display:flex;gap:18px;align-items:center;padding:10px 0 12px;border-bottom:1px solid #303831;margin-bottom:18px}.v50-decision-links a{font-size:10px;text-decoration:underline;text-underline-offset:3px;color:#a4ada6}
.v50-explore-state{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 0;border-top:1px solid #303831;border-bottom:1px solid #303831;margin:10px 0 12px}.v50-explore-state span{font-size:9px;color:#7f8981}.v50-explore-state strong{font-size:11px;font-weight:650;min-width:0}.v50-explore-state a{font-size:10px;text-decoration:underline;text-underline-offset:3px;color:#a4ada6}
.v50-tool-context{display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:12px;align-items:start;padding:11px 0;margin:0 0 12px;border-top:1px solid #303831;border-bottom:1px solid #303831}.v50-tool-context b{font-size:10px;color:#d9ff7c}.v50-tool-context p{margin:0;font-size:11px;line-height:1.6;color:#aeb6b0}.v50-tool-context a{font-size:9px;color:#818b83;text-decoration:underline;text-underline-offset:3px}.v50-tool-context.has-input{border-top-color:#58644f}
[data-v50-trusted-filter="1"] output{font-variant-numeric:tabular-nums}
@media(max-width:720px){.v50-category-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.v50-category-actions a:nth-child(2){border-right:0}.v50-category-actions a:nth-child(-n+2){border-bottom:1px solid #303831}.v50-tool-context{grid-template-columns:1fr}.v50-tool-context a{justify-self:start}.v50-explore-state{grid-template-columns:1fr}.v50-explore-state a{justify-self:start}.calculator{max-width:100%}.calc-layout{grid-template-columns:1fr!important}.calc-result-panel{position:static!important}}
@media(max-width:430px){.v50-category-actions{grid-template-columns:1fr}.v50-category-actions a{border-right:0;border-bottom:1px solid #303831}.v50-category-actions a:last-child{border-bottom:0}.v50-decision-links{overflow-x:auto;white-space:nowrap;scrollbar-width:none}.v50-decision-links::-webkit-scrollbar{display:none}.v50-tool-context p{font-size:10px}.brand-grid{grid-template-columns:1fr!important}}
/* v11.50 discovery tools end */\n`;
await fs.writeFile(cssPath,css,'utf8');

manifest.uiVersion='11.50';
manifest.v11_50={trustedBrandFilter:true,categoryDecisionRails:true,rankingsExploreHandoff:true,toolContextCompletion:true,mobileDiscoveryReadability:true,v42VisualLanguagePreserved:true,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,productionDeployed:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
const report={schemaVersion:1,uiVersion:'11.50',generatedAt:new Date().toISOString(),snapshotId:snap.snapshot_id,snapshotDate,...stat,features:['brand-filter rebuilt to trusted 136 only','16 category decision rails','rankings→explore/compare handoff','explore live condition summary','7 remaining tool interpretation blocks','mobile discovery and calculator readability'],productionDeployed:false};
await fs.writeFile(path.join(out,'v11-50-discovery-tools.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({v11_50DiscoveryTools:'PASS',...report},null,2));
