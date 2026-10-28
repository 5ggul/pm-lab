import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

// Offline, manually invoked drafts. This script has no publishing or network
// client and is intentionally not part of the site's HTML generation workflow.
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const source=path.join(repo,'docs/car-data-preview');
const output=path.join(repo,'distribution/naver');
const origin='https://peekmycar.com';
const read=relative=>fs.readFileSync(path.join(source,relative),'utf8');
const catalog=JSON.parse(read('data/generated/catalog.json'));
const decode=value=>String(value).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ');
const plain=value=>decode(String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const escapeRegExp=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const sources=new Map();
function page(route){
  assert(/^\/(?:cars|compare|guide|tools)\/[a-z0-9/-]+\/$/.test(route),'Expected an existing editorial route');
  if(!sources.has(route)){
    const html=read(route.slice(1)+'index.html');
    assert(/<main\b/.test(html),route+' must have rendered main content');
    sources.set(route,{html,text:plain(html)});
  }
  return sources.get(route);
}
function quoted(route,value){
  const text=plain(value);
  assert(text&&page(route).text.includes(text),route+' draft quote must exist in rendered HTML');
  return text;
}
function idValue(route,id){
  const matches=[...page(route).html.matchAll(new RegExp('<([a-z][a-z0-9]*)\\b[^>]*\\bid=["\']'+escapeRegExp(id)+'["\'][^>]*>([\\s\\S]*?)<\\/\\1>','gi'))];
  assert.equal(matches.length,1,route+' unique rendered '+id);
  return quoted(route,matches[0][2]);
}
function labelledRow(route,label){
  const matches=[...page(route).html.matchAll(/<div\b[^>]*class="row"[^>]*>\s*<span\b[^>]*>([\s\S]*?)<\/span>\s*<strong\b[^>]*>([\s\S]*?)<\/strong>\s*<\/div>/g)].filter(match=>plain(match[1])===label);
  assert.equal(matches.length,1,route+' unique labelled row '+label);
  return quoted(route,matches[0][2]);
}
function spec(id,variantId,expected){
  const car=catalog.cars.find(car=>car.id===id),variant=car?.variants?.find(variant=>variant.id===variantId);
  assert(car&&variant,'Reviewed catalog specification '+id+'/'+variantId+' is required');
  for(const [key,value] of Object.entries(expected))assert.equal(variant[key],value,id+'/'+variantId+' '+key);
  return variant;
}
function summary(route){return ['decision-a','compare-a-energy','compare-a-tax','decision-b','compare-b-energy','compare-b-tax','decision-saving'].map(id=>idValue(route,id));}
function numericInput(route,id){
  const tags=[...page(route).html.matchAll(/<input\b[^>]*>/gi)].map(match=>match[0]).filter(tag=>new RegExp('\\bid=["\']'+escapeRegExp(id)+'["\']').test(tag));
  assert.equal(tags.length,1,route+' unique '+id+' control');
  const value=tags[0].match(/\bvalue=["']([^"']+)["']/)?.[1];
  assert(value!==undefined&&Number.isFinite(Number(value)),route+' numeric initial '+id);
  return Number(value);
}
const routes={
  hybrid:'/cars/hyundai/grandeur-gn7/hybrid/',
  grandeurs:'/compare/grandeur-gasoline-vs-hybrid/',
  wheels:'/guide/grandeur-wheel-fuel-cost/',
  k8:'/compare/grandeur-vs-k8/',
  santafe:'/compare/sorento-vs-santafe/',
  sorento:'/compare/sorento-gasoline-vs-hybrid/',
  electric:'/compare/ioniq5-vs-ev6/',
  tax:'/guide/car-tax-basics/'
};
assert(/^\d{4}-\d{2}-\d{2}$/.test(catalog.dataAsOf),'Catalog data date is required');
assert(/^\d{4}-\d{2}-\d{2}$/.test(catalog.fuelPriceAsOf),'Fuel snapshot date is required');
assert(Number.isFinite(catalog.annualKm)&&catalog.annualKm>0,'Catalog annual mileage is required');
assert.equal(catalog.annualKm,20000,'These manually selected topics describe the existing 20,000km examples');
const mileage=catalog.annualKm.toLocaleString('ko-KR')+'km';
spec('grandeur-gn7','gn7-g25-2wd-18',{drive:'2WD',wheel:18,cc:2497});
spec('grandeur-gn7','gn7-g25-2wd-20',{drive:'2WD',wheel:20,cc:2497});
spec('grandeur-gn7','gn7-hev16-2wd-18',{fuelType:'hybrid',cc:1598,wheel:18});
spec('k8-gl3','k8-g25-2wd-17',{drive:'2WD',wheel:17,cc:2497});
spec('sorento-mq4','mq4-g25-2wd-18-0',{drive:'2WD',wheel:18,cc:2497});
spec('sorento-mq4','mq4-hev16-2wd-17-0',{fuelType:'hybrid',wheel:17,cc:1598});
spec('ioniq5-ne','ne-lr-2wd-19-no-bic',{wheel:19,drive:'2WD'});
spec('ev6-cv','cv-lr-2wd-19',{wheel:19,drive:'2WD'});

const hybridTax=quoted(routes.hybrid,page(routes.hybrid).html.match(/신차 연간 정상 자동차세는\s*<strong>([^<]+)<\/strong>/)?.[1]||'');
const hybridEnergy=labelledRow(routes.hybrid,'연 2만km 유류비 · 18인치');
const hybridTotal=labelledRow(routes.hybrid,'세금 + 유류비 · 18인치');
const price=quoted(routes.hybrid,page(routes.hybrid).html.match(/전국 휘발유 평균\s+([\d,.]+원\/L)/)?.[1]||'');
assert.equal(Number(price.replace(/,/g,'').replace('원/L','')),catalog.gasPrice,'Hybrid HTML and catalog must share the fuel price');
assert(page(routes.hybrid).text.includes(catalog.fuelPriceAsOf.replaceAll('-','.')),'Hybrid HTML must show the catalog fuel date');
const grandeur=summary(routes.grandeurs),k8=summary(routes.k8),santafe=summary(routes.santafe),sorento=summary(routes.sorento);
for(const route of [routes.grandeurs,routes.k8,routes.santafe,routes.sorento]){
  assert.equal(numericInput(route,'decision-price'),catalog.gasPrice,route+' HTML and catalog share their price basis');
  assert.equal(numericInput(route,'decision-km'),catalog.annualKm,route+' HTML and catalog share their distance basis');
  assert(page(route).text.includes(catalog.fuelPriceAsOf),route+' HTML must show the catalog fuel date');
}
assert(page(routes.wheels).text.includes(price)&&page(routes.wheels).text.includes(catalog.fuelPriceAsOf),'Wheel guide and catalog must share the current fuel basis');
const electricTaxA=idValue(routes.electric,'compare-a-tax'),electricTaxB=idValue(routes.electric,'compare-b-tax');
assert.equal(electricTaxA,electricTaxB,'The draft describes equal displayed electric-car taxes');
const wheelText=page(routes.wheels).text;
const wheelDiffs=[...wheelText.matchAll(/계산상 연료비가 ([\d,]+원) 더 듭니다/g)].map(match=>quoted(routes.wheels,match[1]));
assert.equal(wheelDiffs.length,2,'The wheel guide must provide both rendered fuel differences');
const taxText=page(routes.tax).text;
const taxExample=quoted(routes.tax,taxText.match(/자동차세 본세는 [\s\S]*?연간 [\d,]+원입니다\./)?.[0]||'');

const drafts=[
  {
    slug:'01-grandeur-hybrid-tax-fuel',route:routes.hybrid,title:`그랜저 하이브리드 자동차세와 연 ${mileage} 유류비를 읽는 순서`,keywords:['그랜저 하이브리드 자동차세','그랜저 하이브리드 유류비'],
    before:[
      '그랜저 하이브리드를 볼 때 연비와 자동차세가 함께 낮아지는 이유를 구분하면 사양을 고르기 쉽습니다. 연료를 적게 쓰는 효과는 신고 복합연비로 계산하고, 자동차세는 엔진 배기량을 기준으로 계산합니다. 하이브리드에만 적용되는 별도 저율 세금을 가정한 결과가 아닙니다.',
      `이번 초고에서 인용한 페이지의 기준은 1.6 하이브리드·2WD·18인치입니다. 화면의 연간 정상 자동차세는 ${hybridTax}, 연 ${mileage} 유류비는 ${hybridEnergy}, 두 항목 합계는 ${hybridTotal}입니다. 유류비는 오피넷 ${catalog.fuelPriceAsOf} 전국 휘발유 평균 ${price}을 적용한 초기 표시값입니다. 이 금액을 매년 고정되는 주유비로 해석하면 안 됩니다.`,
      '구매할 차가 다른 휠을 쓴다면 먼저 그 휠의 신고 연비를 골라야 합니다. 같은 차명이라도 휠에 따른 효율 차이가 있으므로, 가격표의 이름만 같다고 이 예시를 그대로 옮기지 않습니다.'
    ],
    after:[
      '페이지에서 휠별 신고 수치와 대표 사양을 확인한 뒤 내 조건으로 계산하면 됩니다. 출퇴근 거리뿐 아니라 주말 운행을 포함한 연간 거리를 넣고, 유가는 내가 적용하려는 가격으로 바꾸세요. 실제 운행 연비를 알고 있다면 신고 수치와 섞지 말고 그 값을 사용하는 별도 유류비 계산으로 확인하는 편이 분명합니다.',
      '합계는 자동차세와 연료비를 합친 범위입니다. 차값 차이를 회수하는 기간이나 보험·정비·감가상각까지 포함한 차량 보유비용을 뜻하지 않습니다. 중고차는 차령에 따른 자동차세도 달라질 수 있으므로 신차 예시와 분리해 판단해야 합니다.'
    ]
  },
  {
    slug:'02-grandeur-gasoline-hybrid',route:routes.grandeurs,title:'그랜저 2.5와 하이브리드, 같은 유가와 같은 거리로 비교하기',keywords:['그랜저 가솔린 하이브리드 비교','그랜저 연료비 차이'],
    before:[
      '그랜저 가솔린과 하이브리드의 연간 합계 차이를 볼 때는 연료비와 자동차세를 먼저 나눠 읽는 편이 낫습니다. 연료비는 주행거리에 비례하지만, 같은 신차 조건의 연간 자동차세는 거리를 늘린다고 함께 늘어나지 않습니다. 합계 하나만 보면 어느 쪽에서 차이가 생겼는지 놓치기 쉽습니다.',
      `선택된 비교는 2.5 가솔린과 1.6 하이브리드이며 모두 2WD·18인치입니다. 초기 화면에는 가솔린 연료비 ${grandeur[1]}·자동차세 ${grandeur[2]}, 하이브리드 연료비 ${grandeur[4]}·자동차세 ${grandeur[5]}로 표시됩니다. 같은 휘발유 가격과 연간 거리를 적용한 결과의 결론은 ‘${grandeur[6]}’입니다.`,
      '이 차이를 전부 연비 개선 효과라고 부르면 부정확합니다. 작은 배기량으로 계산되는 자동차세 차이도 합계에 들어 있습니다. 반대로 연간 거리가 짧아져도 두 사양의 세금 차이까지 사라지는 것은 아닙니다.'
    ],
    after:[
      '비교 화면의 주행거리를 바꾸면 먼저 연료비 항목과 합계가 얼마나 달라지는지 확인하세요. 이후 내가 살 사양의 휠과 구동 조건을 다시 맞춥니다. 다른 휠의 하이브리드 사양을 고를 생각이라면 이 화면의 초기 차액을 확정 절감액으로 가져오지 않습니다.',
      '하이브리드가 차값을 언제 만회하는지는 별도의 질문입니다. 이 비교의 합계에는 구매가격·취득세·보험·정비·감가상각이 없습니다. 연간 자동차세와 연료비를 먼저 분리해서 확인한 뒤, 실제 구매 조건을 별도로 비교하는 순서가 맞습니다.'
    ]
  },
  {
    slug:'03-grandeur-wheel-fuel',route:routes.wheels,title:'그랜저 18인치와 20인치, 휠 사양에 따른 연료비 차이',keywords:['그랜저 18인치 20인치 연비','그랜저 휠 연료비'],
    before:[
      '휠을 고를 때는 차명과 엔진이 같아도 신고 연비가 같은지 먼저 확인해야 합니다. 그랜저 휠 비교 자료는 2WD 조건에서 가솔린과 하이브리드를 각각 나누어 보여 줍니다. 가솔린의 큰 휠과 하이브리드의 작은 휠을 섞으면 휠 차이와 동력 방식 차이가 한꺼번에 들어갑니다.',
      `가이드의 연 2만km 예시에서 20인치 사양의 계산상 연료비 증가는 2.5 가솔린 ${wheelDiffs[0]}, 1.6 하이브리드 ${wheelDiffs[1]}로 표시됩니다. 두 숫자는 이미 렌더된 각 비교의 차액을 인용한 것이며, 모든 그랜저나 모든 휠 변경에 공통으로 적용되는 비용은 아닙니다.`,
      '같은 엔진과 배기량을 유지한 비교에서는 자동차세 차이를 휠 효과에 더하지 않습니다. 연비가 낮아져 연료 사용량이 달라지는 부분과 배기량으로 결정되는 세금은 다른 축입니다.'
    ],
    after:[
      '표를 읽을 때는 먼저 가솔린인지 하이브리드인지 고르고, 그 안에서 휠 행을 대조하세요. 내가 달리는 거리가 예시보다 짧다면 연료비 차이도 같은 금액으로 유지되지 않습니다. 실제 주행거리와 단가로 다시 계산한 뒤 원하는 디자인이나 승차감과 함께 판단하면 됩니다.',
      '이 자료는 제조사가 신고한 사양 묶음의 비교입니다. 타이어 규격·중량·선택품목까지 따로 통제한 실험이 아니므로 차이 전부를 휠 지름 하나의 영향으로 단정할 수 없습니다. 타이어 교체비나 실측 연비를 추정해서 합계에 넣은 자료도 아닙니다.'
    ]
  },
  {
    slug:'04-grandeur-k8',route:routes.k8,title:'그랜저 vs K8, 휠이 다른 가솔린 사양의 연간 합계 비교',keywords:['그랜저 K8 연료비 비교','그랜저 K8 자동차세'],
    before:[
      '두 차의 연료비를 대조하려면 차명 다음에 붙는 조건을 먼저 읽어야 합니다. 여기서 그랜저와 K8은 모두 2.5 가솔린·2WD이지만 휠은 같지 않습니다. 그랜저는 18인치, K8은 17인치로 공개된 사양을 비교합니다. 같은 휠끼리의 실험 결과라고 소개할 수 없는 이유입니다.',
      `초기 표시에서 그랜저의 연료비는 ${k8[1]}, 자동차세는 ${k8[2]}이며, K8의 연료비는 ${k8[4]}, 자동차세는 ${k8[5]}입니다. 연간 합계는 각각 ${k8[0]}과 ${k8[3]}입니다. 이 범위에서 화면은 ‘${k8[6]}’이라고 표시합니다.`,
      '자동차세 행이 같다면 합계 차이를 세금 혜택이라고 해석하지 않습니다. 서로 다른 사양의 신고 연비를 같은 거리와 유가에 적용하면서 생긴 연료비 차이를 읽어야 합니다. 반대로 다른 엔진을 고르면 세금 조건까지 다시 확인해야 합니다.'
    ],
    after:[
      '내가 살 트림의 휠이 초기 비교와 다르면 해당 사양을 선택할 수 있는 상세·전체 비교에서 다시 확인하세요. 선택품목을 달리한 차를 보면서 이 차액을 그대로 적어 두면 비교 조건이 어긋납니다. 주행거리가 짧거나 길어질 때의 변화도 입력란에서 직접 확인할 수 있습니다.',
      '이 결론은 차의 우열 전체를 정한 순위가 아닙니다. 구매가격과 실내 공간, 보험료, 정비비 같은 항목은 이 합계에 들어 있지 않습니다. 자동차세와 연료비라는 두 항목에서 어떤 차이가 생기는지 좁혀 보는 도구로 사용하는 것이 정확합니다.'
    ]
  },
  {
    slug:'05-sorento-santafe',route:routes.santafe,title:'쏘렌토 vs 싼타페, 가솔린 사양의 연료비와 자동차세 나누어 보기',keywords:['쏘렌토 싼타페 연료비','쏘렌토 싼타페 자동차세'],
    before:[
      '가족용 SUV를 비교할 때는 좌석 수와 구동 방식이 먼저 맞는지 확인해야 합니다. 쏘렌토와 싼타페의 이 비교는 2.5 가솔린 터보·2WD·18인치 기준입니다. 다만 원문에서 묶어 표시한 인승 조건이 서로 다르므로, 같은 숫자 조건을 모두 통제한 실험으로 읽지 않습니다.',
      `현재 초기 화면의 쏘렌토 연료비는 ${santafe[1]}, 자동차세는 ${santafe[2]}입니다. 싼타페는 연료비 ${santafe[4]}, 자동차세 ${santafe[5]}로 표시됩니다. 그 합계에 대한 화면 결론은 ‘${santafe[6]}’입니다. 자동차세가 같은 조건에서는 연료비 행의 차이가 합계 차이를 설명합니다.`,
      '같은 차종 이름으로 검색해도 하이브리드나 다른 구동 사양이 함께 나올 수 있습니다. 가솔린 비교를 보면서 하이브리드의 연비나 사진 속 배지를 끌어오지 말고, 결과에 적힌 동력 방식과 사양을 기준으로 읽는 것이 우선입니다.'
    ],
    after:[
      '연간 거리는 평일 출퇴근만으로 정하지 말고 주말·휴가 운행도 함께 생각해 보세요. 거리 입력을 바꾸었을 때 연료비 차이가 어떻게 커지는지 확인하면 초기 한 줄 결론보다 내 사용 조건에 가까운 판단을 할 수 있습니다. 입력 유가 역시 기준일의 전국 평균과 내 주유 가격이 다를 수 있습니다.',
      '좌석 배치와 필요한 공간은 비용 계산 밖에서 별도로 판단해야 합니다. 이 비교가 다루는 합계는 자동차세와 연료비이며, 구매가격·보험·정비·취득세·감가상각은 빠져 있습니다. 원하는 인승과 구동 조건을 먼저 고른 뒤 비용을 대조하는 순서가 덜 헷갈립니다.'
    ]
  },
  {
    slug:'06-sorento-gasoline-hybrid',route:routes.sorento,title:'쏘렌토 가솔린과 하이브리드, 연료비 차이와 세금 차이를 구분하기',keywords:['쏘렌토 가솔린 하이브리드 비교','쏘렌토 하이브리드 자동차세'],
    before:[
      '쏘렌토 하이브리드의 연간 합계를 볼 때 가솔린과 무엇을 같게 놓았는지 먼저 확인해야 합니다. 현재 비교는 가솔린 2.5 터보·2WD·18인치와 하이브리드 1.6·2WD·5인승·17인치입니다. 동력 방식뿐 아니라 휠과 인승의 표시 조건도 함께 읽어야 합니다.',
      `초기 화면의 가솔린 연료비 ${sorento[1]}와 자동차세 ${sorento[2]}, 하이브리드 연료비 ${sorento[4]}와 자동차세 ${sorento[5]}를 나누어 볼 수 있습니다. 합계에 대한 결론은 ‘${sorento[6]}’입니다. 이 차액을 전부 하이브리드 연비 하나의 효과로 표현하지 않습니다.`,
      '자동차세는 하이브리드라는 이름에 할인 세율을 붙인 결과가 아닙니다. 해당 엔진 배기량의 세율로 계산된 값입니다. 연료비 쪽은 신고 연비에 같은 거리와 휘발유 가격을 적용하므로, 거리 입력을 바꾸면 합계 차이도 달라집니다.'
    ],
    after:[
      '필요한 좌석 수나 구동 사양이 다르다면 초기 사양 그대로 결론을 가져오지 마세요. 먼저 실제 구매 후보의 조건을 확인하고, 내 연간 거리에서 연료비와 세금이 각각 얼마인지 비교하는 편이 맞습니다. 가끔 타는 차와 장거리 출퇴근 차의 판단이 같은 차액에서 시작할 필요는 없습니다.',
      '화면의 연간 차액은 구매가격 차이를 회수하는 시점이 아닙니다. 이 합계에 구매가격이나 취득세가 들어 있지 않기 때문입니다. 연료비·자동차세만의 비교와 구매예산 비교를 분리하면 하이브리드 선택 이유를 과장하지 않고 설명할 수 있습니다.'
    ]
  },
  {
    slug:'07-ioniq5-ev6-charging',route:routes.electric,title:'아이오닉 5·EV6 자동차세는 같아도 충전비는 단가부터 확인해야 합니다',keywords:['아이오닉5 EV6 자동차세','아이오닉5 EV6 충전비'],fuel:false,
    before:[
      '전기차의 연간 자동차세와 충전비는 같은 방식으로 정해지지 않습니다. 자동차세 행은 비영업용 전기 승용차의 정액 기준이고, 충전비는 신고 전비와 거리, 적용하는 충전단가에 따라 달라집니다. 세금이 같다는 이유만으로 연간 합계까지 같다고 판단할 수 없습니다.',
      `아이오닉 5와 EV6의 현재 비교 화면에서 자동차세는 각각 ${electricTaxA}과 ${electricTaxB}로 표시됩니다. 비교 사양은 롱레인지·2WD·19인치이며 아이오닉 5는 빌트인캠 미적용 조건입니다. 다른 배터리·구동·휠 사양을 고르면 전비와 주행거리도 다시 확인해야 합니다.`,
      '비교 페이지는 비교용 충전단가 초기값을 명시하고 합계를 보여 줍니다. 그 값은 내 충전사업자의 실제 요금이거나 자동 수집한 전국 평균을 뜻하지 않습니다. 차량 상세나 다른 계산기에서 단가 입력을 요구하는 경로와도 구분해서 읽어야 합니다.'
    ],
    after:[
      '계산을 시작할 때는 집이나 직장에서 충전하는지, 공용 충전 비중이 큰지부터 정리하세요. 확인한 내 단가를 비교 입력란에 넣고 주행거리를 바꾼 뒤 충전비 행을 확인하면 됩니다. 급속·완속 요금이나 회원 요금이 섞인다면 하나의 초기값을 확정 비용으로 받아들이지 않는 것이 중요합니다.',
      '신고 전비는 같은 기준에서 사양을 대조하는 출발점입니다. 계절·속도·공조 사용에 따른 실제 전비를 보장하지 않습니다. 충전 시간이나 이동 중 충전 편의, 구매가격은 이 합계에 포함되지 않으므로 비용 결과와 별도의 질문으로 남겨 두어야 합니다.'
    ]
  },
  {
    slug:'08-car-tax-engine-capacity',route:routes.tax,title:'자동차세는 배기량과 차령으로 읽습니다: 하이브리드 전용 세율은 없습니다',keywords:['하이브리드 자동차세 세율','자동차세 지방교육세','자동차세 배기량 구간'],fuel:false,
    before:[
      '비영업용 승용차의 자동차세를 비교할 때는 연료 이름보다 배기량과 과세 조건을 먼저 확인합니다. 하이브리드가 가솔린보다 세금이 낮게 표시되는 사례는 작은 배기량의 엔진을 사용하는 사양끼리 비교했기 때문일 수 있습니다. 하이브리드라는 이름만으로 별도의 저율을 적용하는 계산은 아닙니다.',
      `현재 계산 기준 가이드의 예시는 다음과 같습니다. ‘${taxExample}’ 이 숫자는 사이트가 이미 표시하는 예시를 그대로 인용했습니다. 본세만 보고 연간 납부 추정액으로 적으면 지방교육세가 빠지므로 두 항목을 구분해 읽어야 합니다.`,
      '배기량 구간은 소득세처럼 부분별로 나누어 더하는 누진 계산으로 생각하지 않습니다. 해당 차량에 적용되는 구간의 세율을 전체 배기량에 곱하는 기준인지 먼저 확인하세요. 배기량이 비슷한 두 엔진도 세율 구간이 달라지면 세금 차이가 예상보다 커질 수 있습니다.'
    ],
    after:[
      '중고차는 같은 엔진이라도 차령이 달라져 신차 예시와 결과가 달라질 수 있습니다. 첫 등록월만으로 법정 차령기산월을 단정하기 어려운 차량도 있으므로, 계산기에 입력하는 참고월의 의미를 읽어야 합니다. 전기 승용차의 정액 세액에는 배기량 과세 차량의 차령 경감을 그대로 적용하지 않습니다.',
      '사이트 계산은 연간 자동차세를 읽는 도구입니다. 연납 할인·개별 감면·연중 등록이나 말소에 따른 일할계산을 모두 포함한 실제 고지액은 아닙니다. 예상과 고지서가 다르면 자동차세 본세, 지방교육세, 경감·감면 항목을 나누어 보고 최종 납부는 위택스와 관할 지자체 안내로 확인하세요.'
    ]
  }
];

const files=drafts.map(draft=>{
  const url=origin+draft.route;
  const basis=draft.fuel===false?'유가 인용 없음':`${catalog.fuelPriceAsOf} · 오피넷 전국 평균 · 원문 페이지의 표시값`;
  const content=`대상 URL: ${url}\n제안 제목: ${draft.title}\n검색어: ${draft.keywords.join(', ')}\n작성에 사용한 차량 데이터 기준일: ${catalog.dataAsOf} (각 공식 자료 확인일은 대상 페이지 참조)\n가격 기준일: ${basis}\n상태: 게시 전 재생성·수동 검토가 필요한 초고 — 자동 발행하지 않음\n\n# ${draft.title}\n\n${draft.before.join('\n\n')}\n\n현재 사양과 계산 조건은 아래 페이지에서 확인할 수 있습니다.\n${url}\n\n${draft.after.join('\n\n')}\n`;
  assert.equal(content.split(url).length-1,2,draft.slug+' target URL appears once in metadata and once in the body');
  assert(!/AggregateRating|Review|실제 오너|시승해|타 보니/.test(content),'No invented experience or rating');
  return {file:draft.slug+'.md',content};
});
assert.equal(files.length,8,'Exactly eight manually reviewed topics');
if(process.argv.includes('--check')){
  for(const {file,content} of files)assert.equal(fs.readFileSync(path.join(output,file),'utf8'),content,file+' draft is out of date; regenerate and review it');
}else{
  fs.mkdirSync(output,{recursive:true});
  for(const {file,content} of files)fs.writeFileSync(path.join(output,file),content);
  fs.writeFileSync(path.join(output,'README.md'),`# 네이버 블로그 검토용 초고\n\n이 폴더의 8개 글은 공개 사이트가 아닌 로컬 배포 초고입니다. 자동 발행하지 않습니다. 게시 직전 최신 사이트 산출물로 다시 생성하고 사양·단위·조건·문장을 수동 검토하세요. 검색 노출·순위를 보장하는 자료가 아닙니다.\n\n생성: \`node docs/car-data-preview/scripts/build-search-distribution.mjs\`\n\n현재 원문과 초고 일치 검사: \`node docs/car-data-preview/scripts/build-search-distribution.mjs --check\`\n\n가변 금액은 실제 생성 HTML의 표시값에서만 인용합니다. HTML에서 근거를 추출할 수 없으면 생성이 실패하며 임의 계산으로 대신하지 않습니다. 이 생성기를 실행해도 사이트 HTML·정책·사이트맵은 바뀌지 않습니다.\n`);
}
console.log(JSON.stringify({drafts:files.length,dataAsOf:catalog.dataAsOf,fuelPriceAsOf:catalog.fuelPriceAsOf,mode:process.argv.includes('--check')?'checked':'generated',publishing:false,output}));
