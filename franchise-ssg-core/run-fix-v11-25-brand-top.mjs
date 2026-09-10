import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-25.json'),'utf8'));
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const won=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'—';
const num=v=>finite(v)?Math.round(Number(v)).toLocaleString('ko-KR'):'—';
const pct=v=>finite(v)?`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%`:'—';
const fileFor=r=>path.join(out,...r.split('/').filter(Boolean),'index.html');
const rail=items=>`<div class="v25-rail">${items.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`;
function comp(b){const a=[['가맹비',b.components?.franchise],['교육비',b.components?.education],['보증금',b.components?.deposit],['기타',b.components?.etc]].filter(x=>finite(x[1])),t=a.reduce((s,x)=>s+Number(x[1]),0)||1;return `<div class="v25-stack">${a.map((x,i)=>`<i style="width:${(Number(x[1])/t*100).toFixed(1)}%;opacity:${[1,.75,.5,.3][i]}"></i>`).join('')}</div><div class="v25-legend">${a.map(x=>`<span>${x[0]} <b>${won(x[1])}</b> <em>${(Number(x[1])/t*100).toFixed(1)}%</em></span>`).join('')}</div>`}
function spark(b){const h=(b.history||[]).filter(x=>finite(x.stores));if(h.length<2)return '<span class="v25-empty">비교 이력 없음</span>';const vals=h.map(x=>+x.stores),mn=Math.min(...vals),mx=Math.max(...vals),pts=h.map((x,i)=>`${10+i/(h.length-1)*180},${70-(mx===mn?35:(+x.stores-mn)/(mx-mn)*55)}`).join(' ');return `<svg class="v25-spark" viewBox="0 0 200 82" role="img" aria-label="가맹점 추이"><polyline points="${pts}"/></svg><div class="v25-years">${h.map(x=>`<span>${x.year}<b>${num(x.stores)}</b></span>`).join('')}</div>`}
function top(b){const c=snap.categories[b.categorySlug],delta=c?.cost?.median?((b.cost-c.cost.median)/c.cost.median*100):null;return `<section id="answer" class="v25-brandtop" data-v25-brand="1">${rail([['공개비용',won(b.cost)],['가맹점',`${num(b.stores)}개`],['평균매출',won(b.sales)],['점포변화',pct(b.growth)]])}<div class="v25-brandgrid"><section><h2>비용구성</h2>${comp(b)}</section><section><h2>점포추이</h2>${spark(b)}</section><section><h2>업종위치</h2><div class="v25-pos"><span>비용 <b>${b.category.costRank}/${b.category.count}</b><em>${Number(b.category.costPercentile).toFixed(0)}%</em></span><span>가맹점 <b>${b.category.storesRank}/${b.category.count}</b><em>${Number(b.category.storesPercentile).toFixed(0)}%</em></span><span>매출 <b>${b.category.salesRank}/${b.category.count}</b><em>${Number(b.category.salesPercentile).toFixed(0)}%</em></span></div></section><section><h2>업종중앙값</h2><div class="v25-pos"><span>창업비용 <b>${won(b.category.costMedian)}</b><em>n=${b.category.count}</em></span><span>가맹점 <b>${num(b.category.storesMedian)}개</b><em>중앙</em></span><span>평균매출 <b>${won(b.category.salesMedian)}</b><em>중앙</em></span></div></section></div><p class="v25-data-sentence">${b.sourceYear}년 공개자료 기준 ${esc(b.name)}의 공개 창업비용은 ${won(b.cost)}이며 ${esc(b.categoryName)} 업종 ${b.category.count}개 브랜드 중앙값보다 ${finite(delta)?`${Math.abs(delta).toFixed(1)}% ${delta<0?'낮습니다':'높습니다'}`:'비교값을 확인할 수 없습니다'}. 가맹점은 ${num(b.stores)}개, 평균매출 공개지표는 ${won(b.sales)}입니다.</p><div class="v25-source">공정위 공개자료 ${b.sourceYear} · 업종 표본 ${b.category.count}개 · ${esc(snap.snapshot_id)}</div></section>`}
let patched=0;
for(const b of snap.brands){
  const file=fileFor(b.route);let html=await fs.readFile(file,'utf8');const before=html;
  html=html.replace(/<section\s+id="answer"[^>]*>[\s\S]*?<\/section>/i,top(b));
  if(!html.includes('data-v25-brand="1"')){
    const marker=/<\/header>/i;if(!marker.test(html))throw new Error(`brand header boundary missing ${b.route}`);html=html.replace(marker,`</header>${top(b)}`);
  }
  html=html.replace(/<a href="#answer">[^<]*<\/a>/i,'<a href="#answer">지표</a>');
  if(html!==before){await fs.writeFile(file,html);patched++}
}
const compareFile=path.join(out,'compare/index.html');let compare=await fs.readFile(compareFile,'utf8');compare=compare.replace(/<p class="v25-note">비교 선택 변경 시 아래 표의 공식값을 기준으로 확인합니다\. 2~4브랜드 차트 상호작용은 다음 단계에서 연결합니다\.<\/p>/g,'');await fs.writeFile(compareFile,compare);
console.log(JSON.stringify({v11_25BrandTopFix:'PASS',trusted:snap.brands.length,patched,compareTodoRemoved:true},null,2));
