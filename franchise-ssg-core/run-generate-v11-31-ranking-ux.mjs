import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const v30=JSON.parse(await fs.readFile(path.join(out,'v11-30-category-metric-table.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const CSS_START='/* v11.31 rankings interaction */';
const CSS_END='/* v11.31 rankings interaction end */';
const SCRIPT_START='<!-- v11.31 rankings interaction -->';
const SCRIPT_END='<!-- v11.31 rankings interaction end -->';
const NAV_START='<!-- v11.31 ranking nav -->';
const NAV_END='<!-- v11.31 ranking nav end -->';

if(snap.uiVersion!=='11.26'||snap.brand_count!==136||snap.category_count!==20)throw new Error(`v11.31 snapshot gate ${snap.uiVersion}/${snap.brand_count}/${snap.category_count}`);
if(v30.uiVersion!=='11.30'||v30.metricCells!==80||v30.categoryCount!==20)throw new Error(`v11.31 v11.30 gate ${v30.uiVersion}/${v30.metricCells}/${v30.categoryCount}`);
if(candidates.length!==184||!candidates.includes('/rankings/'))throw new Error(`v11.31 candidate gate ${candidates.length}/${candidates.includes('/rankings/')}`);

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`}
function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function stripBlock(text,start,end){return text.replace(new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`,'g'),'')}
function sectionRange(html,id){const at=html.indexOf(`id="${id}"`);if(at<0)return null;const start=html.lastIndexOf('<section',at),endAt=html.indexOf('</section>',at);if(start<0||endAt<0)return null;return {start,end:endAt+10,text:html.slice(start,endAt+10)}}

const rankingPath=path.join(out,'rankings/index.html');
let html=await fs.readFile(rankingPath,'utf8');
if(!/<meta name="robots" content="noindex,nofollow/.test(html))throw new Error('v11.31 preview noindex gate failed');
const v30Section=sectionRange(html,'category-metrics');
if(!v30Section||!v30Section.text.includes('data-v30-category-metrics="1"'))throw new Error('v11.31 category metrics section missing');
if((v30Section.text.match(/data-v30-category="/g)||[]).length!==20||(v30Section.text.match(/data-v30-metric="/g)||[]).length!==80)throw new Error('v11.31 category metric DOM gate failed');

html=stripBlock(html,NAV_START,NAV_END);
html=stripBlock(html,SCRIPT_START,SCRIPT_END);

const navLinks=[
  ['category-metrics','업종지표'],
  ['per-area-ranking','3.3㎡당매출'],
  ['cost-ranking','창업비용'],
  ['store-ranking','가맹점'],
  ['sales-ranking','평균매출']
];
for(const [id] of navLinks)if(!html.includes(`id="${id}"`))throw new Error(`v11.31 navigation target missing: ${id}`);
const nav=`${NAV_START}<nav class="v31-ranking-nav" aria-label="데이터 순위 바로가기" data-v31-ranking-nav="1">${navLinks.map(([id,label])=>`<a href="#${id}">${esc(label)}</a>`).join('')}</nav>${NAV_END}`;
const categorySectionAt=html.indexOf('<section class="block v30-category-metrics"');
if(categorySectionAt<0)throw new Error('v11.31 nav insertion target missing');
html=html.slice(0,categorySectionAt)+nav+html.slice(categorySectionAt);

const oldHead='<thead><tr><th>업종</th><th class="num">브랜드</th><th>비용최저</th><th>가맹점최대</th><th>평균매출최대</th><th>3.3㎡최대</th></tr></thead>';
const newHead='<thead><tr><th scope="col" data-v31-head="category" aria-sort="ascending"><button type="button" class="v31-sort" data-v31-sort="category" data-v31-default="asc">업종<span class="v31-sort-state" aria-hidden="true">↑</span></button></th><th scope="col" class="num" data-v31-head="count"><button type="button" class="v31-sort" data-v31-sort="count" data-v31-default="desc">브랜드<span class="v31-sort-state" aria-hidden="true">↕</span></button></th><th scope="col" data-v31-head="cost"><button type="button" class="v31-sort" data-v31-sort="cost" data-v31-default="asc">비용최저<span class="v31-sort-state" aria-hidden="true">↕</span></button></th><th scope="col" data-v31-head="stores"><button type="button" class="v31-sort" data-v31-sort="stores" data-v31-default="desc">가맹점최대<span class="v31-sort-state" aria-hidden="true">↕</span></button></th><th scope="col" data-v31-head="sales"><button type="button" class="v31-sort" data-v31-sort="sales" data-v31-default="desc">평균매출최대<span class="v31-sort-state" aria-hidden="true">↕</span></button></th><th scope="col" data-v31-head="area"><button type="button" class="v31-sort" data-v31-sort="area" data-v31-default="desc">3.3㎡최대<span class="v31-sort-state" aria-hidden="true">↕</span></button></th></tr></thead>';
if(!html.includes(oldHead)&&!html.includes('data-v31-head="category"'))throw new Error('v11.31 sortable header target missing');
if(html.includes(oldHead))html=html.replace(oldHead,newHead);
html=html.replace('<section class="block v30-category-metrics" id="category-metrics" data-v30-category-metrics="1">','<section class="block v30-category-metrics v31-category-sort" id="category-metrics" data-v30-category-metrics="1" data-v31-category-sort="1">');
html=html.replace('<table class="data-table" aria-label="업종별 공개지표 최저·최대 비교">','<table class="data-table v31-sort-table" aria-label="업종별 공개지표 최저·최대 비교" data-v31-sort-table="1">');

const script=`${SCRIPT_START}<script data-v31-ranking-sort>\n(()=>{\n  const section=document.querySelector('[data-v31-category-sort="1"]');\n  if(!section)return;\n  const table=section.querySelector('[data-v31-sort-table="1"]');\n  const body=table?.tBodies?.[0];\n  if(!table||!body)return;\n  const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});\n  const buttons=[...table.querySelectorAll('[data-v31-sort]')];\n  const numericKeys=new Set(['count','cost','stores','sales','area']);\n  let activeKey='category';\n  let activeDir='asc';\n  const valueOf=(row,key)=>{\n    if(key==='category')return row.cells[0]?.textContent?.trim()||'';\n    const map={count:'v30Count',cost:'v30CostValue',stores:'v30StoresValue',sales:'v30SalesValue',area:'v30AreaValue'};\n    const raw=row.dataset[map[key]];\n    return raw===''||raw==null?null:Number(raw);\n  };\n  const compare=(a,b,key,dir)=>{\n    const av=valueOf(a,key),bv=valueOf(b,key);\n    if(av==null&&bv==null)return 0;\n    if(av==null)return 1;\n    if(bv==null)return -1;\n    const base=numericKeys.has(key)?av-bv:collator.compare(av,bv);\n    if(base!==0)return dir==='asc'?base:-base;\n    return collator.compare(a.cells[0]?.textContent?.trim()||'',b.cells[0]?.textContent?.trim()||'');\n  };\n  const setState=(key,dir)=>{\n    activeKey=key;activeDir=dir;\n    for(const button of buttons){\n      const th=button.closest('th');\n      const on=button.dataset.v31Sort===key;\n      th?.removeAttribute('aria-sort');\n      if(on)th?.setAttribute('aria-sort',dir==='asc'?'ascending':'descending');\n      const state=button.querySelector('.v31-sort-state');\n      if(state)state.textContent=on?(dir==='asc'?'↑':'↓'):'↕';\n    }\n  };\n  const sortRows=(key,dir)=>{\n    const rows=[...body.rows];\n    rows.sort((a,b)=>compare(a,b,key,dir));\n    const frag=document.createDocumentFragment();\n    for(const row of rows)frag.appendChild(row);\n    body.appendChild(frag);\n    setState(key,dir);\n  };\n  for(const button of buttons)button.addEventListener('click',()=>{\n    const key=button.dataset.v31Sort;\n    const defaultDir=button.dataset.v31Default||'asc';\n    const dir=key===activeKey?(activeDir==='asc'?'desc':'asc'):defaultDir;\n    sortRows(key,dir);\n  });\n  setState('category','asc');\n})();\n</script>${SCRIPT_END}`;
if(!html.includes('</body>'))throw new Error('v11.31 body end missing');
html=html.replace('</body>',`${script}</body>`);
await fs.writeFile(rankingPath,html,'utf8');

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
css=stripBlock(css,CSS_START,CSS_END).trimEnd();
css+=`\n\n${CSS_START}\n.v31-ranking-nav{display:flex;gap:0;overflow-x:auto;margin:28px 0 10px;border-top:1px solid #bdb5ab;border-bottom:1px solid var(--line);background:var(--paper);scrollbar-width:thin}.v31-ranking-nav a{flex:0 0 auto;min-height:44px;display:flex;align-items:center;padding:0 18px;border-right:1px solid var(--line);color:var(--text);font-size:13px;font-weight:800;white-space:nowrap}.v31-ranking-nav a:first-child{padding-left:0}.v31-ranking-nav a:last-child{border-right:0}.v31-ranking-nav a:hover{color:var(--accent);text-decoration:none}.v31-sort{width:100%;min-height:34px;display:flex;align-items:center;justify-content:space-between;gap:7px;padding:0;border:0;background:transparent;color:inherit;font:inherit;font-weight:800;text-align:left;cursor:pointer}.v31-sort-state{min-width:1em;color:var(--muted);font-size:12px}.v31-sort-table th.num .v31-sort{justify-content:flex-end}.v31-sort-table th[aria-sort="ascending"] .v31-sort,.v31-sort-table th[aria-sort="descending"] .v31-sort{color:var(--accent)}\n@media(max-width:700px){.v31-ranking-nav{margin:20px 0 4px}.v31-ranking-nav a{padding:0 14px}.v30-category-metrics .table-scroll{max-height:68vh;overflow:auto;overscroll-behavior:contain}.v31-sort-table thead th{position:sticky;top:0;z-index:4;background:#f1ede5;box-shadow:0 1px 0 var(--line)}.v31-sort-table thead th:first-child{left:0;z-index:6}.v31-sort-table tbody td:first-child{z-index:3}.v31-sort-table .v31-sort{min-height:38px}}\n${CSS_END}\n`;
await fs.writeFile(cssPath,css,'utf8');

const finalHtml=await fs.readFile(rankingPath,'utf8');
const report={
  schemaVersion:1,
  uiVersion:'11.31',
  generatedAt:new Date().toISOString(),
  snapshot:snap.snapshot_id,
  productionCandidateCount:candidates.length,
  trustedBrands:snap.brand_count,
  categoryCount:snap.category_count,
  navigationTargets:navLinks.map(([id])=>id),
  metricSortKeys:['cost','stores','sales','area'],
  auxiliarySortKeys:['category','count'],
  defaultSort:'category:asc',
  clientSideSortOnly:true,
  mobileStickyHeader:true,
  mobileTableMaxHeight:'68vh',
  metricCells:v30.metricCells,
  previewNoindex:/<meta name="robots" content="noindex,nofollow/.test(finalHtml),
  policy:'PREVIEW_ONLY;ONE_EXISTING_ROUTE;CLIENT_SIDE_SORT_ONLY;NO_QUERY_FANOUT;MOBILE_STICKY_TABLE;NO_CANDIDATE_CHANGE;NO_INDEX_CHANGE;NO_PRODUCTION_DEPLOY'
};
await fs.writeFile(path.join(out,'v11-31-ranking-ux.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_31RankingUx:'PASS',...report},null,2));
