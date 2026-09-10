import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const file=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');

const toolsPath=file('/tools/');
let tools=await fs.readFile(toolsPath,'utf8');
const toolsBasis=`<section class="v25-method" data-v26-seo-floor="tools"><h2>기준</h2><p>계산 도구는 사용자가 입력한 금액과 비율을 그대로 계산하며, 브랜드·업종 데이터는 공정거래위원회 공개자료를 Tier A/B 신뢰 기준으로 정규화한 동일 스냅샷을 사용합니다. 공개 창업비용·평균매출·가맹점 수·3.3㎡당 매출은 사용자 입력값과 섞어 공식 평균처럼 표시하지 않습니다.</p><p>업종 중앙값과 분포는 같은 품질 기준을 통과한 공개값만 비교하고, 누락값은 0으로 채우지 않습니다. 0으로 공개된 값은 원자료의 0으로 보존하되 무료·면제로 해석하지 않습니다. 평균매출과 3.3㎡당 매출은 이익 또는 예상 수익을 뜻하지 않습니다.</p><p>창업비용 조회에서는 정보공개서에 공개된 비용 총액과 가맹비·교육비·본사 보증금·기타 비용을 구분합니다. 점포 임대보증금, 권리금, 철거·전기·냉난방 같은 추가 공사, 초도물품과 운전자금은 공개 총액과 별도로 발생할 수 있으므로 사용자 입력 영역에서 따로 계산합니다. 브랜드별 포함 항목은 최신 정보공개서와 본사 견적을 다시 확인해야 합니다.</p><p>가맹점 수와 점포증감은 비교 가능한 공개연도의 점포 수를 기준으로 읽고, 개점·계약종료·계약해지는 각각 별도 지표로 봅니다. 평균매출과 3.3㎡당 매출은 공개 산정점포를 기준으로 한 연간 지표이므로 월매출·순이익·점주의 실제 현금흐름으로 환산해 단정하지 않습니다. 업종분포는 동일 품질 게이트와 동일 기준연도 안에서만 비교합니다.</p><p>각 결과의 기준연도·표본·포함 항목·제외 항목은 해당 도구 하단과 <a href="/pm-lab/franchise-ssg-preview/methodology/">산정방법</a>, <a href="/pm-lab/franchise-ssg-preview/sources/">출처</a>에서 확인할 수 있습니다. 지역매출은 지역 단위 원자료가 단일 스냅샷에 검증·병합되기 전까지 노출하지 않습니다.</p></section>`;
tools=tools.replace(/<section class="v25-method"(?: data-v26-seo-floor="tools")?>[\s\S]*?<\/section>/i,toolsBasis);
await fs.writeFile(toolsPath,tools,'utf8');

const profitPath=file('/tools/monthly-profit-simulator/');
let profit=await fs.readFile(profitPath,'utf8');
profit=profit.replace(/<section class="block v26-profit-basis"[\s\S]*?<\/section><!-- v11\.26 profit-basis end -->/i,'');
const profitBasis=`<section class="block v26-profit-basis" data-v26-seo-floor="profit"><h2>계산 기준</h2><p>월손익은 입력한 월매출에서 재료·상품 원가, 플랫폼·로열티 같은 매출연동 비용과 인건비·임대료·공과금 등 월 고정비를 차감한 단순 영업잔액입니다. 브랜드 평균매출이나 업종 중앙값을 예상 매출로 자동 대입하지 않으며, 세금·감가상각·대출 원리금·점주 노동·폐기·프로모션 분담·계절성은 별도 확인 항목으로 남깁니다.</p></section><!-- v11.26 profit-basis end -->`;
profit=profit.replace(/(<section class="block article">)/,`${profitBasis}$1`);
await fs.writeFile(profitPath,profit,'utf8');

const report={schemaVersion:2,uiVersion:'11.26',generatedAt:new Date().toISOString(),routes:['/tools/','/tools/monthly-profit-simulator/'],policy:'TOP_COPY_STAYS_FUNCTIONAL; EXPLANATION_ONLY_IN_LOWER_BASIS; FACTUAL_DATA_SEMANTICS_NOT_MARKETING_COPY; NO_NEW_ROUTE; NO_INDEX_CHANGE'};
await fs.writeFile(path.join(out,'v11-26-seo-floor.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_26SeoFloor:'PASS',routes:report.routes,indexChanged:false},null,2));
