import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {matchOfficialBrands} from './official-merge.mjs';
import {sanitizeOfficialStoreHistory} from './official-history.mjs';

await import(`./run-generate-v11-21-final.mjs?v1122=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const generatedAt=new Date().toISOString();

async function loadClassic(file,expr){const code=await fs.readFile(file,'utf8');const ctx={console};vm.createContext(ctx);vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);return ctx.__EXPORT__}
const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
const official=JSON.parse(await fs.readFile(path.join(repo,'data/franchise/official/brands-2025.json'),'utf8'));
const report13=JSON.parse(await fs.readFile(path.join(out,'v11-13-brand-expansion.json'),'utf8'));
const report14=JSON.parse(await fs.readFile(path.join(out,'v11-14-history-tiers.json'),'utf8'));
const report17=JSON.parse(await fs.readFile(path.join(out,'v11-17-compare-trust.json'),'utf8'));
const report21=JSON.parse(await fs.readFile(path.join(out,'v11-21-home-funnel.json'),'utf8'));
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const matched=matchOfficialBrands(catalog.brands,official);
const hitByName=new Map(matched.matches.map(x=>[x.brand.name,x.record]));
const brandByName=new Map(catalog.brands.map(x=>[x.name,x]));
const trustedRoutes=new Set((report14.candidateUrls||[]).filter(r=>/^\/brands\/[^/]+\/$/.test(r)));
const tierBRoutes=new Set(report14.addedTierBRoutes||[]);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeJson=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const won=n=>finite(n)?`${Math.round(Number(n)).toLocaleString('ko-KR')}만원`:'정보 없음';
const num=n=>finite(n)?Math.round(Number(n)).toLocaleString('ko-KR'):'정보 없음';
const pct=n=>finite(n)?`${Number(n)>=0?'+':''}${Number(n).toFixed(1)}%`:'정보 없음';
const signedWon=n=>finite(n)?`${Number(n)>=0?'+':'-'}${Math.round(Math.abs(Number(n))).toLocaleString('ko-KR')}만원`:'정보 없음';
const signedNum=(n,unit)=>finite(n)?`${Number(n)>=0?'+':'-'}${Math.round(Math.abs(Number(n))).toLocaleString('ko-KR')}${unit}`:'정보 없음';
const signedPctPoint=n=>finite(n)?`${Number(n)>=0?'+':''}${Number(n).toFixed(1)}%p`:'정보 없음';
const slugFromRoute=route=>String(route).split('/').filter(Boolean).at(-1)||'';

function growthFor(name){
  const record=hitByName.get(name);if(!record)return null;
  const history=sanitizeOfficialStoreHistory(record.storeHistory||[]).filter(x=>finite(x?.year)&&finite(x?.stores)).sort((a,b)=>Number(a.year)-Number(b.year));
  if(history.length<2)return null;
  const a=Number(history.at(-2).stores),b=Number(history.at(-1).stores);
  return a>0?(b-a)/a*100:null;
}

const trusted=(report13.eligibility||[]).filter(row=>trustedRoutes.has(row.route)&&Object.values(row.metrics||{}).every(finite)).map(row=>{
  const b=brandByName.get(row.name)||{};
  return {name:row.name,slug:slugFromRoute(row.route),route:row.route,categorySlug:b.categorySlug||'',categoryName:b.category||catalog.categories?.[b.categorySlug]?.name||'기타',cost:Number(row.metrics.cost),stores:Number(row.metrics.stores),sales:Number(row.metrics.sales),growth:growthFor(row.name),tier:tierBRoutes.has(row.route)?'B':'A'};
}).sort((a,b)=>a.categoryName.localeCompare(b.categoryName,'ko')||a.name.localeCompare(b.name,'ko'));
if(trusted.length!==report14.productionBrandCandidates)throw new Error(`Compare builder trusted rows mismatch ${trusted.length}/${report14.productionBrandCandidates}`);

const pairMap={};
for(const row of report17.eligible||[]){const as=slugFromRoute(row.a?.route),bs=slugFromRoute(row.b?.route);if(!as||!bs)continue;pairMap[[as,bs].sort().join('|')]=row.route}
const defaultA=trusted.find(x=>x.name==='메가MGC커피')||trusted[0];
const defaultB=trusted.find(x=>x.name==='컴포즈커피'&&x.slug!==defaultA?.slug)||trusted.find(x=>x.slug!==defaultA?.slug);
if(!defaultA||!defaultB)throw new Error('Compare builder defaults missing');

function options(selected){
  const groups=new Map();for(const row of trusted){const arr=groups.get(row.categoryName)||[];arr.push(row);groups.set(row.categoryName,arr)}
  return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b,'ko')).map(([category,rows])=>`<optgroup label="${esc(category)}">${rows.map(row=>`<option value="${esc(row.slug)}" data-route="${esc(row.route)}" data-name="${esc(row.name)}" data-category="${esc(row.categorySlug)}" data-category-name="${esc(row.categoryName)}" data-cost="${row.cost}" data-stores="${row.stores}" data-sales="${row.sales}" data-growth="${finite(row.growth)?Number(row.growth).toFixed(6):''}" data-tier="${row.tier}"${row.slug===selected?' selected':''}>${esc(row.name)}</option>`).join('')}</optgroup>`).join('');
}
function compareRows(a,b){return `<tr><th>공개 창업비용</th><td data-cmp-a-cost>${won(a.cost)}</td><td data-cmp-b-cost>${won(b.cost)}</td><td data-cmp-d-cost>${signedWon(a.cost-b.cost)}</td></tr><tr><th>가맹점 수</th><td data-cmp-a-stores>${num(a.stores)}개</td><td data-cmp-b-stores>${num(b.stores)}개</td><td data-cmp-d-stores>${signedNum(a.stores-b.stores,'개')}</td></tr><tr><th>평균매출 공개지표</th><td data-cmp-a-sales>${won(a.sales)}</td><td data-cmp-b-sales>${won(b.sales)}</td><td data-cmp-d-sales>${signedWon(a.sales-b.sales)}</td></tr><tr><th>최근 점포 변화</th><td data-cmp-a-growth>${pct(a.growth)}</td><td data-cmp-b-growth>${pct(b.growth)}</td><td data-cmp-d-growth>${finite(a.growth)&&finite(b.growth)?signedPctPoint(a.growth-b.growth):'정보 없음'}</td></tr>`}
function staticPairUrl(a,b){return pairMap[[a.slug,b.slug].sort().join('|')]||null}
const initialPair=staticPairUrl(defaultA,defaultB);
const builder=`<section class="block compare-builder" data-v11-22-compare-builder="1"><div class="section-head"><h2>${trusted.length}개 신뢰 브랜드 중 두 개 직접 비교</h2><span class="basis-chip">새 비교 페이지 자동생성 없음</span></div><p>두 브랜드를 선택하면 이 페이지 안에서 공개 창업비용·가맹점 수·평균매출 공개지표·최근 점포 변화를 같은 형식으로 계산합니다. Tier C 브랜드는 선택 목록에 넣지 않습니다.</p><form class="compare-builder-form" data-compare-builder><label>브랜드 A<select name="a">${options(defaultA.slug)}</select></label><span class="compare-vs" aria-hidden="true">VS</span><label>브랜드 B<select name="b">${options(defaultB.slug)}</select></label><button type="submit">비교</button></form><section class="compare-builder-result" aria-live="polite"><div class="compare-builder-head"><div><span data-cmp-a-tier>Tier ${defaultA.tier}</span><strong data-cmp-a-name>${esc(defaultA.name)}</strong></div><b>VS</b><div><span data-cmp-b-tier>Tier ${defaultB.tier}</span><strong data-cmp-b-name>${esc(defaultB.name)}</strong></div></div><p class="compare-builder-note" data-cmp-note>${defaultA.categorySlug===defaultB.categorySlug?`두 브랜드 모두 ${esc(defaultA.categoryName)} 업종입니다.`:`서로 다른 업종(${esc(defaultA.categoryName)} / ${esc(defaultB.categoryName)})이라 비용·매출 구조 차이를 감안해야 합니다.`} Tier A는 정제 이력 3개년 이상, Tier B는 연속 2개년과 나머지 신뢰 게이트를 통과한 브랜드입니다.</p><div class="table-scroll"><table class="data-table compare-builder-table"><thead><tr><th>지표</th><th data-cmp-a-head>${esc(defaultA.name)}</th><th data-cmp-b-head>${esc(defaultB.name)}</th><th>A-B 차이</th></tr></thead><tbody>${compareRows(defaultA,defaultB)}</tbody></table></div><div class="compare-builder-actions"><a data-cmp-a-link href="${BASE}${defaultA.route}">${esc(defaultA.name)} 상세</a><a data-cmp-b-link href="${BASE}${defaultB.route}">${esc(defaultB.name)} 상세</a><a data-cmp-static-link href="${initialPair?`${BASE}${initialPair}`:'#'}"${initialPair?'':' hidden'}>검증된 비교 페이지 보기</a><a href="${BASE}/tools/startup-cost/">내 비용 계산</a></div></section><script type="application/json" data-v11-22-pair-map>${safeJson(pairMap)}</script></section>`;

const comparePath=path.join(out,'compare/index.html');
let html=await fs.readFile(comparePath,'utf8');
html=html.replace('<main data-v11-17-compare-hub="1">','<main data-v11-17-compare-hub="1" data-v11-22-universal-compare="1">');
html=html.replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="신뢰 게이트를 통과한 ${trusted.length}개 프랜차이즈 중 두 브랜드를 직접 선택해 창업비용·가맹점·평균매출·점포 변화를 비교하고, 검증된 ${report17.eligibleCompareCount}개 조합은 상세 비교로 이어집니다.">`);
if(!html.includes('data-v11-22-compare-builder="1"'))html=html.replace(/(<div class="page-head">[\s\S]*?<\/div>)/,`$1${builder}`);
await fs.writeFile(comparePath,html,'utf8');

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.22 universal compare builder */')){
  css+=`\n/* v11.22 universal compare builder */\n.compare-builder{border-top:2px solid #1c1916}.compare-builder-form{display:grid;grid-template-columns:minmax(0,1fr) 44px minmax(0,1fr) auto;gap:12px;align-items:end;margin:20px 0}.compare-builder-form label{display:grid;gap:7px;font-weight:700}.compare-builder-form select{width:100%;min-height:46px;border:1px solid #cfc7bb;background:#fff;padding:9px 11px;font:inherit}.compare-builder-form button{min-height:46px;padding:0 18px;border:1px solid #1c1916;background:#1c1916;color:#fff;font:inherit;font-weight:700}.compare-vs{align-self:center;text-align:center;font:700 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#777068}.compare-builder-result{border-top:1px solid var(--line);padding-top:18px}.compare-builder-head{display:grid;grid-template-columns:1fr 42px 1fr;align-items:end;gap:12px;margin-bottom:10px}.compare-builder-head>div{display:grid;gap:3px}.compare-builder-head>div:last-child{text-align:right}.compare-builder-head span{font-size:11px;color:#777068}.compare-builder-head strong{font-size:22px;letter-spacing:-.03em}.compare-builder-head>b{text-align:center;font-size:12px;color:#777068}.compare-builder-note{font-size:13px;line-height:1.65;color:#6b645c}.compare-builder-table th:first-child{text-align:left}.compare-builder-actions{display:flex;flex-wrap:wrap;gap:14px;margin-top:16px}.compare-builder-actions a{font-size:13px;font-weight:700}.compare-builder-actions a[hidden]{display:none}@media(max-width:760px){.compare-builder-form{grid-template-columns:1fr}.compare-vs{display:none}.compare-builder-form button{width:100%}.compare-builder-head strong{font-size:18px}.compare-builder-table{min-width:650px}}\n`;
  await fs.writeFile(cssPath,css,'utf8');
}

const appPath=path.join(out,'assets/app.js');
let app=await fs.readFile(appPath,'utf8');
if(!app.includes('/* v11.22 universal compare builder */')){
  app+=`\n/* v11.22 universal compare builder */\n(()=>{const form=document.querySelector('[data-compare-builder]');if(!form)return;const root=form.closest('[data-v11-22-compare-builder]');const pairNode=root?.querySelector('[data-v11-22-pair-map]');let pairMap={};try{pairMap=JSON.parse(pairNode?.textContent||'{}')}catch{}const read=sel=>{const o=sel?.selectedOptions?.[0];if(!o)return null;const n=v=>v==null||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;return{slug:o.value,route:o.dataset.route||'',name:o.dataset.name||o.textContent.trim(),cat:o.dataset.category||'',catName:o.dataset.categoryName||'',cost:n(o.dataset.cost),stores:n(o.dataset.stores),sales:n(o.dataset.sales),growth:n(o.dataset.growth),tier:o.dataset.tier||''}};const won=v=>v==null?'정보 없음':Math.round(v).toLocaleString('ko-KR')+'만원';const count=v=>v==null?'정보 없음':Math.round(v).toLocaleString('ko-KR')+'개';const pct=v=>v==null?'정보 없음':(v>=0?'+':'')+v.toFixed(1)+'%';const swon=v=>v==null?'정보 없음':(v>=0?'+':'-')+Math.round(Math.abs(v)).toLocaleString('ko-KR')+'만원';const scount=v=>v==null?'정보 없음':(v>=0?'+':'-')+Math.round(Math.abs(v)).toLocaleString('ko-KR')+'개';const spp=v=>v==null?'정보 없음':(v>=0?'+':'')+v.toFixed(1)+'%p';const set=(s,t)=>{const e=root.querySelector(s);if(e)e.textContent=t};const render=()=>{const a=read(form.elements.a),b=read(form.elements.b);if(!a||!b)return;set('[data-cmp-a-name]',a.name);set('[data-cmp-b-name]',b.name);set('[data-cmp-a-head]',a.name);set('[data-cmp-b-head]',b.name);set('[data-cmp-a-tier]','Tier '+a.tier);set('[data-cmp-b-tier]','Tier '+b.tier);set('[data-cmp-a-cost]',won(a.cost));set('[data-cmp-b-cost]',won(b.cost));set('[data-cmp-d-cost]',a.cost!=null&&b.cost!=null?swon(a.cost-b.cost):'정보 없음');set('[data-cmp-a-stores]',count(a.stores));set('[data-cmp-b-stores]',count(b.stores));set('[data-cmp-d-stores]',a.stores!=null&&b.stores!=null?scount(a.stores-b.stores):'정보 없음');set('[data-cmp-a-sales]',won(a.sales));set('[data-cmp-b-sales]',won(b.sales));set('[data-cmp-d-sales]',a.sales!=null&&b.sales!=null?swon(a.sales-b.sales):'정보 없음');set('[data-cmp-a-growth]',pct(a.growth));set('[data-cmp-b-growth]',pct(b.growth));set('[data-cmp-d-growth]',a.growth!=null&&b.growth!=null?spp(a.growth-b.growth):'정보 없음');set('[data-cmp-note]',a.cat===b.cat?'두 브랜드 모두 '+a.catName+' 업종입니다. Tier A는 정제 이력 3개년 이상, Tier B는 연속 2개년과 나머지 신뢰 게이트를 통과한 브랜드입니다.':'서로 다른 업종('+a.catName+' / '+b.catName+')이라 비용·매출 구조 차이를 감안해야 합니다. Tier A는 정제 이력 3개년 이상, Tier B는 연속 2개년과 나머지 신뢰 게이트를 통과한 브랜드입니다.');const al=root.querySelector('[data-cmp-a-link]'),bl=root.querySelector('[data-cmp-b-link]');if(al){al.href='/pm-lab/franchise-ssg-preview'+a.route;al.textContent=a.name+' 상세'}if(bl){bl.href='/pm-lab/franchise-ssg-preview'+b.route;bl.textContent=b.name+' 상세'}const key=[a.slug,b.slug].sort().join('|'),sl=root.querySelector('[data-cmp-static-link]'),route=pairMap[key];if(sl){sl.hidden=!route;if(route)sl.href='/pm-lab/franchise-ssg-preview'+route}const q=new URLSearchParams(location.search);q.set('a',a.slug);q.set('b',b.slug);history.replaceState(null,'',location.pathname+'?'+q.toString()+location.hash)};const params=new URLSearchParams(location.search);for(const n of ['a','b']){const v=params.get(n);if(v&&[...form.elements[n].options].some(o=>o.value===v))form.elements[n].value=v}form.addEventListener('submit',e=>{e.preventDefault();render()});form.elements.a?.addEventListener('change',render);form.elements.b?.addEventListener('change',render);render()})();\n`;
  await fs.writeFile(appPath,app,'utf8');
}

manifest.uiVersion='11.22';manifest.v11_22={universalCompareBuilder:true,trustedBrands:trusted.length,staticVerifiedPairs:Object.keys(pairMap).length,programmaticCompareFanout:false,productionCandidateCount:report21.productionCandidateCount};await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
quality.contentTrust={...(quality.contentTrust||{}),version:'11.22',generatedAt,universalCompareBuilder:true,compareBuilderBrands:trusted.length,staticVerifiedPairs:Object.keys(pairMap).length,programmaticCompareFanout:false};await fs.writeFile(qualityPath,JSON.stringify(quality,null,2),'utf8');
const report={schemaVersion:1,generatedAt,uiVersion:'11.22',previewMode:PREVIEW,policy:'ONE_COMPARE_HUB_SUPPORTS_ANY_TWO_TIER_A_B_BRANDS_CLIENT_SIDE; ONLY_7_VERIFIED_STATIC_PAIRS_KEEP_DETAIL_URLS; NO_PAIR_PAGE_FANOUT',trustedBrands:trusted.length,tierABrands:trusted.filter(x=>x.tier==='A').length,tierBBrands:trusted.filter(x=>x.tier==='B').length,staticVerifiedPairs:Object.keys(pairMap).length,defaultPair:[defaultA.name,defaultB.name],productionCandidateCount:report21.productionCandidateCount};await fs.writeFile(path.join(out,'v11-22-universal-compare.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_22:'PASS',trustedBrands:report.trustedBrands,tierA:report.tierABrands,tierB:report.tierBBrands,staticPairs:report.staticVerifiedPairs,productionCandidates:report.productionCandidateCount},null,2));
