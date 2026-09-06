'use strict';
const PREVIEW_DATE='2026.09.06';
const DATA_MODE='SYNTHETIC_PREVIEW';
const won=n=>n==null?'정보 없음':`${Math.round(n).toLocaleString('ko-KR')}만원`;
const num=n=>n==null?'정보 없음':Math.round(n).toLocaleString('ko-KR');
const pct=(n,d=1)=>n==null||Number.isNaN(n)?'정보 없음':`${Number(n).toFixed(d)}%`;
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const range=(seed,min,max)=>min+(hash(seed)%(max-min+1));

const categories={
 cafe:{name:'카페·커피',icon:'☕',group:'외식',desc:'커피·음료·테이크아웃',cost:[5500,18000],stores:[60,3400],sales:[22000,72000]},
 chicken:{name:'치킨',icon:'🍗',group:'외식',desc:'치킨·배달·호프 복합',cost:[7500,19000],stores:[80,2300],sales:[32000,88000]},
 burger:{name:'버거·패스트푸드',icon:'🍔',group:'외식',desc:'버거·샌드위치·패스트푸드',cost:[9000,23000],stores:[40,1500],sales:[35000,95000]},
 pizza:{name:'피자',icon:'🍕',group:'외식',desc:'피자·배달·테이크아웃',cost:[8500,21000],stores:[40,1200],sales:[30000,82000]},
 korean:{name:'한식·도시락',icon:'🍚',group:'외식',desc:'한식·도시락·보쌈·찌개',cost:[6500,24000],stores:[30,1300],sales:[28000,105000]},
 snack:{name:'분식·김밥',icon:'🍙',group:'외식',desc:'김밥·떡볶이·분식',cost:[4500,15500],stores:[40,1100],sales:[22000,68000]},
 bakery:{name:'베이커리·디저트',icon:'🥐',group:'외식',desc:'빵·아이스크림·디저트',cost:[7000,27000],stores:[40,3200],sales:[28000,98000]},
 pub:{name:'주점·호프',icon:'🍺',group:'외식',desc:'맥주·포차·주점',cost:[8500,22000],stores:[30,1000],sales:[30000,92000]},
 meat:{name:'고기·구이',icon:'🥩',group:'외식',desc:'고깃집·갈비·구이',cost:[11000,32000],stores:[25,900],sales:[42000,120000]},
 soup:{name:'국밥·탕·면',icon:'🍲',group:'외식',desc:'국밥·육개장·탕·면',cost:[7000,19000],stores:[25,800],sales:[30000,85000]},
 japanese:{name:'일식',icon:'🍣',group:'외식',desc:'돈카츠·초밥·라멘·덮밥',cost:[7500,21000],stores:[20,700],sales:[30000,90000]},
 chinese:{name:'중식',icon:'🥟',group:'외식',desc:'중식·마라·짬뽕',cost:[7000,20000],stores:[20,800],sales:[30000,92000]},
 salad:{name:'샐러드·포케',icon:'🥗',group:'외식',desc:'샐러드·포케·건강식',cost:[5500,17000],stores:[20,700],sales:[22000,70000]},
 convenience:{name:'편의점',icon:'🏪',group:'소매',desc:'편의점·생활소매',cost:[4500,12000],stores:[1800,18000],sales:[28000,76000]},
 study:{name:'스터디카페',icon:'📚',group:'서비스',desc:'스터디카페·독서실',cost:[6500,18000],stores:[40,900],sales:[12000,48000]},
 education:{name:'교육·학원',icon:'✏️',group:'서비스',desc:'교육·교습·학습센터',cost:[3500,15000],stores:[60,1800],sales:[15000,55000]},
 beauty:{name:'미용·뷰티',icon:'✂️',group:'서비스',desc:'헤어·뷰티·네일',cost:[6500,22000],stores:[30,800],sales:[25000,90000]},
 laundry:{name:'세탁·생활서비스',icon:'🧺',group:'서비스',desc:'세탁·코인세탁·생활편의',cost:[4500,18000],stores:[30,2800],sales:[12000,55000]},
 auto:{name:'자동차서비스',icon:'🚗',group:'서비스',desc:'정비·타이어·차량관리',cost:[8000,28000],stores:[30,1000],sales:[30000,120000]},
 pet:{name:'반려동물',icon:'🐾',group:'소매',desc:'펫용품·미용·케어',cost:[5500,19000],stores:[20,700],sales:[18000,68000]}
};

const brandNames={
 cafe:['메가MGC커피','컴포즈커피','빽다방','이디야커피','더벤티','매머드커피','하삼동커피','텐퍼센트커피','커피베이','카페봄봄','탐앤탐스','할리스','엔제리너스','투썸플레이스'],
 chicken:['교촌치킨','bhc치킨','BBQ치킨','굽네치킨','네네치킨','처갓집양념치킨','자담치킨','노랑통닭','푸라닭','60계치킨','또래오래','호식이두마리치킨','지코바치킨'],
 burger:['맘스터치','프랭크버거','롯데리아','노브랜드버거','뉴욕버거','버거앤프라이즈','666버거','왓더버거'],
 pizza:['피자스쿨','피자마루','반올림피자','청년피자','7번가피자','도미노피자','피자알볼로','미스터피자'],
 korean:['한솥','본죽&비빔밥','원할머니보쌈','놀부부대찌개','오봉집','채선당','두찜','유가네닭갈비','역전우동0410','새마을식당','본도시락'],
 snack:['김가네','얌샘김밥','바르다김선생','신전떡볶이','죠스떡볶이','청년다방','두끼','응급실국물떡볶이','스쿨푸드','감탄떡볶이'],
 bakery:['파리바게뜨','뚜레쥬르','배스킨라빈스','설빙','디저트39','요아정','와플대학','명랑핫도그','던킨','읍천리382'],
 pub:['역전할머니맥주','생활맥주','금별맥주','크라운호프','인쌩맥주','용용선생','한신포차','범맥주'],
 meat:['명륜진사갈비','하남돼지집','고반식당','이차돌','화로상회','팔각도','고기원칙','숙달돼지'],
 soup:['육대장','이화수전통육개장','신의주찹쌀순대','담소소사골순대육개장','큰맘할매순대국','본설렁탕','역전국밥','국밥대장'],
 japanese:['백소정','미소야','홍대개미','온센','카츠백','마제소바백소정','코이라멘','스시노칸도'],
 chinese:['홍콩반점0410','이비가짬뽕','짬뽕지존','라화쿵부','탕화쿵푸마라탕','춘리마라탕','보배반점','리춘시장'],
 salad:['샐러디','포케올데이','슬로우캘리','프레퍼스','피그인더가든','샐러드박스','포케박스','샐러드로우'],
 convenience:['CU','GS25','세븐일레븐','이마트24'],
 study:['작심스터디카페','르하임스터디카페','초심스터디카페','플랜에이스터디카페','랭스터디카페','화이트펜슬스터디카페','멘토즈스터디카페'],
 education:['윤선생','해법수학','눈높이러닝센터','셀파우등생교실','튼튼영어','잉글리시아이','아소비교육','뮤엠영어'],
 beauty:['리안헤어','박승철헤어스투디오','이철헤어커커','토리헤어','아이디헤어','로이드밤','이가자헤어비스','블루클럽'],
 laundry:['크린토피아','워시엔조이','셀피아','크린업24','런드리24','워시프렌즈','더런드리'],
 auto:['스피드메이트','티스테이션','오토오아시스','타이어뱅크','카젠','공임나라','차차차정비'],
 pet:['폴리파크','펫마트','아르르프렌즈','도그마루','펫클럽','멍이요','펫트리']
};

const specialSlugs={'메가MGC커피':'mega-mgc-coffee','컴포즈커피':'compose-coffee','빽다방':'paiks-coffee','이디야커피':'ediya-coffee','더벤티':'the-venti','교촌치킨':'kyochon-chicken','bhc치킨':'bhc-chicken','BBQ치킨':'bbq-chicken','맘스터치':'momstouch','홍콩반점0410':'hongkong-banjum'};
const regionKeys=['서울','경기','인천','부산','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'];
function makeBrand(catSlug,name,index){
 const c=categories[catSlug], seed=`${catSlug}:${name}:${index}`, slug=specialSlugs[name]||`${catSlug}-${String(index+1).padStart(2,'0')}`;
 const cost=range(seed+'c',c.cost[0],c.cost[1]), stores=range(seed+'s',c.stores[0],c.stores[1]);
 const change=range(seed+'y',-110,220)/10, lastStores=Math.max(1,Math.round(stores/(1+change/100)));
 const sales=range(seed+'a',c.sales[0],c.sales[1]), direct=Math.max(1,Math.round(stores*range(seed+'d',2,45)/1000));
 const fee=Math.round(cost*range(seed+'f',7,15)/100), education=Math.round(cost*range(seed+'e',2,6)/100), deposit=Math.round(cost*range(seed+'p',1,4)/100), interior=Math.round(cost*range(seed+'i',28,46)/100), other=Math.max(0,cost-fee-education-deposit-interior);
 const weights=regionKeys.map((r,i)=>range(seed+r+i,30,140)); const totalW=weights.reduce((a,b)=>a+b,0); const regions={}; let assigned=0;
 regionKeys.forEach((r,i)=>{const v=i===regionKeys.length-1?stores-assigned:Math.round(stores*weights[i]/totalW);regions[r]=Math.max(0,v);assigned+=v});
 return {slug,name,short:name.slice(0,6),corp:'운영사 정보 연결 예정',category:c.name,categorySlug:catSlug,group:c.group,cost,stores,direct,sales,lastStores,interior,fee,education,deposit,other,aliases:[name.replace(/\s/g,''),name.replace(/커피|치킨|스터디카페/g,'')],regions,dataMode:DATA_MODE};
}
const brands=Object.entries(brandNames).flatMap(([cat,list])=>list.map((n,i)=>makeBrand(cat,n,i)));

const areaSeeds=[
 ['seoul-gangnam','서울','강남구',1.65],['seoul-mapo','서울','마포구',1.35],['seoul-songpa','서울','송파구',1.48],['seoul-seocho','서울','서초구',1.42],['seoul-jongno','서울','종로구',1.12],['seoul-yeongdeungpo','서울','영등포구',1.25],['seoul-seongdong','서울','성동구',1.16],['seoul-gwanak','서울','관악구',1.18],
 ['gyeonggi-suwon-paldal','경기','수원 팔달구',1.12],['gyeonggi-suwon-yeongtong','경기','수원 영통구',1.08],['gyeonggi-seongnam-bundang','경기','성남 분당구',1.24],['gyeonggi-yongin-suji','경기','용인 수지구',1.02],['gyeonggi-goyang-ilsan','경기','고양 일산동구',1.05],['gyeonggi-hwaseong','경기','화성시',1.16],['gyeonggi-pyeongtaek','경기','평택시',.96],['gyeonggi-bucheon','경기','부천시',1.10],
 ['incheon-yeonsu','인천','연수구',1.10],['incheon-namdong','인천','남동구',1.00],['incheon-bupyeong','인천','부평구',.98],
 ['busan-haeundae','부산','해운대구',1.18],['busan-busanjin','부산','부산진구',1.10],['busan-suyeong','부산','수영구',.98],['busan-dongnae','부산','동래구',.92],
 ['daegu-suseong','대구','수성구',1.02],['daegu-junggu','대구','중구',.90],['daegu-dalseo','대구','달서구',1.00],
 ['daejeon-yuseong','대전','유성구',1.00],['daejeon-seogu','대전','서구',1.04],
 ['gwangju-bukgu','광주','북구',.92],['gwangju-seogu','광주','서구',.98],
 ['ulsan-namgu','울산','남구',.98],['ulsan-bukgu','울산','북구',.82],
 ['sejong','세종','세종시',.88],
 ['gangwon-chuncheon','강원','춘천시',.84],['gangwon-gangneung','강원','강릉시',.82],['gangwon-wonju','강원','원주시',.86],
 ['chungbuk-cheongju','충북','청주시',.94],['chungbuk-chungju','충북','충주시',.72],
 ['chungnam-cheonan','충남','천안시',.96],['chungnam-asan','충남','아산시',.82],
 ['jeonbuk-jeonju','전북','전주시',.92],['jeonbuk-iksan','전북','익산시',.72],
 ['jeonnam-suncheon','전남','순천시',.78],['jeonnam-yeosu','전남','여수시',.80],['jeonnam-mokpo','전남','목포시',.74],
 ['gyeongbuk-pohang','경북','포항시',.86],['gyeongbuk-gumi','경북','구미시',.82],['gyeongbuk-gyeongju','경북','경주시',.76],
 ['gyeongnam-changwon','경남','창원시',.94],['gyeongnam-gimhae','경남','김해시',.84],['gyeongnam-jinju','경남','진주시',.78],
 ['jeju-jeju','제주','제주시',1.00],['jeju-seogwipo','제주','서귀포시',.74]
];
const categoryDensity={cafe:1.7,chicken:.72,burger:.30,pizza:.32,korean:1.45,snack:.70,bakery:.74,pub:.54,meat:.63,soup:.55,japanese:.58,chinese:.49,salad:.31,convenience:.62,study:.22,education:.41,beauty:.63,laundry:.25,auto:.23,pet:.20};
const areas=areaSeeds.map(([slug,sido,name,factor],idx)=>{const base=Math.round(1500*factor+range(slug,120,920));const categoryCounts={};Object.keys(categories).forEach(k=>categoryCounts[k]=Math.max(8,Math.round(base*categoryDensity[k]*(.72+range(slug+k,0,55)/100))));return {slug,sido,name,factor,allStores:Math.round(base*8.4),foodStores:Math.round(base*4.8),areaKm2:range(slug+'km',12,96),categoryCounts,topZones:['핵심상권 A','역세권 B','주거상권 C','복합상권 D'].map((z,i)=>[z,Math.round(categoryCounts.cafe*(.31-i*.055))])};});

const guides=[
 {slug:'startup-cost-basics',title:'프랜차이즈 창업비용 구성 완전정리',summary:'가맹비·교육비·보증금·인테리어·권리금·운전자금을 분리해서 보는 법',tags:['창업비용','초기자금'],sections:['공개비용과 실제 필요자금은 다르다','가맹비·교육비·보증금 구분','인테리어와 별도공사 체크','임대차·권리금·운전자금까지 합산']},
 {slug:'disclosure-guide',title:'정보공개서에서 꼭 봐야 할 숫자',summary:'가맹점 수, 폐점, 평균매출, 비용 항목을 읽는 순서',tags:['정보공개서','공정위'],sections:['브랜드 규모보다 증감을 먼저 본다','평균매출의 기준기간 확인','가맹본부 수익구조 확인','최근 3년 변화를 함께 본다']},
 {slug:'compare-franchise',title:'프랜차이즈 2개를 비교하는 방법',summary:'비용 하나가 아니라 점포수·증감·매출지표·지역밀도를 함께 비교',tags:['브랜드비교'],sections:['같은 업종끼리 비교','비용 항목 정의 통일','점포 성장과 직영점 같이 보기','지역 과밀 여부 확인']},
 {slug:'interior-cost',title:'인테리어 비용 읽는 법',summary:'평당·기준면적·별도공사 때문에 실제 견적이 달라지는 이유',tags:['인테리어'],sections:['기준면적을 먼저 확인','평당 단가와 총액 구분','철거·전기·냉난방 별도 여부','추가공사 예산 버퍼']},
 {slug:'sales-metric',title:'가맹점 평균매출 볼 때 주의할 점',summary:'평균값 하나만으로 수익성을 판단하면 안 되는 이유',tags:['매출','수익'],sections:['매출과 영업이익은 다르다','평균과 중앙값 차이','상권·면적·운영시간 영향','비용구조와 함께 보기']},
 {slug:'store-growth',title:'가맹점 수가 늘면 좋은 브랜드일까?',summary:'신규점 증가·폐점·직영점·성숙도를 같이 보는 방법',tags:['가맹점','증감'],sections:['순증가만 보지 않는다','폐점률과 계약종료 확인','직영점 운영 의미','급성장 구간의 리스크']},
 {slug:'trade-area-density',title:'상권 업종 밀도 해석법',summary:'반경 내 동일업종 개수를 어떻게 해석해야 하는지',tags:['상권','밀도'],sections:['밀도는 수요가 아니라 공급 지표','반경 선택에 따라 결과 변화','오피스·주거·관광상권 구분','유동인구 데이터와 별개']},
 {slug:'break-even',title:'손익분기점 계산 방법',summary:'매출·원가율·인건비·임대료·수수료를 넣어 월 손익을 계산',tags:['손익분기','계산기'],sections:['변동비와 고정비 분리','부가세·세금은 별도 검토','단순 회수기간의 한계','보수적 시나리오 같이 계산']},
 {slug:'lease-check',title:'상가 임대차 전 체크리스트',summary:'보증금·월세·관리비·권리금·원상복구 조건을 비교',tags:['임대차'],sections:['월세만 보지 않는다','관리비 포함항목 확인','권리금 성격 구분','계약종료 비용 고려']},
 {slug:'franchise-contract',title:'가맹계약 전에 확인할 것',summary:'공식 정보와 실제 계약조건 사이에서 놓치기 쉬운 항목',tags:['가맹계약'],sections:['최신 정보공개서 확인','예상매출액 산정서 구분','필수품목·로열티 확인','영업지역과 계약기간 확인']},
 {slug:'low-cost-startup',title:'소자본 창업 비교할 때 보는 기준',summary:'초기비용이 낮아도 총투자금과 운영비가 커질 수 있는 이유',tags:['소자본'],sections:['공개비용과 총투자금 구분','최소면적 확인','인건비 구조 비교','운전자금 확보']},
 {slug:'data-method',title:'공공데이터 기반 창업정보 읽는 법',summary:'출처·기준연도·누락값·자체계산을 구분하는 방법',tags:['데이터','출처'],sections:['기준일 확인','누락값은 0이 아니다','공식값과 파생값 라벨링','API 업데이트 지연 고려']}
];

const sources=[
 {name:'공정거래위원회 FairData',provider:'공정거래위원회',purpose:'가맹사업 브랜드·가맹점·비용 관련 데이터 연결 대상',status:'승인·이용조건 검증 후 운영 연결',url:'https://fairdata.go.kr/ext/index.do'},
 {name:'상가(상권)정보 API',provider:'소상공인시장진흥공단',purpose:'업종·주소·좌표 기반 지역 밀도 계산 연결 대상',status:'운영 API Adapter 연결 예정',url:'https://www.data.go.kr/data/15012005/openapi.do'},
 {name:'행정구역 코드',provider:'공공데이터포털',purpose:'시도·시군구·법정동 매핑',status:'운영 연결 예정',url:'https://www.data.go.kr/'},
 {name:'창업데이터랩 파생지표',provider:'자체 계산',purpose:'중앙값·백분위·증감률·가맹점 비율·상권 밀도·시뮬레이션',status:'계산식 공개',url:'#/methodology'}
];

function bySlug(slug){return brands.find(b=>b.slug===slug)||brands[0]}
function catBrands(slug){return brands.filter(b=>b.categorySlug===slug)}
function areaBySlug(slug){return areas.find(a=>a.slug===slug)||areas[0]}
function median(arr){const v=[...arr].filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2}
function derived(b){const peers=catBrands(b.categorySlug),medCost=median(peers.map(x=>x.cost)),medStores=median(peers.map(x=>x.stores)),medSales=median(peers.map(x=>x.sales)),yoy=(b.stores-b.lastStores)/b.lastStores*100,ratio=b.stores/(b.stores+b.direct)*100;return {medCost,medStores,medSales,yoy,ratio,costVs:(b.cost-medCost)/medCost*100,storeVs:(b.stores-medStores)/medStores*100,salesVs:(b.sales-medSales)/medSales*100}}
function esc(s=''){return String(s).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]||c))}
function initials(name){return name.replace(/커피|치킨|스터디카페|헤어|피자/g,'').slice(0,2).toUpperCase()}
function route(){const raw=(location.hash||'#/').replace(/^#/,'');const [path,query='']=raw.split('?');return {raw,path,parts:path.split('/').filter(Boolean),query:new URLSearchParams(query)}}
function navigate(path){location.hash=path.startsWith('/')?path:`/${path}`}
function setTitle(title){document.title=`${title} | 창업데이터랩 Preview`}
function crumb(items){return `<div class="breadcrumbs"><a href="#/">홈</a>${items.map(i=>`<span>›</span>${i.href?`<a href="#${i.href}">${esc(i.label)}</a>`:`<span>${esc(i.label)}</span>`}`).join('')}</div>`}
function previewNotice(){return `<div class="notice"><strong>PREVIEW SYNTHETIC DATA</strong><span>브랜드명·업종 UI는 실제 서비스 검수를 위한 예시지만, 현재 숫자는 공식 통계가 아닌 결정형 합성값입니다. 정식 공개 전 공식 API Snapshot으로 교체됩니다.</span></div>`}
function sourceLine(label='공식 API 연결 전 합성 스냅샷'){return `<div class="source-line"><span>데이터 모드: ${DATA_MODE} · 확인 ${PREVIEW_DATE}</span><span><a href="#/sources">출처·전환 계획</a> · ${label}</span></div>`}
function avatar(b){return `<span class="brand-avatar">${esc(initials(b.name))}</span>`}
function brandCard(b){const d=derived(b);return `<article class="brand-card" data-brand="${b.slug}" tabindex="0"><div class="brand-card-top">${avatar(b)}<span class="category-tag">${esc(b.category)}</span></div><h3>${esc(b.name)}</h3><span class="corp">${esc(b.group)} · 공식 운영사 연결 예정</span><div class="mini-stats"><div><span>초기비용 샘플</span><b>${won(b.cost)}</b></div><div><span>가맹점 샘플</span><b>${num(b.stores)}개</b></div><div><span>증감 샘플</span><b class="${d.yoy>=0?'positive':'negative'}">${d.yoy>=0?'+':''}${pct(d.yoy)}</b></div></div></article>`}
function categoryCard(slug){const c=categories[slug],list=catBrands(slug),med=median(list.map(b=>b.cost));return `<a class="category-card" href="#/category/${slug}"><span class="category-icon">${c.icon}</span><div><b>${c.name}</b><p>${c.desc}</p></div><span class="category-meta">${list.length}개 브랜드<br>비용 중앙값 ${won(med)}</span></a>`}
function rankBrands(cat,metric='stores'){const list=cat==='all'?[...brands]:catBrands(cat);return list.sort((a,b)=>{if(metric==='cost')return a.cost-b.cost;if(metric==='growth')return derived(b).yoy-derived(a).yoy;if(metric==='sales')return b.sales-a.sales;return b.stores-a.stores})}
function categoryStats(slug){const list=catBrands(slug);return {count:list.length,costMedian:median(list.map(x=>x.cost)),storesMedian:median(list.map(x=>x.stores)),salesMedian:median(list.map(x=>x.sales)),growthMedian:median(list.map(x=>derived(x).yoy))}}
function findBrand(q=''){q=q.trim().toLowerCase();return brands.find(b=>[b.name,...b.aliases].some(x=>String(x).toLowerCase()===q))||brands.find(b=>[b.name,...b.aliases].some(x=>String(x).toLowerCase().includes(q)))}
function showToast(msg){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),2200)}
