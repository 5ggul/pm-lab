import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-25.json'),'utf8'));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const won=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'—';
const num=v=>finite(v)?Math.round(Number(v)).toLocaleString('ko-KR'):'—';
const pct=v=>finite(v)?`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%`:'—';
const fileFor=r=>path.join(out,...r.split('/').filter(Boolean),'index.html');
const rail=items=>`<div class="v25-rail">${items.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`;
function comp(b){const a=[['가맹비',b.components?.franchise],['교육비',b.components?.education],['보증금',b.components?.deposit],['기타',b.components?.etc]].filter(x=>finite(x[1])),t=a.reduce((s,x)=>s+Number(x[1]),0)||1;return `<div class="v25-stack">${a.map((x,i)=>`<i style="width:${(Number(x[1])/t*100).toFixed(1)}%;opacity:${[1,.75,.5,.3][i]}"></i>`).join('')}</div><div class="v25-legend">${a.map(x=>`<span>${x[0]} <b>${won(x[1])}</b> <em>${(Number(x[1])/t*100).toFixed(1)}%</em></span>`).join('')}</div>`}
function spark(b){const h=(b.history||[]).filter(x=>finite(x.stores));if(h.length<2)return '<span class="v25-empty">이력 없음</span>';const vals=h.map(x=>+x.stores),mn=Math.min(...vals),mx=Math.max(...vals),pts=h.map((x,i)=>`${10+i/(h.length-1)*180},${70-(mx===mn?35:(+x.stores-mn)/(mx-mn)*55)}`).join(' ');return `<svg class="v25-spark" viewBox="0 0 200 82" role="img" aria-label="가맹점 추이"><polyline points="${pts}"/></svg><div class="v25-years">${h.map(x=>`<span>${x.year}<b>${num(x.stores)}</b></span>`).join('')}</div>`}
function top(b){const c=snap.categories[b.categorySlug],delta=c?.cost?.median?((b.cost-c.cost.median)/c.cost.median*100):null;return `<section id="answer" class="v25-brandtop" data-v25-brand="1">${rail([['공개비용',won(b.cost)],['가맹점',`${num(b.stores)}개`],['평균매출',won(b.sales)],['점포변화',pct(b.growth)]])}<div class="v25-brandgrid"><div class="v25-brandpane"><h2>비용구성</h2>${comp(b)}</div><div class="v25-brandpane"><h2>점포추이</h2>${spark(b)}</div><div class="v25-brandpane"><h2>업종위치</h2><div class="v25-pos"><span>비용 <b>${b.category.costRank}/${b.category.count}</b><em>${Number(b.category.costPercentile).toFixed(0)}%</em></span><span>가맹점 <b>${b.category.storesRank}/${b.category.count}</b><em>${Number(b.category.storesPercentile).toFixed(0)}%</em></span><span>매출 <b>${b.category.salesRank}/${b.category.count}</b><em>${Number(b.category.salesPercentile).toFixed(0)}%</em></span></div></div><div class="v25-brandpane"><h2>업종중앙값</h2><div class="v25-pos"><span>창업비용 <b>${won(b.category.costMedian)}</b><em>n=${b.category.count}</em></span><span>가맹점 <b>${num(b.category.storesMedian)}개</b><em>중앙</em></span><span>평균매출 <b>${won(b.category.salesMedian)}</b><em>중앙</em></span></div></div></div><p class="v25-data-sentence">${b.sourceYear}년 공개자료 기준 ${esc(b.name)}의 공개 창업비용은 ${won(b.cost)}이며 ${esc(b.categoryName)} 업종 ${b.category.count}개 브랜드 중앙값보다 ${finite(delta)?`${Math.abs(delta).toFixed(1)}% ${delta<0?'낮습니다':'높습니다'}`:'비교값을 확인할 수 없습니다'}. 가맹점은 ${num(b.stores)}개, 평균매출 공개지표는 ${won(b.sales)}입니다.</p><div class="v25-source">공정위 공개자료 ${b.sourceYear} · 업종 표본 ${b.category.count}개 · ${esc(snap.snapshot_id)}</div></section>`}
function replaceAnswer(html,replacement){
  const start=html.indexOf('<section id="answer"');
  const boundaries=['<section class="block operator-cost"','<section class="block" id="cost"','<section class="block" id="stores"','<section class="block" id="benchmark"','<section class="block brand-position"','<section class="block" id="check"'];
  if(start<0){const headerEnd=html.indexOf('</header>');if(headerEnd<0)throw new Error('brand header boundary missing');return html.slice(0,headerEnd+9)+replacement+html.slice(headerEnd+9)}
  const ends=boundaries.map(x=>html.indexOf(x,start+1)).filter(x=>x>start);
  const end=ends.length?Math.min(...ends):html.indexOf('</article>',start);
  if(end<0)throw new Error('brand answer end boundary missing');
  return html.slice(0,start)+replacement+html.slice(end);
}
function shortBrandHeadings(html){return html
  .replace(/(<section class="block operator-cost" id="official-current-cost">[\s\S]*?<h2>)[\s\S]*?(<\/h2>)/i,'$1본사현재$2')
  .replace(/(<section class="block" id="cost"><h2>)[\s\S]*?(<\/h2>)/i,'$1비용구성$2')
  .replace(/(<section class="block" id="stores"><h2>)[\s\S]*?(<\/h2>)/i,'$1점포추이$2')
  .replace(/(<section class="block" id="benchmark"><h2>)[\s\S]*?(<\/h2>)/i,'$1업종비교$2')
  .replace(/(<section class="block brand-position" id="position"[^>]*><h2>)[\s\S]*?(<\/h2>)/i,'$1업종위치$2')
  .replace(/(<section class="block" id="check"><h2>)[\s\S]*?(<\/h2>)/i,'$1확인항목$2')
  .replace(/<h2>같은 업종에서 함께 볼 브랜드<\/h2>/g,'<h2>관련브랜드</h2>')
  .replace(/<h2>자주 묻는 질문<\/h2>/g,'<h2>FAQ</h2>')
  .replace(/(<section class="block" id="source"><h2>)[\s\S]*?(<\/h2>)/i,'$1출처$2')}
let patchedBrands=0;
for(const b of snap.brands){const file=fileFor(b.route);let html=await fs.readFile(file,'utf8'),before=html;html=replaceAnswer(html,top(b));html=html.replace(/<a href="#answer">[^<]*<\/a>/i,'<a href="#answer">지표</a>');html=shortBrandHeadings(html);if(html!==before){await fs.writeFile(file,html);patchedBrands++}}
let patchedCategories=0;
for(const [slug,c] of Object.entries(snap.categories||{})){
  const file=path.join(out,'categories',slug,'index.html');
  let html;try{html=await fs.readFile(file,'utf8')}catch{continue}
  const before=html,headStart=html.indexOf('<div class="v25-cathead"'),distStart=html.indexOf('<section class="block distribution-block"');
  if(headStart>=0&&distStart>headStart){const head=`<div class="v25-cathead"><h1>${esc(c.name)}</h1>${rail([['브랜드',`${c.count}`],['비용중앙값',won(c.cost.median)],['매출중앙값',won(c.sales.median)],['가맹점중앙값',`${num(c.stores.median)}개`],['점포변화',pct(c.growth.median)]])}</div>`;html=html.slice(0,headStart)+head+html.slice(distStart)}
  const statsStart=html.indexOf('<div class="stat-grid distribution-stats">'),scatterStart=html.indexOf('<svg class="chart-svg category-scatter"');
  if(statsStart>=0&&scatterStart>statsStart){const distRail=`<div class="v25-dist">${rail([['P25',won(c.cost.p25)],['중앙',won(c.cost.median)],['P75',won(c.cost.p75)],['표본',`${c.count}`]])}</div>`;html=html.slice(0,statsStart)+distRail+html.slice(scatterStart)}
  html=html.replace(new RegExp(`<h2>${esc(c.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')} 창업비용 분포<\\/h2>`,'g'),'<h2>창업비용 분포</h2>')
    .replace(new RegExp(`<h2>${esc(c.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')} 브랜드별 공개 창업비용<\\/h2>`,'g'),'<h2>브랜드비용</h2>');
  if(html!==before){await fs.writeFile(file,html);patchedCategories++}
}
const compareFile=path.join(out,'compare/index.html');let compare=await fs.readFile(compareFile,'utf8');compare=compare
  .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="신뢰 게이트를 통과한 ${snap.brand_count}개 브랜드 중 2~4개를 선택해 창업비용·가맹점·평균매출·점포 변화를 같은 기준으로 비교합니다.">`)
  .replace(/<div class="page-head"><h1>([^<]+)<\/h1><p>[\s\S]*?<\/p><\/div>/,'<div class="page-head"><h1>$1</h1></div>')
  .replace(/<span>두 브랜드 비교<\/span>/g,'<span>비교</span>')
  .replace(/<p class="v25-note">[\s\S]*?<\/p>/g,'');
await fs.writeFile(compareFile,compare);
console.log(JSON.stringify({v11_25LayoutCleanup:'PASS',trusted:snap.brands.length,patchedBrands,patchedCategories,compareCopyCleaned:true},null,2));
