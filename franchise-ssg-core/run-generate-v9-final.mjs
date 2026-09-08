import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {brandSlugFor} from './routing-v3.mjs';
import {CURATED_COMPARE_NAMES} from './content.mjs';

await import(`./run-generate-v9.mjs?final=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
async function loadClassic(file,expr){const code=await fs.readFile(file,'utf8');const ctx={console};vm.createContext(ctx);vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);return ctx.__EXPORT__}
const {categories,brands}=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=p=>`${BASE}${p==='/'?'':p}`.replace(/\/+/g,'/');
const finite=v=>v!=null&&Number.isFinite(Number(v));
const num=v=>finite(v)?Math.round(Number(v)).toLocaleString('ko-KR'):'정보 없음';
const won=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'정보 없음';
const growth=b=>finite(b?.lastStores)&&Number(b.lastStores)>0&&finite(b?.stores)?((Number(b.stores)-Number(b.lastStores))/Number(b.lastStores)*100):null;
const pct=v=>finite(v)?`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%`:'정보 없음';
const median=arr=>{const v=arr.filter(finite).map(Number).sort((a,b)=>a-b);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2};
const slugOf=b=>brandSlugFor(b.name,b.slug);
const byName=new Map(brands.map(b=>[b.name,b]));

const resetCss=`
/* v9 final: remove generic SaaS-card styling from legacy structures */
.table-wrap,.link-cards,.tool-grid,.quick-grid,.brand-grid,.calculator,.metric-row>div,.compare-strip>div,.example-grid>div{border-radius:0!important;box-shadow:none!important}
.table-wrap{border:0!important;background:transparent!important;overflow:auto}
.link-cards,.tool-grid{display:block!important;border-top:1px solid var(--ink)!important}
.link-cards>a,.tool-grid>article{display:block!important;border:0!important;border-bottom:1px solid var(--line)!important;border-radius:0!important;background:transparent!important;padding:16px 0!important;box-shadow:none!important}
.link-cards>a b,.tool-grid h2{font-family:Georgia,"Noto Serif KR",serif;font-size:19px;margin:0 0 5px}
.link-cards>a span,.tool-grid p{font-size:13px;color:var(--muted);margin:0}
.faq details{border-radius:0!important;box-shadow:none!important;background:#fff;border:0!important;border-top:1px solid var(--line)!important;padding:0!important}
.faq summary{padding:15px 0!important;font-weight:800}.faq details p{padding:0 0 15px!important;margin:0;color:var(--muted)}
.button,.actions a{border-radius:0!important;box-shadow:none!important}
.v9-hub-list{border-top:2px solid var(--ink);background:#fff}.v9-hub-list a{display:grid;grid-template-columns:minmax(170px,.8fr) minmax(0,1.5fr) auto;gap:20px;align-items:center;padding:17px 16px;border-bottom:1px solid var(--line);text-decoration:none}.v9-hub-list strong{font-family:Georgia,"Noto Serif KR",serif;font-size:18px}.v9-hub-list span{font-size:13px;color:var(--muted)}.v9-hub-list b{font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.v9-hub-kpis{display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border-top:2px solid var(--ink);border-bottom:1px solid var(--line);margin-bottom:34px}.v9-hub-kpis>div{padding:20px;border-right:1px solid var(--line)}.v9-hub-kpis>div:last-child{border-right:0}.v9-hub-kpis span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.v9-hub-kpis b{display:block;font-family:Georgia,serif;font-size:28px;margin-top:5px}
.calculator.v9-calculator{display:grid!important;grid-template-columns:minmax(0,1fr) 340px!important;gap:0 30px!important;background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important;align-items:start}.calculator.v9-calculator label{grid-column:1;background:#fff;border:0;border-top:1px solid var(--line);padding:14px 16px;margin:0!important;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.calculator.v9-calculator label:first-of-type{border-top:5px solid var(--ink)}.calculator.v9-calculator input,.calculator.v9-calculator select{width:100%;height:43px;border:1px solid #b8bec3;border-radius:0!important;background:#fff;margin-top:7px;padding:0 10px}.calculator.v9-calculator output{grid-column:2;grid-row:1/span 30;position:sticky;top:96px;background:var(--nav)!important;color:#fff!important;border:0!important;border-radius:0!important;padding:26px!important;min-height:180px;font-size:13px;line-height:1.7}.calculator.v9-calculator output b,.calculator.v9-calculator output strong{display:block;font-family:Georgia,serif;font-size:34px;line-height:1.1;margin:8px 0;color:#fff}
.calc-form-panel-head{background:#fff;border-top:6px solid var(--ink);padding:28px 30px 0;margin-bottom:28px}.calc-form-panel-head h1{font-family:Georgia,"Noto Serif KR",serif;font-size:40px;margin:5px 0 8px}.calc-form-panel-head>p{font-size:14px;color:var(--muted);margin:0 0 20px;max-width:760px}.calc-form-panel-head .profile-tabs{margin:0 -30px;padding:0 30px}
@media(max-width:800px){.v9-hub-kpis{grid-template-columns:repeat(2,1fr)}.v9-hub-list a{grid-template-columns:1fr auto}.v9-hub-list a span{grid-column:1/-1}.calculator.v9-calculator{grid-template-columns:1fr!important}.calculator.v9-calculator output{grid-column:1;grid-row:auto;position:static;margin-top:18px}.calc-form-panel-head h1{font-size:31px}}
`;
const cssPath=path.join(out,'assets','v9.css');let css=await fs.readFile(cssPath,'utf8');if(!css.includes('v9 final: remove generic SaaS-card styling'))css+=resetCss;await fs.writeFile(cssPath,css,'utf8');

const files=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}await walk(out);
for(const f of files){let h=await fs.readFile(f,'utf8');h=h.replace(/<link rel="stylesheet" href="[^"]*\/assets\/v7\.css">/g,'').replace(/<link rel="stylesheet" href="[^"]*\/assets\/v8\.css">/g,'');await fs.writeFile(f,h,'utf8')}

const catRows=Object.entries(categories).map(([slug,c])=>{const rows=brands.filter(b=>b.categorySlug===slug);return `<tr><td><a href="${url(`/rankings/${slug}/`)}">${esc(c.name)}</a></td><td class="num">${rows.length}개</td><td class="num">${won(median(rows.map(b=>b.cost)))}</td><td class="num">${finite(median(rows.map(b=>b.stores)))?`${num(median(rows.map(b=>b.stores)))}개`:'정보 없음'}</td><td class="num">${pct(median(rows.map(growth)))}</td></tr>`}).join('');
const categoriesMain=`<main id="main" data-v9-category-hub="1"><div class="shell page"><nav class="crumbs"><a href="${url('/')}">홈</a><i>›</i><span>업종</span></nav><div class="page-head"><div class="eyebrow">CATEGORY DIRECTORY</div><h1>업종별 프랜차이즈</h1><p>20개 업종의 브랜드 수, 공개 창업비용 중앙값, 가맹점 중앙값을 비교합니다.</p></div><div class="v9-hub-kpis"><div><span>업종</span><b>20</b></div><div><span>브랜드</span><b>170</b></div><div><span>비교 항목</span><b>4</b></div><div><span>추천 점수</span><b>없음</b></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>업종</th><th class="num">브랜드</th><th class="num">공개비용 중앙값</th><th class="num">가맹점 중앙값</th><th class="num">증감 중앙값</th></tr></thead><tbody>${catRows}</tbody></table></div></div></main>`;
let ch=await fs.readFile(path.join(out,'categories','index.html'),'utf8');ch=ch.replace(/<main id="main">[\s\S]*?<\/main>/,categoriesMain);await fs.writeFile(path.join(out,'categories','index.html'),ch,'utf8');

const compareRows=CURATED_COMPARE_NAMES.map(([an,bn])=>{const a=byName.get(an),b=byName.get(bn);if(!a||!b)return '';const cd=finite(a.cost)&&finite(b.cost)?Math.abs(Number(a.cost)-Number(b.cost)):null,sd=finite(a.stores)&&finite(b.stores)?Math.abs(Number(a.stores)-Number(b.stores)):null;return `<a href="${url(`/compare/${slugOf(a)}/${slugOf(b)}/`)}"><strong>${esc(a.name)} vs ${esc(b.name)}</strong><span>${esc(a.category)} · 공개비용 차이 ${won(cd)} · 가맹점 차이 ${finite(sd)?`${num(sd)}개`:'정보 없음'}</span><b>비교 →</b></a>`}).join('');
const compareMain=`<main id="main" data-v9-compare-hub="1"><div class="shell page"><nav class="crumbs"><a href="${url('/')}">홈</a><i>›</i><span>브랜드 비교</span></nav><div class="page-head"><div class="eyebrow">COMPARE</div><h1>브랜드 비교</h1><p>같은 업종의 10개 비교 조합에서 창업비용·가맹점·증감률을 나란히 봅니다.</p></div><div class="v9-hub-kpis"><div><span>비교 조합</span><b>10</b></div><div><span>비용 항목</span><b>5</b></div><div><span>점포 지표</span><b>4</b></div><div><span>승자 표시</span><b>없음</b></div></div><div class="v9-hub-list">${compareRows}</div></div></main>`;
let cp=await fs.readFile(path.join(out,'compare','index.html'),'utf8');cp=cp.replace(/<main id="main">[\s\S]*?<\/main>/,compareMain);await fs.writeFile(path.join(out,'compare','index.html'),cp,'utf8');

const toolRows=[
['프랜차이즈 창업비용 계산기','브랜드 공개비용 + 임대보증금·권리금·추가공사·운전자금','/tools/startup-cost/'],
['월 손익 계산기','월매출·원가·플랫폼비·인건비·임대료','/tools/monthly-profit-simulator/'],
['손익분기 회수기간 계산기','월 단순 잉여와 초기투자금으로 회수기간 계산','/tools/break-even/'],
['월 고정비 계산기','월세·관리비·인건비·대출·보험·통신비 합산','/tools/monthly-fixed-cost/'],
['반경 점포 수·상권 밀도','업종별 공급량과 면적 대비 밀도 계산','/tools/store-density/'],
['정보공개서 비용 항목 해독기','가맹비·교육비·보증금·인테리어 항목 구분','/tools/disclosure-decoder/'],
['가맹점 개·폐업률 계산기','신규·종료·해지 비율 계산','/tools/open-close-rate/'],
['업종 중앙값 비교','브랜드 공개비용의 업종 내 위치 확인','/tools/category-median/'],
['조건으로 브랜드 찾기','업종·비용·가맹점·증감 조건으로 170개 브랜드 필터','/tools/brand-filter/']
].map(([a,b,p])=>`<a href="${url(p)}"><strong>${a}</strong><span>${b}</span><b>열기 →</b></a>`).join('');
const toolsMain=`<main id="main" data-v9-tools-hub="1"><div class="shell page"><nav class="crumbs"><a href="${url('/')}">홈</a><i>›</i><span>계산기</span></nav><div class="page-head"><div class="eyebrow">TOOLS</div><h1>창업 계산기·데이터 도구</h1><p>창업비용, 월 손익, 점포 변화, 상권 밀도와 브랜드 조건 검색 도구를 제공합니다.</p></div><div class="v9-hub-kpis"><div><span>도구</span><b>9</b></div><div><span>브랜드 연결</span><b>170</b></div><div><span>지역 비교</span><b>12</b></div><div><span>자동 추천</span><b>없음</b></div></div><div class="v9-hub-list">${toolRows}</div></div></main>`;
let th=await fs.readFile(path.join(out,'tools','index.html'),'utf8');th=th.replace(/<main id="main">[\s\S]*?<\/main>/,toolsMain);await fs.writeFile(path.join(out,'tools','index.html'),th,'utf8');

const manifestPath=path.join(out,'route-manifest.json');const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));manifest.uiVersion=9;manifest.productEnhancements={...(manifest.productEnhancements||{}),legacyVisualCssRemoved:true,referenceSpecificHubs:true,roundedCardPatternRemoved:true};await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({v9Final:true,htmlPages:files.length,legacyCssRemoved:true,hubs:['categories','compare','tools']},null,2));