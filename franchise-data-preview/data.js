const PREVIEW_DATE = '2026.09.06';
const won = (n) => n == null ? '정보 없음' : `${Math.round(n).toLocaleString('ko-KR')}만원`;
const moneyWon = (n) => n == null ? '정보 없음' : `${Math.round(n * 10000).toLocaleString('ko-KR')}원`;
const num = (n) => n == null ? '정보 없음' : Math.round(n).toLocaleString('ko-KR');
const pct = (n, digits = 1) => n == null || Number.isNaN(n) ? '정보 없음' : `${n.toFixed(digits)}%`;

const brands = [
  {slug:'mega-mgc-coffee',name:'메가MGC커피',short:'메가',corp:'앤하우스',category:'카페',categorySlug:'cafe',cost:8620,stores:3260,direct:18,sales:34700,lastStores:2980,interior:3150,fee:1100,education:330,deposit:200,other:3840,aliases:['메가커피','메가 커피','MGC','메가MGC'],regions:{'서울':480,'경기':820,'부산':190,'대구':170,'인천':220,'기타':1380}},
  {slug:'compose-coffee',name:'컴포즈커피',short:'컴포즈',corp:'컴포즈커피',category:'카페',categorySlug:'cafe',cost:7810,stores:2820,direct:12,sales:32500,lastStores:2550,interior:2890,fee:990,education:220,deposit:150,other:3560,aliases:['컴포즈','컴포즈 커피'],regions:{'서울':390,'경기':750,'부산':280,'대구':160,'인천':180,'기타':1060}},
  {slug:'paiks-coffee',name:'빽다방',short:'빽',corp:'더본코리아',category:'카페',categorySlug:'cafe',cost:9240,stores:1720,direct:28,sales:37100,lastStores:1580,interior:3380,fee:1100,education:330,deposit:250,other:4180,aliases:['백다방','빽 다방'],regions:{'서울':310,'경기':480,'부산':120,'대구':90,'인천':110,'기타':610}},
  {slug:'ediya-coffee',name:'이디야커피',short:'이디야',corp:'이디야',category:'카페',categorySlug:'cafe',cost:11080,stores:2980,direct:45,sales:30100,lastStores:3050,interior:4200,fee:1320,education:330,deposit:300,other:4930,aliases:['이디야','EDIYA'],regions:{'서울':520,'경기':760,'부산':170,'대구':130,'인천':190,'기타':1210}},
  {slug:'the-venti',name:'더벤티',short:'벤티',corp:'더벤티코리아',category:'카페',categorySlug:'cafe',cost:7450,stores:1380,direct:9,sales:28900,lastStores:1240,interior:2710,fee:880,education:220,deposit:150,other:3490,aliases:['더 벤티','벤티'],regions:{'서울':210,'경기':360,'부산':180,'대구':95,'인천':80,'기타':455}},
  {slug:'kyochon-chicken',name:'교촌치킨',short:'교촌',corp:'교촌에프앤비',category:'치킨',categorySlug:'chicken',cost:13200,stores:1370,direct:6,sales:74800,lastStores:1340,interior:4650,fee:1500,education:500,deposit:300,other:6250,aliases:['교촌','교촌 치킨'],regions:{'서울':190,'경기':380,'부산':105,'대구':82,'인천':95,'기타':518}},
  {slug:'bhc-chicken',name:'bhc치킨',short:'bhc',corp:'다이닝브랜즈그룹',category:'치킨',categorySlug:'chicken',cost:11850,stores:1960,direct:8,sales:63200,lastStores:1880,interior:4200,fee:1400,education:440,deposit:300,other:5510,aliases:['BHC','비에이치씨','bhc 치킨'],regions:{'서울':250,'경기':530,'부산':145,'대구':115,'인천':130,'기타':790}},
  {slug:'bbq-chicken',name:'BBQ치킨',short:'BBQ',corp:'제너시스BBQ',category:'치킨',categorySlug:'chicken',cost:12740,stores:2020,direct:11,sales:59800,lastStores:1940,interior:4550,fee:1480,education:450,deposit:300,other:5960,aliases:['비비큐','BBQ','BBQ 치킨'],regions:{'서울':270,'경기':540,'부산':150,'대구':125,'인천':135,'기타':800}},
  {slug:'momstouch',name:'맘스터치',short:'맘터',corp:'맘스터치앤컴퍼니',category:'버거',categorySlug:'burger',cost:15400,stores:1430,direct:22,sales:68100,lastStores:1380,interior:5680,fee:1650,education:480,deposit:350,other:7240,aliases:['맘터','맘스 터치'],regions:{'서울':210,'경기':400,'부산':110,'대구':95,'인천':90,'기타':525}},
  {slug:'hongkong-banjum',name:'홍콩반점0410',short:'홍콩반점',corp:'더본코리아',category:'중식',categorySlug:'chinese',cost:12100,stores:310,direct:7,sales:61200,lastStores:295,interior:4900,fee:1320,education:440,deposit:300,other:5140,aliases:['홍콩반점','0410'],regions:{'서울':72,'경기':96,'부산':25,'대구':18,'인천':19,'기타':80}}
];

const areas = [
  {slug:'seoul-gangnam',sido:'서울',name:'강남구',category:'카페',categorySlug:'cafe',stores:2930,allFood:8620,areaKm2:39.5,avgDensity:49.2,topDongs:[['역삼동',610],['논현동',418],['삼성동',362],['청담동',284]]},
  {slug:'seoul-mapo',sido:'서울',name:'마포구',category:'카페',categorySlug:'cafe',stores:1880,allFood:6240,areaKm2:23.9,avgDensity:49.2,topDongs:[['서교동',490],['연남동',260],['합정동',235],['망원동',180]]},
  {slug:'seoul-jongno',sido:'서울',name:'종로구',category:'카페',categorySlug:'cafe',stores:1430,allFood:4940,areaKm2:23.9,avgDensity:49.2,topDongs:[['종로1·2·3·4가동',315],['혜화동',128],['사직동',116],['삼청동',109]]},
  {slug:'busan-haeundae',sido:'부산',name:'해운대구',category:'카페',categorySlug:'cafe',stores:1280,allFood:4580,areaKm2:51.4,avgDensity:18.4,topDongs:[['우동',340],['중동',205],['좌동',190],['송정동',135]]},
  {slug:'gyeonggi-suwon-paldal',sido:'경기',name:'수원 팔달구',category:'카페',categorySlug:'cafe',stores:720,allFood:3180,areaKm2:12.9,avgDensity:31.1,topDongs:[['인계동',245],['매산동',118],['행궁동',105],['우만동',74]]},
  {slug:'incheon-yeonsu',sido:'인천',name:'연수구',category:'카페',categorySlug:'cafe',stores:990,allFood:3640,areaKm2:56.2,avgDensity:16.1,topDongs:[['송도동',430],['연수동',168],['동춘동',132],['옥련동',95]]}
];

const categories = {
  cafe:{name:'카페',description:'커피·음료 프랜차이즈'},
  chicken:{name:'치킨',description:'치킨 프랜차이즈'},
  burger:{name:'버거',description:'버거·패스트푸드'},
  chinese:{name:'중식',description:'중식 프랜차이즈'}
};

const sources = [
  {name:'공정거래위원회 FairData',provider:'공정거래위원회',purpose:'브랜드 가맹점·직영점, 브랜드 비교, 인테리어 비용 등 가맹사업 데이터',license:'API별 이용조건 확인 필요',url:'https://fairdata.go.kr/ext/index.do'},
  {name:'상가(상권)정보 API',provider:'소상공인시장진흥공단',purpose:'전국 상가의 업종·주소·좌표 기반 지역/업종 밀도 계산',license:'공공데이터포털 이용허락범위 확인',url:'https://www.data.go.kr/data/15012005/openapi.do'},
  {name:'공공데이터포털',provider:'행정안전부',purpose:'공공 API 메타데이터, 최신 활용조건 및 제공기관 검증',license:'데이터셋별 라이선스 적용',url:'https://www.data.go.kr/'},
  {name:'창업데이터랩 파생지표',provider:'자체 계산',purpose:'업종 중앙값, 백분위, 전년 대비 증감, 비용 차이, 상권 밀도 및 계산기 결과',license:'공식 원본 데이터가 아닌 자체 계산값',url:'#/methodology'}
];

function bySlug(slug){ return brands.find(b => b.slug === slug) || brands[0]; }
function catBrands(slug){ return brands.filter(b => b.categorySlug === slug); }
function median(arr){ const v=[...arr].sort((a,b)=>a-b); const m=Math.floor(v.length/2); return v.length%2?v[m]:(v[m-1]+v[m])/2; }
function percentile(value, arr, higherIsBetter=true){
  const sorted=[...arr].sort((a,b)=>a-b); const below=sorted.filter(x=>x<value).length; const equal=sorted.filter(x=>x===value).length;
  const raw=(below + Math.max(0,equal-1)/2)/Math.max(1,sorted.length-1)*100; return higherIsBetter?raw:100-raw;
}
function derived(b){
  const peers=catBrands(b.categorySlug); const medCost=median(peers.map(x=>x.cost)); const medStores=median(peers.map(x=>x.stores));
  const yoy=(b.stores-b.lastStores)/b.lastStores*100; const ratio=b.stores/(b.stores+b.direct)*100;
  return {medCost,medStores,yoy,ratio,costVs:(b.cost-medCost)/medCost*100,storeVs:(b.stores-medStores)/medStores*100,costPercentile:percentile(b.cost,peers.map(x=>x.cost),false),storePercentile:percentile(b.stores,peers.map(x=>x.stores),true)};
}
function esc(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function initials(name){ return name.replace(/커피|치킨|0410/g,'').slice(0,2).toUpperCase(); }
function route(){ const raw=(location.hash||'#/').replace(/^#/,''); const parts=raw.split('/').filter(Boolean); return {raw,parts}; }
function setTitle(title){ document.title=`${title} | 창업데이터랩 Preview`; }
function track(name,detail={}){ try{ console.info('[preview-event]',name,detail); }catch(e){} }
function navigate(path){ location.hash=path.startsWith('/')?path:`/${path}`; }
function crumb(items){return `<div class="breadcrumbs"><a href="#/">홈</a>${items.map(i=>`<span>›</span>${i.href?`<a href="#${i.href}">${esc(i.label)}</a>`:`<span>${esc(i.label)}</span>`}`).join('')}</div>`;}
function previewNotice(){return `<div class="notice"><strong>검수용 샘플 데이터</strong><span>현재 공개 URL의 수치는 레이아웃·계산·사용성 검수를 위한 예시입니다. 실제 서비스 전환 시 이용허락이 확인된 공식 API 스냅샷으로 교체됩니다.</span></div>`;}
function sourceLine(label='공정거래위원회 FairData 연결 예정'){return `<div class="source-line"><span>기준: 샘플 2025 · 확인 ${PREVIEW_DATE}</span><span>출처 구조: <a href="#/sources">${label}</a></span></div>`;}
function avatar(b){return `<span class="brand-avatar">${esc(initials(b.name))}</span>`;}
function brandCard(b){const d=derived(b);return `<article class="brand-card" data-brand="${b.slug}" tabindex="0"><div class="brand-card-top">${avatar(b)}<span class="category-tag">${b.category}</span></div><h3>${esc(b.name)}</h3><span class="corp">${esc(b.corp)}</span><div class="mini-stats"><div><span>공개비용 예시</span><b>${won(b.cost)}</b></div><div><span>가맹점 예시</span><b>${num(b.stores)}개</b></div><div><span>증감</span><b class="${d.yoy>=0?'positive':'negative'}">${d.yoy>=0?'+':''}${pct(d.yoy)}</b></div></div></article>`;}
