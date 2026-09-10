import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-25.json'),'utf8'));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const won=v=>finite(v)?`${Math.round(+v).toLocaleString('ko-KR')}만원`:'정보 없음';
const num=v=>finite(v)?Math.round(+v).toLocaleString('ko-KR'):'정보 없음';
const pct=v=>finite(v)?`${+v>=0?'+':''}${(+v).toFixed(1)}%`:'정보 없음';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

const toolsFile=path.join(out,'tools/index.html');
let tools=await fs.readFile(toolsFile,'utf8');
const toolsEvidence=`<section class="v25-method v25-evidence" data-v25-seo-depth="tools"><h2>데이터 기준</h2><p>계산 도구는 사용자가 직접 입력한 조건을 계산하며 결과를 실제 수익, 예상 수익 또는 추천값으로 바꾸지 않습니다. 창업비용·월고정비·월손익·회수기간에서 입력한 임대료, 권리금, 공사비, 인건비 같은 개인 조건은 공정위 공개 평균과 별도 값으로 취급합니다.</p><p>데이터 도구는 Tier A/B 신뢰 게이트를 통과한 ${snap.brand_count}개 브랜드와 ${snap.category_count}개 업종 스냅샷을 기준으로 연결합니다. 업종별 평균·중앙값·P25·P75·순위·백분위는 페이지마다 다시 계산하지 않고 같은 스냅샷에서 읽습니다.</p><p>공개 창업비용은 정보공개서에 공개된 가맹비·교육비·본사 보증금·기타 비용을 같은 단위로 정규화한 값입니다. 점포 임대보증금, 권리금, 철거, 전기증설, 냉난방, 외부공사, 초도재고, 운전자금은 공개 합계 밖에 있을 수 있어 실제 점포 견적과 분리해서 확인해야 합니다.</p><p>평균매출 공개지표는 순이익이 아니며 원가·인건비·임대료·세금 등을 차감하지 않습니다. 점포 증감도 성장성이나 안정성을 보장하는 점수가 아니므로 같은 기준연도와 같은 표본 정의 안에서만 비교합니다. 누락값은 0으로 대체하지 않으며 출처와 갱신 기준은 데이터·산정방법 페이지에 공개합니다.</p></section>`;
if(/<section class="v25-method"[^>]*>[\s\S]*?<\/section>/.test(tools))tools=tools.replace(/<section class="v25-method"[^>]*>[\s\S]*?<\/section>/,toolsEvidence);
else tools=tools.replace('</div></main>',`${toolsEvidence}</div></main>`);
await fs.writeFile(toolsFile,tools);

let categoryPatched=0;
for(const [slug,c] of Object.entries(snap.categories||{})){
  const file=path.join(out,'categories',slug,'index.html');
  let html;try{html=await fs.readFile(file,'utf8')}catch{continue}
  const marker='data-v25-seo-depth="category"';
  const evidence=`<section class="block v25-evidence" ${marker}><h2>데이터 기준</h2><p>${esc(c.name)} 업종은 신뢰 게이트를 통과한 ${c.count}개 브랜드를 같은 기준으로 비교합니다. 공개 창업비용은 P25 ${won(c.cost.p25)}, 중앙값 ${won(c.cost.median)}, P75 ${won(c.cost.p75)}이며, 평균값 ${won(c.cost.mean)}과 함께 분포의 치우침을 확인할 수 있습니다.</p><p>가맹점 수 중앙값은 ${num(c.stores.median)}개, 평균매출 공개지표 중앙값은 ${won(c.sales.median)}, 최근 비교 가능한 점포 변화율 중앙값은 ${pct(c.growth.median)}입니다. 비용·가맹점·매출의 높고 낮음은 추천이나 수익성 순위가 아니며 동일 스냅샷의 표본과 기준연도를 벗어나 해석하지 않습니다.</p><p>공개자료에 없는 임대보증금·권리금·점포별 별도공사와 실제 손익은 이 업종 통계에 포함하지 않습니다. 누락값은 0으로 채우지 않고, 원자료와 정규화 기준이 확인되는 값만 업종 분포와 중앙값 계산에 사용합니다.</p></section>`;
  if(html.includes(marker))html=html.replace(/<section class="block v25-evidence" data-v25-seo-depth="category">[\s\S]*?<\/section>/,evidence);
  else html=html.replace('</div></main><footer',`${evidence}</div></main><footer`);
  await fs.writeFile(file,html);categoryPatched++;
}

const monthlyFile=path.join(out,'tools/monthly-profit-simulator/index.html');
let monthly=await fs.readFile(monthlyFile,'utf8');
if(!monthly.includes('data-v25-seo-depth="monthly-profit"')){
  const note=`<section class="block article" data-v25-seo-depth="monthly-profit"><h2>계산 기준</h2><p>결과는 입력한 월매출과 비용 가정만 반영한 비교값이며 실제 월 순이익이나 향후 수익을 뜻하지 않습니다.</p></section>`;
  monthly=monthly.replace('</main>',`${note}</main>`);
  await fs.writeFile(monthlyFile,monthly);
}

console.log(JSON.stringify({v11_25SeoDepth:'PASS',toolsEvidence:true,categories:categoryPatched,monthlyProfit:true,topCopyRestored:false},null,2));
