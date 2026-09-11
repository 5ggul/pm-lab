import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='22.0.0';
const REVIEWED='2026-09-12';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const plan21=json('data/matrix-route-plan-v21.json',{routes:[]});
const release21=json('data/release-url-set-v21.json',{urls:[]});
const answers21=json('data/answer-index-v21.json',{answers:[]});
if(plan21.version!=='21.0.0'||plan21.routes?.length!==25)throw new Error('v22 requires v21 matrix plan');
if(release21.version!=='21.0.0'||release21.urls?.length!==85)throw new Error('v22 requires v21 release set');
if(answers21.version!=='21.0.0'||answers21.answers?.length<220)throw new Error('v22 requires v21 answer index');

const EDITORIAL={
  '24-carpentry':{
    title:'24평 목공은 평수보다 고정 공정과 보강 위치를 먼저 봅니다',
    intro:'24평이라는 면적 표기만으로 목공 수량을 만들 수 없습니다. 작은 면적에서도 문틀, 커튼박스, 천장 단차, 가벽처럼 면적과 직접 비례하지 않는 고정 공정이 생길 수 있어 총액보다 공정별 수량을 먼저 분리해야 합니다.',
    checks:['가벽은 신설·철거 위치와 길이를 따로 적었는지 확인','천장 단차·간접등 박스·커튼박스의 길이와 구간을 분리','석고보드 겹수와 합판 보강 위치를 자재명만이 아니라 적용 위치로 확인','문틀·몰딩·걸레받이와 제작가구가 목공 항목에 함께 묶였는지 확인'],
    qa:[
      ['24평이면 목공 견적도 큰 평수보다 항상 낮나요?','그렇다고 단정할 수 없습니다. 문틀, 천장 박스, 가벽 같은 고정 공정은 공급평수와 선형으로 움직이지 않으므로 실제 길이와 개소를 확인해야 합니다.'],
      ['석고보드 공개가격에 면적을 곱하면 목공 견적이 되나요?','아닙니다. 공개 자재가격은 석고보드 자체 참고값이고 각재, 보강, 절단, 시공 인력, 마감 범위와 현장 조건을 포함한 민간 목공 총액이 아닙니다.'],
      ['24평 목공 견적 두 개는 무엇부터 맞춰야 하나요?','가벽·천장·문틀·몰딩·보강 위치의 수량과 사양을 같은 칸으로 맞춘 뒤 금액을 비교합니다.']
    ]
  },
  '30-bathroom':{
    title:'30평 욕실은 욕실 개수와 방수·타일 범위를 먼저 고정합니다',
    intro:'30평이라는 주택 면적만으로 욕실이 몇 개인지, 벽 타일이 어디까지 올라가는지 정할 수 없습니다. 욕실 견적은 욕실 수와 각 욕실의 철거, 방수, 벽·바닥 타일, 배관 이동 범위를 분리해야 비교가 가능합니다.',
    checks:['욕실 1개·2개 여부를 평수로 추정하지 말고 실제 개수를 입력','벽 타일과 바닥 타일 면적을 한 수량으로 합치지 않았는지 확인','방수는 바닥·벽체 높이·공법을 별도 확인','도기·수전·천장·환풍기·배관 이동이 1식 안에 포함됐는지 확인'],
    qa:[
      ['30평이면 욕실 2개 기준으로 계산해도 되나요?','아닙니다. 같은 공급평수라도 욕실 수와 구조가 다를 수 있으므로 실제 욕실 개수를 확인해야 합니다.'],
      ['욕실 타일 공공단가와 조달청 타일 가격을 더하면 되나요?','자동으로 더하면 안 됩니다. 공공 시공 참고단가의 재료 포함 범위와 조달청 자재 규격이 정확히 대응하는지 먼저 확인해야 합니다.'],
      ['30평 욕실 견적에서 가장 먼저 비교할 수량은 무엇인가요?','욕실 개수, 벽·바닥 타일 실제 면적, 방수 범위와 배관 이동 개소를 먼저 맞추는 편이 안전합니다.']
    ]
  },
  '30-wallpaper':{
    title:'30평 도배는 공급면적 대신 벽·천장 작업범위를 나눕니다',
    intro:'도배는 공급평수에 단가를 바로 곱하는 공사가 아닙니다. 천장 포함 여부, 벽 높이, 붙박이장과 타일처럼 도배하지 않는 면, 기존 벽지 제거와 바탕보수 범위가 실제 작업량을 바꿉니다.',
    checks:['벽과 천장을 같은 면적으로 처리하지 않고 각각의 포함 여부 확인','실크·합지 등 벽지 사양과 초배 포함 여부 확인','기존 벽지 철거 횟수와 곰팡이·균열 등 바탕보수 범위 확인','붙박이장·주방가구·타일 면처럼 도배 제외 면을 실제 현장 기준으로 확인'],
    qa:[
      ['30평 도배 면적을 30평으로 넣으면 되나요?','아닙니다. 30평은 공급면적 라벨이고 도배는 벽과 천장의 실제 작업면적을 사용해야 합니다.'],
      ['벽지 자재 중앙값이 도배 시공 단가인가요?','아닙니다. 조달청 자재가격은 벽지 자재 참고층이고 시공 인력과 바탕보수, 부자재를 포함한 민간 도배 견적과 다릅니다.'],
      ['도배 견적 비교에서 천장 포함 여부가 왜 중요한가요?','같은 평수라도 천장 포함 여부가 실제 작업면적과 공정 수를 바꾸므로 총액 차이를 해석하기 전에 조건을 맞춰야 합니다.']
    ]
  },
  '30-floor':{
    title:'30평 바닥은 실제 시공 공간과 철거 범위를 따로 확인합니다',
    intro:'30평 전체가 바닥 마감 대상이라는 가정은 피해야 합니다. 욕실, 발코니, 현관, 주방 일부처럼 다른 마감이 적용되는 공간이 있고 기존 마루 철거·샌딩·바탕정리 여부에 따라 같은 자재라도 견적 범위가 달라집니다.',
    checks:['실제 바닥 시공 공간을 방·거실·주방 등으로 확인','기존 마루·장판 철거와 폐기물 반출 포함 여부 확인','마루·장판 자재 종류와 규격, 걸레받이 포함 여부 확인','바탕면 샌딩·미장·레벨링 같은 보수 공정을 별도 확인'],
    qa:[
      ['30평이면 바닥 시공면적도 약 99㎡인가요?','자동으로 같다고 볼 수 없습니다. 공급면적 환산값과 실제 바닥 마감 면적은 다른 값입니다.'],
      ['장판 조달청 가격과 바닥 공공 시공단가를 합산해도 되나요?','규격과 재료 포함조건이 정확히 맞는지 확인하지 않은 상태에서는 합산하지 않습니다.'],
      ['바닥 견적이 다른 가장 흔한 조건 차이는 무엇인가요?','자재 종류뿐 아니라 기존 바닥 철거, 바탕보수, 걸레받이와 폐기물 포함 여부를 함께 확인해야 합니다.']
    ]
  },
  '30-carpentry':{
    title:'30평 목공은 방 개수보다 실제 제작·보강 항목을 분해합니다',
    intro:'30평이라는 면적이나 예상 방 개수만으로 목공 수량을 정하지 않습니다. 가벽, 천장, 문틀, 몰딩, 보강, 제작가구가 한 줄의 목공 1식에 묶이면 업체 간 차이가 어느 공정에서 생겼는지 확인할 수 없습니다.',
    checks:['목공 1식을 가벽·천장·문틀·몰딩·보강으로 분해','TV·가구·주방 설치를 위한 합판 보강 위치와 면적 확인','문·문틀 교체가 목공인지 별도 도어 항목인지 확인','제작가구 금액이 목공과 중복 계산되지 않는지 확인'],
    qa:[
      ['30평 목공은 방 개수로 대략 계산할 수 있나요?','방 개수만으로는 부족합니다. 천장과 가벽, 문틀, 보강 위치처럼 서로 다른 단위를 가진 공정을 따로 확인해야 합니다.'],
      ['목공 1식이라고 적혀 있으면 잘못된 견적인가요?','1식 표기 자체가 잘못은 아니지만 비교하려면 내부 공정과 수량을 추가로 받아야 합니다.'],
      ['합판과 석고보드 가격만 알면 목공 적정가를 알 수 있나요?','아닙니다. 공개 자재가격은 원가 참고층이며 시공 인력, 각재, 가공, 현장 난이도와 마감 범위를 포함하지 않습니다.']
    ]
  },
  '34-bathroom':{
    title:'34평 욕실은 평수보다 욕실별 공사 범위 차이를 봅니다',
    intro:'34평이라는 표기만으로 욕실 개수나 사양을 확정하지 않습니다. 공용욕실과 부부욕실처럼 공간별로 철거 방식, 방수 범위, 타일 규격, 도기 교체 범위가 다르면 한 개의 평균 단가보다 욕실별 조건표가 더 중요합니다.',
    checks:['욕실마다 철거·덧방 여부를 따로 기록','방수 벽체 높이와 바닥 범위를 욕실별로 확인','타일 규격과 벽·바닥 면적을 욕실별로 분리','젠다이·파티션·욕조·배관 이동 같은 선택 공정을 별도 표시'],
    qa:[
      ['34평 욕실은 보통 두 개라고 가정해도 되나요?','가정하지 않습니다. 실제 도면과 현장을 기준으로 욕실 개수를 입력해야 합니다.'],
      ['욕실 두 개면 한 개 비용의 두 배로 보면 되나요?','그렇지 않을 수 있습니다. 각 욕실의 크기와 철거 방식, 방수, 타일, 배관과 선택 공정이 다를 수 있습니다.'],
      ['34평 욕실 견적에서 공공단가는 어디에 쓰나요?','타일 붙임이나 방수처럼 동일 단위의 특정 공정을 이해하는 참고값으로만 사용하고 민간 욕실 전체 적정가격으로 환산하지 않습니다.']
    ]
  },
  '34-wallpaper':{
    title:'34평 도배는 면적 증가를 선형 비용 증가로 해석하지 않습니다',
    intro:'24평에서 34평으로 공급면적이 늘었다고 도배 작업량과 비용이 같은 비율로 늘어난다고 볼 수 없습니다. 천장 높이, 방 구성, 창과 문 면적, 붙박이장, 바탕 상태가 실제 도배 면적과 인력 투입에 영향을 줍니다.',
    checks:['공급평수 비율로 도배비를 단순 확대하지 않기','벽·천장 각각의 실제 작업 범위 확인','벽지 종류와 같은 제품군 안에서도 규격·등급을 확인','퍼티·초배·곰팡이 제거 등 바탕 공정의 포함조건 확인'],
    qa:[
      ['34평 도배비는 24평보다 34/24배라고 보면 되나요?','아닙니다. 도배 실제 면적과 바탕 상태, 천장 포함 여부가 달라 단순 비례식으로 비교하지 않습니다.'],
      ['도배 공공단가는 민간 업체 견적과 바로 비교 가능한가요?','공정 단위와 범위가 충분히 유사할 때 참고할 수 있지만 일반 아파트 소비자 총액과 같은 값으로 보지 않습니다.'],
      ['34평 도배 견적에서 바탕보수는 왜 따로 보나요?','기존 벽 상태에 따라 퍼티·초배·곰팡이 처리 범위가 크게 달라질 수 있어 벽지 시공과 분리해야 차이를 설명할 수 있습니다.']
    ]
  },
  '34-floor':{
    title:'34평 바닥은 마감 제외 공간과 바탕 공정을 먼저 뺍니다',
    intro:'공급면적 34평 전체를 바닥 공사 수량으로 쓰지 않습니다. 현관·욕실·발코니 등 다른 마감 공간과 가구 하부 처리 방식, 기존 바닥 철거 범위를 확인한 뒤 실제 바닥 면적을 입력해야 합니다.',
    checks:['바닥 마감 제외 공간을 도면·현장 기준으로 확인','기존 자재 철거와 폐기물 처리비를 새 마감과 분리','강마루·원목마루·장판 등 자재 종류와 규격 확인','문턱 제거·걸레받이·바닥 레벨링 포함 여부 확인'],
    qa:[
      ['34평을 112.4㎡로 바꾼 값을 바닥 수량으로 써도 되나요?','아닙니다. 112.4㎡는 공급면적의 단순 환산값이며 실제 바닥 마감 면적이 아닙니다.'],
      ['바닥 자재 중앙값만으로 업체 견적이 비싼지 판단할 수 있나요?','판단할 수 없습니다. 자재 외 철거, 시공, 바탕보수, 부자재와 현장조건이 포함될 수 있습니다.'],
      ['34평 바닥 견적 비교에서 가장 먼저 제외할 것은 무엇인가요?','욕실·현관·발코니처럼 다른 마감이 적용되는 공간과 공사하지 않는 구간을 실제 현장 기준으로 확인합니다.']
    ]
  },
  '34-carpentry':{
    title:'34평 목공은 천장·가벽·문틀·보강을 서로 다른 단위로 봅니다',
    intro:'목공은 하나의 면적 단가로 정리하기 어려운 공종입니다. 34평에서도 천장 단차는 면적, 몰딩은 길이, 문틀은 개소, 가구 보강은 위치별 면적으로 관리하는 편이 견적 차이를 설명하기 쉽습니다.',
    checks:['천장 평탄화와 간접등 박스를 같은 항목으로 묶지 않기','가벽은 길이·높이와 내부 보강 사양 확인','문틀·몰딩·걸레받이는 개소와 길이 기준 확인','벽걸이 TV·상부장·거울 등 설치 보강 위치를 사전에 표시'],
    qa:[
      ['34평 목공을 ㎡ 단가 하나로 비교해도 되나요?','권장하지 않습니다. 목공 안에는 길이, 면적, 개소처럼 단위가 다른 공정이 함께 들어갑니다.'],
      ['천장 목공과 간접등 박스는 같은 항목인가요?','업체 견적에서는 묶일 수 있지만 비교할 때는 범위와 길이, 조명 관련 전기공사 포함 여부를 분리하는 편이 좋습니다.'],
      ['목공 공공 참고와 자재가격 차이는 무엇인가요?','공공 시공 참고는 특정 공정의 예정가격 참고층이고 조달청 자재가격은 자재층입니다. 두 값을 자동 합산해 민간 적정가를 만들지 않습니다.']
    ]
  },
  '40-carpentry':{
    title:'40평 목공은 면적 효과와 복잡도 효과를 분리합니다',
    intro:'40평처럼 공급면적이 커져도 목공비가 면적 비율만큼 움직인다고 단정할 수 없습니다. 몰딩·천장처럼 길이와 면적이 늘 수 있는 공정과 문틀·커튼박스·보강처럼 개수와 설계 복잡도에 좌우되는 공정을 따로 봐야 합니다.',
    checks:['넓어진 면적과 상관없이 개소 기준인 문틀·박스 항목을 분리','천장 평탄화 면적과 우물천장·간접등 구조를 별도 확인','긴 몰딩·걸레받이는 실제 시공 길이 기준으로 확인','대형 가구·TV·주방 상부장 보강이 목공에 포함되는지 위치별 확인'],
    qa:[
      ['40평 목공비는 30평보다 약 4/3배라고 보면 되나요?','아닙니다. 일부 면적 공정은 늘 수 있지만 개소와 설계 복잡도에 좌우되는 공정도 있어 단순 비례로 계산하지 않습니다.'],
      ['40평에서는 목공 자재비 비중이 항상 커지나요?','항상 그렇다고 볼 수 없습니다. 설계와 보강, 시공 난이도, 인력 투입이 달라 실제 견적의 구성비가 달라질 수 있습니다.'],
      ['40평 목공 견적을 비교할 때 첫 번째로 받을 자료는 무엇인가요?','천장·가벽·문틀·몰딩·보강 위치를 수량과 단위가 보이는 공정표로 받는 것이 좋습니다.']
    ]
  }
};

const keyOf=r=>`${r.pyeong}-${r.trade}`;
const promoted=new Set(Object.keys(EDITORIAL));
const routes22=plan21.routes.map(r=>{
  const key=keyOf(r),hasData=Number(r.public_ref_count)>0&&Number(r.material_group_count)>0;
  if(r.status==='RELEASE')return {...r,status:'RELEASE',release_source:'v21'};
  if(promoted.has(key)&&hasData)return {...r,status:'RELEASE',release_source:'v22_editorial'};
  return {...r,status:'HOLD',release_source:null,hold_reason:Number(r.public_ref_count)===0?'reference_gap':'data_or_editorial_gap'};
});
const releaseRoutes=routes22.filter(r=>r.status==='RELEASE');
const holdRoutes=routes22.filter(r=>r.status==='HOLD');
if(releaseRoutes.length!==20||holdRoutes.length!==5)throw new Error(`unexpected v22 route split ${releaseRoutes.length}/${holdRoutes.length}`);

const editorialRecords=[];
const addedAnswers=[];
for(const r of routes22.filter(x=>x.release_source==='v22_editorial')){
  const key=keyOf(r),e=EDITORIAL[key];
  if(!e)throw new Error(`missing editorial ${key}`);
  const rel=r.path;
  let h=read(rel);
  h=h.replace(/<section class="v6-section" data-v22-editorial>[\s\S]*?<\/section>/,'');
  h=h.replace(/<script type="application\/ld\+json" data-v22-faq>[\s\S]*?<\/script>/,'');
  const marker=`<section class="v6-section"><div class="site-shell"><h2>${r.pyeong}평 ${r.trade_label} 견적에서 확인할 조건</h2>`;
  if(!h.includes(marker))throw new Error(`editorial marker missing ${rel}`);
  const checks=e.checks.map((x,i)=>`<div class="v21-checkitem"><strong>${i+1}. ${esc(x)}</strong><span>이 조건을 원 견적서에서 확인한 뒤 같은 범위끼리 비교합니다.</span></div>`).join('');
  const qa=e.qa.map(([q,a])=>`<article><h3>${esc(q)}</h3><p>${esc(a)}</p></article>`).join('');
  const sameP=routes22.filter(x=>x.pyeong===r.pyeong&&x.trade!==r.trade&&x.status==='RELEASE').slice(0,3);
  const sameT=routes22.filter(x=>x.trade===r.trade&&x.pyeong!==r.pyeong&&x.status==='RELEASE').slice(0,3);
  const links=[...sameP,...sameT].map(x=>`<a href="${BASE}/${x.path.replace(/index\.html$/,'')}">${x.pyeong}평 ${esc(x.trade_label)}</a>`).join(' · ');
  const section=`<section class="v6-section" data-v22-editorial><div class="site-shell"><p class="kicker">EDITORIAL REVIEW · V22</p><h2>${esc(e.title)}</h2><p>${esc(e.intro)}</p><div class="v21-checklist">${checks}</div><div class="faq-list" data-v22-faq-list><h2>${r.pyeong}평 ${esc(r.trade_label)} 견적 질문</h2>${qa}</div><p><strong>같이 확인할 경로</strong> · ${links}</p><p>이 편집 검수는 검색용 문구를 늘리기 위한 것이 아니라, 같은 템플릿에서 평수 숫자만 바뀌는 페이지가 되지 않도록 실제 비교 조건과 판단 경계를 조합별로 분리한 것입니다.</p></div></section>`;
  h=h.replace(marker,section+marker);
  const faqSchema={'@context':'https://schema.org','@type':'FAQPage',mainEntity:e.qa.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))};
  h=h.replace('</head>',`<script type="application/ld+json" data-v22-faq>${JSON.stringify(faqSchema).replace(/</g,'\\u003c')}</script></head>`);
  write(rel,h);
  const pageUrl=`${BASE}/${rel.replace(/index\.html$/,'')}`;
  e.qa.forEach(([question,answer],i)=>addedAnswers.push({id:`v22-${key}-${i+1}`,category:'평수×공종',question,answer,source:pageUrl,status:'published',url:pageUrl,evidence_fallback:false}));
  editorialRecords.push({key,path:rel,pyeong:r.pyeong,trade:r.trade,trade_label:r.trade_label,reviewed_on:REVIEWED,title:e.title,check_count:e.checks.length,faq_count:e.qa.length,public_ref_count:r.public_ref_count,material_group_count:r.material_group_count});
}
if(editorialRecords.length!==10||addedAnswers.length!==30)throw new Error('editorial batch incomplete');
write('data/matrix-editorial-v22.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,editorial_count:editorialRecords.length,faq_count:addedAnswers.length,records:editorialRecords},null,2));
write('data/matrix-route-plan-v22.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,policy:'v21 release plus manually reviewed v22 editorial wave; insulation stays held until reference layer exists',route_count:routes22.length,release_count:releaseRoutes.length,hold_count:holdRoutes.length,routes:routes22},null,2));

const releaseUrls=[...(release21.urls||[])];
for(const r of routes22.filter(x=>x.release_source==='v22_editorial')){
  if(!releaseUrls.some(x=>x.path===r.path))releaseUrls.push({path:r.path,url:`${SITE}/${r.path.replace(/index\.html$/,'')}`,role:'longtail',phase:'WAVE3',primary_intent:r.owner_intent});
}
releaseUrls.sort((a,b)=>a.path.localeCompare(b.path,'en'));
write('data/release-url-set-v22.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,simulation_only:true,actual_preview_noindex_unchanged:true,base_v21_count:release21.total_count,matrix_routes:25,matrix_release:20,matrix_hold:5,new_candidates:10,total_count:releaseUrls.length,urls:releaseUrls},null,2));

const gate={version:VERSION,reviewed_on:REVIEWED,policy:'release_requires_existing_v21_gate_or_manual_editorial_review_and_data_layers',preview_indexing:false,production_switch:false,route_count:25,release_count:20,hold_count:5,rules:{editorial_review_required_for_v22_promotions:true,public_reference_required:true,official_material_group_required:true,pyeong_used_as_work_area:false,automatic_cross_layer_sum:false,private_market_average_from_public_data:false,hold_routes_must_not_enter_release_set:true},release_routes:releaseRoutes.map(x=>x.path),hold_routes:holdRoutes.map(x=>({path:x.path,reason:x.hold_reason||'reference_gap'})),reason_definitions:{reference_gap:'해당 조합에 연결할 표준시장단가 ㎡ 참고 항목이 없어 출시 조건을 충족하지 못한 조합',data_or_editorial_gap:'공공 참고·공식 자재 또는 편집 검수 조건이 충분하지 않은 조합'}};
write('data/matrix-release-gate-v22.json',JSON.stringify(gate,null,2));

const cutover={version:VERSION,reviewed_on:REVIEWED,simulation_only:true,applied:false,owner_approval_required:true,current_preview_robots:'noindex,nofollow',release_count:20,hold_count:5,rules:{release_if_approved:'index,follow',hold:'noindex,follow',hold_never_in_sitemap:true,hold_never_in_search_console_batch:true,bulk_noindex_removal_forbidden:true},routes:routes22.map(r=>({path:r.path,status:r.status,future_robots_if_approved:r.status==='RELEASE'?'index,follow':'noindex,follow'}))};
write('data/matrix-cutover-simulation-v22.json',JSON.stringify(cutover,null,2));

const combinedAnswers=[...(answers21.answers||[]),...addedAnswers];
write('data/answer-index-v22.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,count:combinedAnswers.length,base_v21_count:answers21.count,added_v22:addedAnswers.length,answers:combinedAnswers},null,2));

let matrix=read('interior-cost/matrix/index.html');
matrix=matrix.replace(/<div class="v21-boundary" data-v22-release-note>[\s\S]*?<\/div>/,'');
matrix=matrix.replace('출시 후보</span><strong>10개</strong>','출시 후보</span><strong>20개</strong>');
matrix=matrix.replace('현재는 기존 핵심 평수와 데이터 레이어가 충분한 조합 10개만 출시 후보로 두고 나머지 15개는 HOLD입니다.','v22 편집 검수까지 통과한 조합 20개를 출시 후보로 두고, 공공 시공 참고 레이어가 비어 있는 단열 5개 조합만 HOLD로 유지합니다.');
for(const r of routes22.filter(x=>x.release_source==='v22_editorial')){
  const href=`${BASE}/${r.path.replace(/index\.html$/,'')}`;
  matrix=matrix.replace(`<a class="v21-route-link v21-hold" href="${href}">견적 확인<small>추가 검토</small></a>`,`<a class="v21-route-link" href="${href}">견적 확인<small>편집 검수 완료</small></a>`);
}
const note='<div class="v21-boundary" data-v22-release-note><p><strong>v22 편집 검수 결과</strong></p><p>30평·34평 조합과 목공 조합 10개는 평수 숫자만 바꾼 복제 설명을 사용하지 않고 조합별 비교 조건·FAQ를 별도 편집해 RELEASE 후보로 승격했습니다. 단열 5개는 표준시장단가 ㎡ 참고층이 비어 있어 HOLD를 유지합니다.</p></div>';
matrix=matrix.replace('<div data-v21-matrix-filter>',note+'<div data-v21-matrix-filter>');
write('interior-cost/matrix/index.html',matrix);

let llms=read('llms.txt');
llms=llms.replace(/\n# v22 editorial matrix[\s\S]*?# end v22 editorial matrix\n?/,'\n');
llms+=`\n# v22 editorial matrix\n- release candidates: 20 / 25 matrix routes\n- editorial promotions: 10 routes with route-specific comparison conditions and FAQ\n- hold: 5 insulation routes due to missing public reference layer\n- answer index: ${combinedAnswers.length} answers\n- no public-data-to-private-average conversion; no automatic cross-layer sum\n# end v22 editorial matrix\n`;
write('llms.txt',llms);

write('data/site-quality-v22.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,matrix_routes:25,matrix_release:20,matrix_hold:5,editorial_promotions:10,editorial_faqs:30,release_candidates:releaseUrls.length,answer_count:combinedAnswers.length,preview_noindex:true,actual_production_switch:false,actual_search_console_submission:false,actual_ads_injected:false},null,2));
console.log(JSON.stringify({version:VERSION,editorial_promotions:10,matrix_release:20,matrix_hold:5,release_candidates:releaseUrls.length,answer_count:combinedAnswers.length},null,2));
