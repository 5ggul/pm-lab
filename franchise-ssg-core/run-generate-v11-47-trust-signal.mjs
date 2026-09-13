import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const snapshot=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const candidateCategorySlugs=new Set(candidates.map(r=>String(r).match(/^\/categories\/([^/]+)\/$/)?.[1]).filter(Boolean));
const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
if(manifest.uiVersion!=='11.46')throw new Error(`v11.47 requires v11.46 baseline, got ${manifest.uiVersion}`);
if(Number(snapshot.brand_count)!==136||Number(snapshot.category_count)!==20||candidates.length!==184||candidateCategorySlugs.size!==16)throw new Error(`v11.47 baseline ${snapshot.brand_count}/${snapshot.category_count}/${candidates.length}/${candidateCategorySlugs.size}`);

const snapshotDate=String(snapshot.snapshot_id||'').match(/(\d{4}-\d{2}-\d{2})$/)?.[1]||String(snapshot.fetched_at||'').slice(0,10);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round1=v=>finite(v)?Math.round(Number(v)*10)/10:null;
const won=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'—';
const count=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}개`:'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const reEsc=s=>String(s??'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');
const stat={allHtmlPages:htmlFiles.length,candidatePages:candidates.length,candidateCategoryPages:candidateCategorySlugs.size,tapesRemoved:0,scrollCuesRemoved:0,categoryPagesPatched:0,categoryCorePagesPatched:0,categoryDatasetsPatched:0,categorySampleNotesPatched:0,scattersRebuilt:0,categoryHubCardsPatched:0,rankingH1Patched:0,compareAnswersPatched:0,particleFixes:0,budgetLinksPatched:0,sourceFunnelPatched:false};

function patchBody(html){return html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{let a=attrs||'';a=a.replace(/\bclass="([^"]*)"/i,(m,c)=>{const list=c.split(/\s+/).filter(Boolean);if(!list.includes('v47-trust-ui'))list.push('v47-trust-ui');return `class="${list.join(' ')}"`});if(!/\bclass="/i.test(a))a+=' class="v47-trust-ui"';a=a.replace(/\sdata-v47-trust-ui="[^"]*"/gi,'');a+=' data-v47-trust-ui="1"';return `<body${a}>`})}
for(const file of htmlFiles){let html=await fs.readFile(file,'utf8');const before=html;const tapes=(html.match(/<div class="v41-global-tape"[^>]*>[\s\S]*?<\/div><\/div>/g)||[]).length;const cues=(html.match(/<div class="v41-scroll-cue"[^>]*>[\s\S]*?<\/div>/g)||[]).length;html=html.replace(/<div class="v41-global-tape"[^>]*>[\s\S]*?<\/div><\/div>/g,'');html=html.replace(/<div class="v41-scroll-cue"[^>]*>[\s\S]*?<\/div>/g,'');stat.tapesRemoved+=tapes;stat.scrollCuesRemoved+=cues;html=patchBody(html);if(html!==before)await fs.writeFile(file,html,'utf8')}

const brandBySlug=new Map((snapshot.brands||[]).map(b=>[String(b.slug),b]));
const brandByCategory=new Map();
for(const b of snapshot.brands||[]){if(!brandByCategory.has(b.categorySlug))brandByCategory.set(b.categorySlug,[]);brandByCategory.get(b.categorySlug).push(b)}

function scatter(c,rows){
  const usable=rows.filter(x=>finite(x.cost)&&finite(x.stores));
  const x0=78,x1=792,y0=282,y1=28;
  const costs=usable.map(x=>Number(x.cost)),stores=usable.map(x=>Number(x.stores));
  const xmin=Math.min(...costs),xmax=Math.max(...costs),ymin=Math.min(...stores),ymax=Math.max(...stores);
  const scale=(v,min,max,a,b)=>max===min?(a+b)/2:a+(v-min)/(max-min)*(b-a);
  const circles=usable.map(x=>`<circle cx="${scale(Number(x.cost),xmin,xmax,x0,x1).toFixed(1)}" cy="${scale(Number(x.stores),ymin,ymax,y0,y1).toFixed(1)}" r="5"><title>${esc(x.name)} · ${won(x.cost)} · ${count(x.stores)}</title></circle>`).join('');
  return `<svg class="chart-svg category-scatter" data-motion-chart data-v47-trusted-scatter="1" viewBox="0 0 820 340" role="img" aria-label="${esc(c.name)} 신뢰 게이트 분석 ${usable.length}개 브랜드의 공개 창업비용과 가맹점 수 분포"><title>${esc(c.name)} 분석 표본 공개 창업비용과 가맹점 수 분포</title><line x1="78" y1="282" x2="792" y2="282"/><line x1="78" y1="28" x2="78" y2="282"/>${circles}<text x="435" y="326" text-anchor="middle">공개 창업비용</text><text x="18" y="155" text-anchor="middle" transform="rotate(-90 18 155)">가맹점 수</text></svg>`;
}
function dataset(c,officialCount,url){
  const props=[['공식 매칭 브랜드 수',officialCount,'개 브랜드'],['신뢰 게이트 분석 표본',c.count,'개 브랜드'],['공개 창업비용 P25',round1(c.cost?.p25),'만원'],['공개 창업비용 중앙값',round1(c.cost?.median),'만원'],['공개 창업비용 P75',round1(c.cost?.p75),'만원'],['가맹점 수 중앙값',round1(c.stores?.median),'개'],['평균매출 공개지표 중앙값',round1(c.sales?.median),'만원'],['평균매출 표본',Number(c.sales?.count||0),'개 브랜드'],['3.3㎡당 평균매출 중앙값',round1(c.salesPerArea?.median),'만원/연'],['3.3㎡당 평균매출 표본',Number(c.salesPerArea?.count||0),'개 브랜드']].filter(x=>finite(x[1]));
  return {'@context':'https://schema.org','@type':'Dataset','@id':`${url}#dataset`,name:`${c.name} 프랜차이즈 창업비용·가맹점 분석 데이터`,description:`${c.name} 공식 매칭 ${officialCount}개 중 신뢰 게이트를 통과한 ${c.count}개 브랜드의 창업비용·가맹점·평균매출 공개지표를 같은 표본 기준으로 비교한 데이터입니다.`,url,dateModified:snapshotDate,creator:{'@type':'Organization',name:'창업데이터랩',url:'https://5ggul.github.io/pm-lab/franchise-ssg-preview'},isBasedOn:['https://www.data.go.kr/data/15110265/openapi.do','https://www.data.go.kr/data/15110241/openapi.do'],measurementTechnique:'공정거래위원회 공개자료 정규화 후 Tier A/B 신뢰 게이트를 통과한 동일 업종 분석 표본 사용',variableMeasured:props.map(([name,value,unitText])=>({'@type':'PropertyValue',name,value,unitText}))};
}

for(const c of Object.values(snapshot.categories||{})){
  const p=path.join(out,'categories',c.slug,'index.html');
  try{await fs.access(p)}catch{continue}
  let html=await fs.readFile(p,'utf8');
  const before=html;
  const m=html.match(/공식 매칭\s*([\d,]+)개/);
  const officialCount=m?Number(m[1].replace(/,/g,'')):Number(c.count);
  const url=`https://5ggul.github.io/pm-lab/franchise-ssg-preview/categories/${c.slug}/`;
  html=html.replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${esc(c.name)} 공식 매칭 ${officialCount}개 중 신뢰 게이트 분석 ${c.count}개 브랜드의 2025 공개 창업비용 중앙값 ${won(c.cost?.median)}, 가맹점 중앙값 ${count(c.stores?.median)}를 비교합니다.">`);

  if(candidateCategorySlugs.has(String(c.slug))){
    const datasetRe=/<script type="application\/ld\+json" data-v11-category-dataset>[\s\S]*?<\/script>/;
    if(datasetRe.test(html)){html=html.replace(datasetRe,`<script type="application/ld+json" data-v11-category-dataset>${JSON.stringify(dataset(c,officialCount,url)).replace(/</g,'\\u003c')}</script>`);stat.categoryDatasetsPatched++}
    const scatterRe=/<svg class="chart-svg category-scatter"[\s\S]*?<\/svg>/;
    if(scatterRe.test(html)){html=html.replace(scatterRe,scatter(c,brandByCategory.get(c.slug)||[]));stat.scattersRebuilt++}
    html=html.replace(/<div class="chart-legend">[\s\S]*?<\/div>/,`<div class="chart-legend">신뢰 게이트 분석 ${c.count}개 브랜드 기준입니다. 가로축은 공개 창업비용, 세로축은 가맹점 수이며 비용이 낮거나 점포가 많다는 사실만으로 우수 브랜드를 의미하지 않습니다.</div>`);
    const sample=`<div class="v47-sample-note" data-v47-category-sample="${esc(c.slug)}"><strong>표본 기준</strong><span>공식 매칭 ${officialCount}개 · 분석 ${c.count}개</span><p>중앙값·P25·P75·분포·브랜드 벤치마크는 신뢰 게이트 분석 표본 ${c.count}개를 사용합니다. 공식 매칭 전체 표가 별도로 보이는 경우 분석 제외 브랜드가 포함될 수 있습니다.</p></div>`;
    html=html.replace(/<div class="v47-sample-note"[\s\S]*?<\/div>/,'');
    const distributionRe=/(<section class="block distribution-block"[^>]*>)/;
    if(distributionRe.test(html)){html=html.replace(distributionRe,`${sample}$1`);stat.categorySampleNotesPatched++}
    stat.categoryCorePagesPatched++;
  }
  if(html!==before){await fs.writeFile(p,html,'utf8');stat.categoryPagesPatched++}
}

const categoriesPath=path.join(out,'categories/index.html');
let categories=await fs.readFile(categoriesPath,'utf8');
categories=categories.replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="20개 프랜차이즈 업종의 공식 매칭 수와 신뢰 게이트 분석 표본, 공개 창업비용·가맹점 중앙값을 같은 2025 기준으로 비교합니다.">`);
for(const c of Object.values(snapshot.categories||{})){
  const re=new RegExp(`(<a href="${reEsc(BASE)}\\/categories\\/${reEsc(c.slug)}\\/"><strong>${reEsc(c.name)}<\\/strong><span>)공식 매칭 ([\\d,]+)개 · 공개비용 중앙값 [^<]+(<\\/span><\\/a>)`);
  categories=categories.replace(re,(full,a,official,z)=>{stat.categoryHubCardsPatched++;return `${a}공식 매칭 ${official}개 · 분석 ${c.count}개 · 분석 중앙값 ${won(c.cost?.median)}${z}`});
}
await fs.writeFile(categoriesPath,categories,'utf8');

const homePath=path.join(out,'index.html');
let home=await fs.readFile(homePath,'utf8');
home=home.replace('<h1 class="v44-home-title">프랜차이즈 비교</h1>','<h1 class="v44-home-title">프랜차이즈 창업비용 비교</h1><p class="v47-home-sub">가맹점·평균매출·업종 중앙값까지 2025 공개자료로 비교</p>');
for(const [label,value] of [['5천만원','5000'],['7천만원','7000'],['1억원','10000'],['1억5천','15000']]){const old=`href="${BASE}/explore/"><span>${label} 이하</span>`,neu=`href="${BASE}/explore/?budget=${value}#finder"><span>${label} 이하</span>`;if(home.includes(old)){home=home.replace(old,neu);stat.budgetLinksPatched++}}
await fs.writeFile(homePath,home,'utf8');

const sourcesPath=path.join(out,'sources/index.html');
let sources=await fs.readFile(sourcesPath,'utf8');
const src=sources.match(/원본 레코드\s*([\d,]+)건 · 카탈로그 공식 매칭\s*([\d,]+)\/([\d,]+)/);
const raw=src?.[1]||'11,724',matched=src?.[2]||'149',catalog=src?.[3]||'170';
const funnel=`<section class="v47-source-funnel" data-v47-source-funnel="1"><h2>데이터 선별 흐름</h2><div><span>원천 레코드<strong>${raw}건</strong></span><i>→</i><span>카탈로그<strong>${catalog}개</strong></span><i>→</i><span>공식 매칭<strong>${matched}개</strong></span><i>→</i><span>신뢰 게이트<strong>${snapshot.brand_count}개</strong></span><i>→</i><span>지표별 표본<strong>n 표시</strong></span></div><p>홈·업종·브랜드·비교의 중앙값과 분포는 신뢰 게이트 통과 표본을 기준으로 계산하며, 평균매출·3.3㎡당매출처럼 결측 처리 규칙이 있는 지표는 각 화면에 실제 표본 n을 따로 표시합니다.</p></section>`;
sources=sources.replace(/<section class="v47-source-funnel"[\s\S]*?<\/section>/,'');
sources=sources.replace(/(<div class="callout source">[\s\S]*?<\/div>)/,`$1${funnel}`);
stat.sourceFunnelPatched=sources.includes('data-v47-source-funnel="1"');
await fs.writeFile(sourcesPath,sources,'utf8');

for(const c of Object.values(snapshot.categories||{})){
  const p=path.join(out,'rankings',c.slug,'index.html');
  try{await fs.access(p)}catch{continue}
  let h=await fs.readFile(p,'utf8');
  const before=h;
  h=h.replace(new RegExp(`<h1>${reEsc(c.name)}<\\/h1>`),`<h1>${esc(c.name)} 프랜차이즈 가맹점 수 정렬</h1>`);
  if(h!==before){await fs.writeFile(p,h,'utf8');stat.rankingH1Patched++}
}

const jong=s=>{const chars=[...String(s).trim()];const ch=chars.at(-1)||'';const code=ch.charCodeAt(0);return code>=0xAC00&&code<=0xD7A3&&((code-0xAC00)%28)!==0};
for(const r of candidates.filter(x=>/^\/compare\/[^/]+-vs-[^/]+\/$/.test(x))){
  const p=fileFor(r);
  let h=await fs.readFile(p,'utf8');
  const hm=h.match(/<h1>([^<]+) vs ([^<]+)<\/h1>/);
  if(!hm)continue;
  const a=hm[1],b=hm[2],particle=jong(a)?'과':'와';
  const pairPhraseRe=new RegExp(`${reEsc(a)}(?:과|와) ${reEsc(b)}`,'g');
  const pairHits=h.match(pairPhraseRe)||[];
  h=h.replace(pairPhraseRe,`${a}${particle} ${b}`);
  stat.particleFixes+=pairHits.length;
  const pair=r.split('/').filter(Boolean)[1].split('-vs-'),A=brandBySlug.get(pair[0]),B=brandBySlug.get(pair[1]);
  if(A&&B){
    const costLow=Number(A.cost)<=Number(B.cost)?A:B,costHigh=costLow===A?B:A;
    const storeHigh=Number(A.stores)>=Number(B.stores)?A:B,storeLow=storeHigh===A?B:A;
    const salesValid=finite(A.sales)&&finite(B.sales),salesHigh=salesValid?(Number(A.sales)>=Number(B.sales)?A:B):null,salesLow=salesHigh?(salesHigh===A?B:A):null;
    const ps=[`2025 공개자료 기준 ${costLow.name}의 공개 창업비용이 ${costHigh.name}보다 ${won(Math.abs(Number(costHigh.cost)-Number(costLow.cost)))} 낮습니다.`,`가맹점 수는 ${storeHigh.name}이 ${storeLow.name}보다 ${count(Math.abs(Number(storeHigh.stores)-Number(storeLow.stores)))} 많습니다.`];
    if(salesHigh)ps.push(`평균매출 공개지표는 ${salesHigh.name}이 ${salesLow.name}보다 ${won(Math.abs(Number(salesHigh.sales)-Number(salesLow.sales)))} 높습니다.`);
    const block=`<section class="v47-direct-answer" data-v47-direct-answer="1"><strong>한눈에 비교</strong><p>${esc(ps.join(' '))}</p></section>`;
    h=h.replace(/<section class="v47-direct-answer"[\s\S]*?<\/section>/,'');
    h=h.replace(/(<header class="compare-head">[\s\S]*?<\/header>)/,`$1${block}`);
    stat.compareAnswersPatched++;
  }
  await fs.writeFile(p,h,'utf8');
}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
css=css.replace(/\/\* v11\.47 trust signal \*\/[\s\S]*?\/\* v11\.47 trust signal end \*\//g,'').trimEnd();
css+=`\n\n/* v11.47 trust signal */\nbody.v47-trust-ui .v47-home-sub{margin:8px 0 0;color:#8d978e;font-size:13px;line-height:1.5}\nbody.v47-trust-ui .v47-sample-note{margin:0 0 18px;padding:12px 0;border-top:1px solid #303831;border-bottom:1px solid #303831;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:baseline}\nbody.v47-trust-ui .v47-sample-note strong{font-size:12px;color:#d9ff7c}.v47-sample-note span{font-size:12px;font-variant-numeric:tabular-nums}.v47-sample-note p{grid-column:1/-1;margin:2px 0 0;color:#8d978e;font-size:11px;line-height:1.55}\nbody.v47-trust-ui .v47-source-funnel{margin:24px 0;padding:18px 0;border-top:2px solid #d9ff7c;border-bottom:1px solid #303831}.v47-source-funnel h2{margin:0 0 12px}.v47-source-funnel>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.v47-source-funnel span{display:grid;gap:2px;min-width:110px;font-size:10px;color:#8d978e}.v47-source-funnel strong{font-size:18px;color:inherit;font-variant-numeric:tabular-nums}.v47-source-funnel i{font-style:normal;color:#5d665f}.v47-source-funnel p{margin:14px 0 0;color:#8d978e;font-size:12px;line-height:1.6}\nbody.v47-trust-ui .v47-direct-answer{margin:14px 0 22px;padding:12px 0;border-top:1px solid #3b453d;border-bottom:1px solid #3b453d}.v47-direct-answer strong{display:block;margin-bottom:5px;color:#d9ff7c;font-size:11px}.v47-direct-answer p{margin:0;line-height:1.65}\nbody.v47-trust-ui .v44-home-title{white-space:nowrap;text-wrap:nowrap;width:max-content;max-width:none}\n@media(max-width:760px){body.v47-trust-ui .v41-category-scene{display:none}body.v47-trust-ui .v41-detail-photo,body.v47-trust-ui .v41-detail-wash{display:none}body.v47-trust-ui .v41-detail-hero{min-height:0;padding:18px 0 12px;background:#090b0a}body.v47-trust-ui .v41-detail-hero .brand-header{position:relative;inset:auto;padding:0}body.v47-trust-ui .v41-home-media{display:none}body.v47-trust-ui .v47-source-funnel>div{display:grid;grid-template-columns:1fr auto 1fr}.v47-source-funnel span{min-width:0}.v47-source-funnel strong{font-size:16px}}\n@media(max-width:430px){body.v47-trust-ui .v44-home-title{font-size:clamp(22px,7.1vw,29px);letter-spacing:-.045em}body.v47-trust-ui .v47-home-sub{font-size:11px}body.v47-trust-ui .v47-sample-note{grid-template-columns:1fr}.v47-sample-note p{grid-column:1}.v47-source-funnel>div{grid-template-columns:1fr}.v47-source-funnel i{display:none}}\n/* v11.47 trust signal end */\n`;
await fs.writeFile(cssPath,css,'utf8');

manifest.uiVersion='11.47';
manifest.v11_47={trustedCategorySemantics:true,categorySampleDisclosure:true,categoryDatasetSync:true,trustedScatter:true,sourceFunnel:true,globalTapeRemoved:true,scrollCueRemoved:true,homeIntentTitle:true,budgetDeepLinks:true,rankingIntentH1:true,compareDirectAnswer:true,koreanParticleFix:true,v42VisualLanguagePreserved:true,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,productionDeployed:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
const report={schemaVersion:1,uiVersion:'11.47',generatedAt:new Date().toISOString(),snapshotId:snapshot.snapshot_id,snapshotDate,...stat,features:['trusted category sample disclosure','candidate category Dataset synchronized to trusted snapshot','candidate category scatter rebuilt from trusted sample','170→149→136 source funnel','global marquee removed','scroll cue removed','data-first mobile hero','home search intent clarified','budget deep links','ranking H1 intent separated','compare direct-answer blocks','Korean particle fix'],productionDeployed:false};
await fs.writeFile(path.join(out,'v11-47-trust-signal.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
