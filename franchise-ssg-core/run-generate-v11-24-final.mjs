import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v11-23-final.mjs?v1124=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const candidateSet=new Set(candidates);
const generatedAt=new Date().toISOString();

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split('#')[0].split('?')[0].replace(/^\/+|\/+$/g,'')}/`}
function routeFile(route){return route==='/'?path.join(out,'index.html'):path.join(out,...route.split('/').filter(Boolean),'index.html')}
function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function setDescription(html,value){
  const tag=`<meta name="description" content="${esc(value)}">`;
  const re=/<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?\s*>/i;
  return re.test(html)?html.replace(re,tag):html.replace('</head>',`${tag}</head>`);
}
function removePriorPolish(html,route){
  const key=route.replace(/^\/|\/$/g,'').replace(/[^a-zA-Z0-9가-힣_-]+/g,'-')||'home';
  return html.replace(new RegExp(`<section class="block v11-24-polish" data-v11-24-polish="${key}">[\\s\\S]*?<\\/section>`,'g'),'');
}
function addBlock(html,route,inner){
  const key=route.replace(/^\/|\/$/g,'').replace(/[^a-zA-Z0-9가-힣_-]+/g,'-')||'home';
  const block=`<section class="block v11-24-polish" data-v11-24-polish="${key}">${inner}</section>`;
  html=removePriorPolish(html,route);
  if(/<article\b[^>]*>[\s\S]*<\/article>/i.test(html))return html.replace(/<\/article>/i,`${block}</article>`);
  const marker='</div></main>';
  const idx=html.lastIndexOf(marker);
  if(idx<0)throw new Error(`Unable to place v11.24 block on ${route}`);
  return html.slice(0,idx)+block+html.slice(idx);
}

const descriptions={
  '/about/':'창업데이터랩이 공정위·공공데이터 공개자료를 어떻게 정리하고, 어떤 기준으로 창업비용·가맹점·매출 비교와 계산 도구를 제공하는지 설명합니다.',
  '/contact/':'브랜드 명칭 매칭, 창업비용·가맹점·매출 지표, 출처·계산식 오류를 제보할 때 필요한 정보와 문의 범위를 안내합니다.',
  '/disclaimer/':'공개 창업비용·가맹점·평균매출과 계산기 결과의 한계, 실제 계약 전에 별도로 확인해야 할 점포비용·계약자료를 안내합니다.',
  '/methodology/':'창업비용·가맹점·평균매출·업종 중앙값을 어떤 공개자료와 정규화 규칙, 결측값 처리, 비교 기준으로 계산하는지 설명합니다.',
  '/privacy/':'창업데이터랩의 개인정보 처리 기준과 서비스 운영 과정에서 다룰 수 있는 정보, 보유·파기 원칙, 이용자 권리와 문의 기준을 안내합니다.',
  '/sources/':'브랜드별 창업비용·가맹점 수·평균매출·점포 변동에 사용하는 공정위·공공데이터포털 등 1차 출처와 기준연도를 안내합니다.',
  '/terms/':'창업데이터랩의 공개 데이터와 계산기 이용 범위, 정보 해석 책임, 금지 행위, 서비스 이용 시 확인해야 할 기준을 안내합니다.'
};

const additions={
  '/categories/':`<h2>업종 중앙값은 이렇게 읽습니다</h2><p>업종 중앙값은 같은 업종에서 공식 자료가 매칭된 브랜드들의 공개값을 크기순으로 놓았을 때 가운데에 오는 값입니다. 평균처럼 일부 큰 값에 크게 끌려가지 않아 비교 기준선으로 쓰기 좋지만, 업종의 적정 창업비용이나 추천 가격을 뜻하지는 않습니다.</p><p>업종을 비교할 때는 표본 브랜드 수를 함께 보고, 관심 브랜드 상세에서 가맹비·교육비·본사 보증금·기타비용 구성과 가맹점 변화 기준년도까지 확인하세요. 공개비용이 비슷해도 점포 임대보증금·권리금·별도공사처럼 개별 점포에서 추가되는 비용은 다를 수 있습니다.</p>`,
  '/contact/':`<h2>오류 제보에 포함하면 좋은 정보</h2><p>확인한 페이지 또는 브랜드명, 문제가 의심되는 지표와 표시값, 해당 값의 기준년도, 확인 가능한 원문 출처를 함께 알려주면 같은 레코드를 빠르게 대조할 수 있습니다. 같은 이름의 브랜드가 여럿이면 정보공개서상의 영업표지나 가맹본부명도 구분에 도움이 됩니다.</p><h2>문의 범위</h2><p>공개자료의 출처·정규화·명칭 매칭·계산식과 사이트 표시 오류를 확인하는 용도입니다. 개별 점포의 수익 보장, 특정 브랜드 추천, 계약 또는 법률 판단을 대신하지 않으며 실제 계약 조건은 최신 정보공개서와 가맹본부 자료에서 확인해야 합니다.</p>`,
  '/disclaimer/':`<h2>공개 지표를 실제 계약금액으로 바로 해석하지 않습니다</h2><p>공개 창업비용 합계에는 점포 임대보증금·권리금·철거·전기증설·외부공사·초기 운전자금처럼 점포 조건에 따라 달라지는 금액이 모두 포함되지 않을 수 있습니다. 평균매출 공개지표도 원가·인건비·임대료·세금 등을 차감한 순이익이 아닙니다.</p><p>가맹점 수와 신규·종료·해지 건수는 공개된 과거 기준년도의 관찰값입니다. 한두 해의 증감만으로 향후 성장성이나 폐업 가능성을 예측하지 않으며, 의사결정 전에는 최신 정보공개서와 실제 점포 견적을 함께 대조해야 합니다.</p>`,
  '/tools/break-even/':`<h2>한 번의 결과보다 조건을 바꿔 비교하세요</h2><p>회수기간은 월 매출과 원가율·인건비·임차비 가정에 크게 달라집니다. 하나의 결과를 확정값으로 보지 말고 보수적·기준·낙관 조건으로 입력값을 바꿔 결과 범위를 비교하세요. 특히 초기투자금에 임대보증금·권리금·추가공사와 오픈 초기 운전자금을 포함했는지 먼저 확인해야 합니다.</p>`,
  '/tools/open-close-rate/':`<h2>브랜드끼리 비교할 때는 분모와 기간을 맞춥니다</h2><p>신규율이나 종료·해지율을 비교하려면 같은 기준의 점포 수를 분모로 쓰고 동일한 공개 기준년도의 건수를 사용해야 합니다. 계약종료와 계약해지, 명의변경·재등록은 자료의 정의가 다를 수 있으므로 원문 항목을 확인해야 하며, 비율이 높거나 낮다는 사실만으로 점포 수익성을 판단하지 않습니다.</p>`,
  '/updates/':`<h2>변경 기록에 남기는 내용</h2><p>원천자료의 새 기준년도 반영, 브랜드 명칭 매칭 수정, 결측값 처리 방식과 계산식 변경을 서로 구분해 기록합니다. 출처에서 확인되지 않은 중간 연도나 누락값을 추정해 과거 데이터로 채우지 않으며, 원천자료 수정과 사이트 정규화 오류 수정도 가능한 한 구분해서 남깁니다.</p><p>숫자가 이전과 달라졌다면 먼저 기준년도와 출처가 바뀌었는지 확인하고, 동일 기준년도인데 값이 달라진 경우에는 정규화·매칭 변경 여부를 함께 확인하는 방식으로 변경 이력을 읽을 수 있습니다.</p>`
};

const changedDescriptions=[];
const changedContent=[];
for(const [route,description] of Object.entries(descriptions)){
  if(!candidateSet.has(route))throw new Error(`v11.24 description target is not a production candidate: ${route}`);
  const file=routeFile(route);let html=await fs.readFile(file,'utf8');const before=html;
  html=setDescription(html,description);
  if(html!==before){await fs.writeFile(file,html,'utf8');changedDescriptions.push(route)}
}
for(const [route,inner] of Object.entries(additions)){
  if(!candidateSet.has(route))throw new Error(`v11.24 content target is not a production candidate: ${route}`);
  const file=routeFile(route);let html=await fs.readFile(file,'utf8');const before=html;
  if(route==='/updates/')html=html.replace(/<div class="callout source"><p>공식 데이터가 준비되더라도 운영주체·연락처·비교 기준면적 등 production gate가 모두 충족되기 전에는 정식 색인을 활성화하지 않습니다\.<\/p><\/div>/i,'');
  html=addBlock(html,route,inner);
  if(html!==before){await fs.writeFile(file,html,'utf8');changedContent.push(route)}
}

manifest.v11_24={contentPolish:true,descriptionRoutes:Object.keys(descriptions),contentRoutes:Object.keys(additions),candidateSetChanged:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
const report={schemaVersion:1,uiVersion:'11.24',generatedAt,policy:'TARGETED_USER_VALUE_POLISH_ONLY; NO_FAKE_OPERATOR_CONTACT_OR_BUSINESS_FACTS; NO_NEW_ROUTES; NO_CANDIDATE_SET_CHANGE',productionCandidateCount:candidates.length,descriptionRoutes:Object.keys(descriptions),contentRoutes:Object.keys(additions),changedDescriptionRoutes:changedDescriptions,changedContentRoutes:changedContent};
await fs.writeFile(path.join(out,'v11-24-content-polish.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_24ContentPolish:'PASS',productionCandidates:candidates.length,descriptionTargets:Object.keys(descriptions).length,contentTargets:Object.keys(additions).length,changedDescriptions:changedDescriptions.length,changedContent:changedContent.length},null,2));
