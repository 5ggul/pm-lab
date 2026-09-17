import fs from 'node:fs';
import path from 'node:path';

const BASE='/pm-lab/franchise-ssg-preview';
const PREVIEW='https://5ggul.github.io/pm-lab/franchise-ssg-preview';
const ROBOTS='<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">';

const marks={
  brandsRail:['<!-- v11.52 discovery hubs brands rail: start -->','<!-- v11.52 discovery hubs brands rail: end -->'],
  brandsFaq:['<!-- v11.52 discovery hubs brands faq: start -->','<!-- v11.52 discovery hubs brands faq: end -->'],
  categoriesRail:['<!-- v11.52 discovery hubs categories rail: start -->','<!-- v11.52 discovery hubs categories rail: end -->'],
  categoriesFaq:['<!-- v11.52 discovery hubs categories faq: start -->','<!-- v11.52 discovery hubs categories faq: end -->'],
  exploreRail:['<!-- v11.52 discovery hubs explore rail: start -->','<!-- v11.52 discovery hubs explore rail: end -->'],
  exploreFaq:['<!-- v11.52 discovery hubs explore faq: start -->','<!-- v11.52 discovery hubs explore faq: end -->']
};

const card=(kicker,title,copy,href,attrs='')=>`<a class="v52-discovery-card" href="${BASE}${href}" ${attrs}><small>${kicker}</small><strong>${title}</strong><span>${copy}</span></a>`;
const faq=(q,a)=>`<details><summary>${q}</summary><p>${a}</p></details>`;

const BRANDS_RAIL=`${marks.brandsRail[0]}<section class="v52-discovery-rail" data-v52-discovery-rail="brands" aria-labelledby="v52-brands-next"><div class="v52-discovery-head"><span>다음 행동</span><h2 id="v52-brands-next">어떤 기준부터 볼까요?</h2></div><div class="v52-discovery-cards">${card('예산이 먼저','예산으로 후보 좁히기','5천·7천·1억·1억5천·2억원 공개비용 기준과 업종을 함께 봅니다.','/explore/')}${card('업종이 먼저','업종 중앙값부터 보기','20개 업종의 분석 표본과 공개 창업비용 중앙값을 확인합니다.','/categories/')}${card('후보가 있다','브랜드끼리 비교하기','선택한 후보의 공개비용·가맹점·평균매출 공개지표를 같은 화면에서 봅니다.','/compare/')}${card('실제 자금 확인','총 준비자금 계산하기','공개 창업비용과 임대·권리금·추가공사·운전자금을 분리해 합산합니다.','/tools/startup-cost/')}</div></section>${marks.brandsRail[1]}`;

const BRANDS_FAQS=[
 ['표의 창업비용이 실제 총투자금과 같은가요?','아닙니다. 이 표는 공정위 공개 창업비용을 비교용 기준으로 사용합니다. 임대보증금·권리금·별도공사·운전자금 등 실제 점포별 추가비용은 별도일 수 있습니다.'],
 ['최대 창업비용 필터는 어떤 숫자를 기준으로 하나요?','브랜드별 공정위 공개 창업비용을 기준으로 필터링합니다. 가맹본부가 현재 별도로 공개한 개설비 근거가 있는 브랜드도 이 필터의 공정위 수치를 덮어쓰지 않습니다.'],
 ['가맹점 증감률이 높으면 더 좋은 브랜드인가요?','그렇게 해석하지 않습니다. 점포 변화는 공개된 점포 수의 변화일 뿐 수익성·안정성·추천 점수가 아닙니다. 기준연도와 신규·종료·해지 흐름을 함께 확인해야 합니다.'],
 ['정보 없음은 0원이나 0개라는 뜻인가요?','아닙니다. 비교 가능한 공식 값이 없다는 뜻입니다. 확인되지 않은 값을 0으로 채워 비용이 낮거나 점포가 없는 것처럼 표시하지 않습니다.']
];
const BRANDS_FAQ=`${marks.brandsFaq[0]}<section class="v52-discovery-faq" data-v52-discovery-faq="brands" aria-labelledby="v52-brands-faq-title"><div class="v52-discovery-head"><span>FAQ</span><h2 id="v52-brands-faq-title">브랜드 목록을 볼 때 자주 묻는 기준</h2></div><div class="v52-discovery-faq-list">${BRANDS_FAQS.map(x=>faq(...x)).join('')}</div></section>${marks.brandsFaq[1]}`;

const CATEGORIES_RAIL=`${marks.categoriesRail[0]}<section class="v52-discovery-rail" data-v52-discovery-rail="categories" aria-labelledby="v52-categories-next"><div class="v52-discovery-head"><span>다음 행동</span><h2 id="v52-categories-next">업종을 고르는 순서</h2></div><div class="v52-discovery-cards">${card('20개 업종','업종 기준선 비교','각 업종의 공식 매칭 수·분석 표본·공개 창업비용 중앙값을 먼저 봅니다.','/categories/','#').replace(' href="'+BASE+'/categories/" #',' href="#v52-category-grid"')}${card('예산도 함께','예산×업종 교차 확인','내 예산 이하 후보가 업종별로 몇 개인지 바로 좁힙니다.','/explore/')}${card('브랜드 찾기','업종으로 브랜드 필터','브랜드 목록에서 업종·비용·가맹점·점포 변화를 함께 필터링합니다.','/brands/')}${card('후보 비교','최대 4개 비교','업종을 본 뒤 남은 후보를 같은 지표 기준으로 나란히 확인합니다.','/compare/')}</div></section>${marks.categoriesRail[1]}`;

const CATEGORIES_FAQS=[
 ['업종 중앙값은 적정 창업비용이나 추천 가격인가요?','아닙니다. 같은 업종에서 분석 가능한 공개값을 크기순으로 놓았을 때 가운데에 오는 비교 기준선입니다. 실제 적정 투자금이나 추천 가격을 뜻하지 않습니다.'],
 ['공식 매칭 수와 분석 표본 수가 왜 다른가요?','공식 데이터에서 브랜드 식별이 확인돼도 특정 지표가 결측이면 그 지표의 중앙값 계산에서는 제외될 수 있습니다. 그래서 업종별 공식 매칭 수와 실제 분석 n을 따로 표시합니다.'],
 ['업종 중앙값 하나만 보고 업종을 선택해도 되나요?','중앙값만으로 판단하기 어렵습니다. 가맹점 규모·점포 변화·평균매출 공개지표와 개별 브랜드 비용 구성, 실제 점포 추가비용을 함께 확인해야 합니다.'],
 ['일부 업종의 공개 창업비용이 매우 낮아 보이는 이유는 무엇인가요?','업종과 계약 형태에 따라 공개비용에 포함되는 항목이 다를 수 있습니다. 공개 창업비용이 낮다고 실제 총 준비자금까지 낮다는 뜻은 아닙니다.']
];
const CATEGORIES_FAQ=`${marks.categoriesFaq[0]}<section class="v52-discovery-faq" data-v52-discovery-faq="categories" aria-labelledby="v52-categories-faq-title"><div class="v52-discovery-head"><span>FAQ</span><h2 id="v52-categories-faq-title">업종 중앙값을 해석할 때</h2></div><div class="v52-discovery-faq-list">${CATEGORIES_FAQS.map(x=>faq(...x)).join('')}</div></section>${marks.categoriesFaq[1]}`;

const EXPLORE_RAIL=`${marks.exploreRail[0]}<section class="v52-discovery-rail" data-v52-discovery-rail="explore" aria-labelledby="v52-explore-next"><div class="v52-discovery-head"><span>탐색 순서</span><h2 id="v52-explore-next">조건을 좁힌 다음 바로 이어가기</h2></div><div class="v52-discovery-cards">${card('STEP 1','예산·업종 좁히기','이 화면에서 공개비용·업종·가맹점·평균매출 공개지표 조건을 먼저 좁힙니다.','/explore/','#').replace(' href="'+BASE+'/explore/" #',' href="#finder"')}${card('STEP 2','브랜드 목록에서 이어보기','현재 예산·업종 조건을 브랜드 필터로 넘겨 이름과 점포 변화까지 확인합니다.','/brands/','data-v52-directory-handoff')}${card('STEP 3','후보끼리 비교','남은 후보를 최대 4개까지 같은 공개지표로 비교합니다.','/compare/')}${card('STEP 4','총 준비자금 계산','공개비용 외 임대·권리금·추가공사·운전자금을 별도로 더합니다.','/tools/startup-cost/')}</div><p class="v52-discovery-note" data-v52-handoff-note>브랜드 목록 인계는 선택한 예산 프리셋과 업종을 이어갑니다.</p></section>${marks.exploreRail[1]}`;

const EXPLORE_FAQS=[
 ['예산 이하 브랜드 수는 실제 총투자금이 그 금액 이하라는 뜻인가요?','아닙니다. 공정위 공개 창업비용이 해당 기준 이하라는 뜻입니다. 임대보증금·권리금·별도공사·운전자금 등 실제 추가비용은 포함되지 않을 수 있습니다.'],
 ['7천만원 이하 같은 예산 기준은 어떻게 계산하나요?','신뢰 게이트를 통과한 브랜드 중 비교 가능한 공정위 공개 창업비용이 입력한 예산 이하인 브랜드를 세어 표시합니다. 결측값은 0원으로 간주하지 않습니다.'],
 ['평균매출 공개지표가 높으면 수익도 높다고 볼 수 있나요?','그렇게 볼 수 없습니다. 평균매출 공개지표는 점주 순이익이 아니며 원가·인건비·임차료·수수료·세금 등 비용 구조를 포함하지 않습니다.'],
 ['후보를 좁힌 뒤 무엇을 확인해야 하나요?','브랜드 상세에서 비용 구성과 점포 흐름을 확인하고, 비교 화면에서 후보를 나란히 본 뒤 총 준비자금 계산기에서 점포별 추가비용을 별도로 입력하는 순서를 권합니다.']
];
const EXPLORE_FAQ=`${marks.exploreFaq[0]}<section class="v52-discovery-faq" data-v52-discovery-faq="explore" aria-labelledby="v52-explore-faq-title"><div class="v52-discovery-head"><span>FAQ</span><h2 id="v52-explore-faq-title">예산별 찾기를 해석할 때</h2></div><div class="v52-discovery-faq-list">${EXPLORE_FAQS.map(x=>faq(...x)).join('')}</div></section>${marks.exploreFaq[1]}`;

function requireRoot(root){if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');}
function replaceMarked(text,[start,end],block){const a=text.indexOf(start),b=text.indexOf(end);if((a<0)!=(b<0))throw new Error(`Incomplete discovery marker ${start}`);if(a<0)return null;if(b<a)throw new Error(`Reversed discovery marker ${start}`);return text.slice(0,a)+block+text.slice(b+end.length);}
function addBefore(text,needle,block,label){if(!text.includes(needle))throw new Error(`${label} insertion point missing`);return text.replace(needle,block+needle);}
function ensureAssetTags(html){const css=`<link rel="stylesheet" href="${BASE}/assets/discovery-hubs.css" data-v52-discovery-hubs>`;const js=`<script src="${BASE}/assets/discovery-hubs.js" defer data-v52-discovery-hubs></script>`;if(!html.includes('/assets/discovery-hubs.css'))html=html.replace('</head>',css+'</head>');if(!html.includes('/assets/discovery-hubs.js'))html=html.replace('</body>',js+'</body>');return html;}
function faqJsonLd(items){return JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:items.map(([name,text])=>({'@type':'Question',name,acceptedAnswer:{'@type':'Answer',text}}))});}
function addJsonLd(html,attr,obj){if(html.includes(attr))return html;return html.replace('</head>',`<script type="application/ld+json" ${attr}>${typeof obj==='string'?obj:JSON.stringify(obj)}</script></head>`);}
function parseCategoryItems(html){const grid=html.match(/<div class="report-grid"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';const items=[...grid.matchAll(/<a href="([^"]+)"><strong>([^<]+)<\/strong>/g)].map((m,i)=>({'@type':'ListItem',position:i+1,name:m[2],url:PREVIEW+m[1].replace(BASE,'')}));if(items.length!==20)throw new Error(`Category ItemList requires 20 cards, got ${items.length}`);return items;}

function applyBrands(root){const file=path.join(root,'brands/index.html');let html=fs.readFileSync(file,'utf8'),before=html;if(!html.includes('data-v10-directory="1"')||!html.includes('<h1>프랜차이즈 브랜드 찾기</h1>'))throw new Error('Brands hub shape mismatch');if(!html.includes('<option value="7000">7,000만원</option>')){const needle='<option value="5000">5,000만원</option><option value="10000">1억원</option>';if(!html.includes(needle))throw new Error('Brands cost options baseline changed');html=html.replace(needle,'<option value="5000">5,000만원</option><option value="7000">7,000만원</option><option value="10000">1억원</option>');}
  let next=replaceMarked(html,marks.brandsRail,BRANDS_RAIL);html=next??addBefore(html,'<div class="directory-controls">',BRANDS_RAIL,'brands rail');
  if(!html.includes('data-v52-directory-empty')){const needle='<p class="scroll-hint">표는 옆으로 밀어 확인할 수 있습니다.</p>';if(!html.includes(needle))throw new Error('Brands empty-state insertion point missing');html=html.replace(needle,needle+`<div class="v52-directory-empty" data-v52-directory-empty hidden><strong>조건에 맞는 브랜드가 없습니다.</strong><span>필터를 완화하거나 같은 예산·업종을 예산별 찾기에서 다시 확인하세요.</span><a href="${BASE}/explore/" data-v52-explore-handoff>예산별 찾기에서 이어보기</a></div>`);}
  next=replaceMarked(html,marks.brandsFaq,BRANDS_FAQ);html=next??addBefore(html,'<div class="callout source"><strong>데이터 처리 원칙</strong>',BRANDS_FAQ,'brands faq');
  html=addJsonLd(html,'data-v52-discovery-brands-app',{'@context':'https://schema.org','@type':'WebApplication','name':'프랜차이즈 브랜드 찾기','url':PREVIEW+'/brands/','applicationCategory':'BusinessApplication','operatingSystem':'Web','description':'136개 공개 후보 브랜드를 업종, 공정위 공개 창업비용, 가맹점 수와 점포 변화 기준으로 검색하고 정렬하는 도구'});
  html=addJsonLd(html,'data-v52-discovery-brands-faq',faqJsonLd(BRANDS_FAQS));html=ensureAssetTags(html);if(html!==before)fs.writeFileSync(file,html);return html!==before;
}
function applyCategories(root){const file=path.join(root,'categories/index.html');let html=fs.readFileSync(file,'utf8'),before=html;const baseGrid='<div class="report-grid">',integratedGrid='<div class="report-grid" id="v52-category-grid" data-v52-category-grid="1">';const hasBaseGrid=html.includes(baseGrid),hasIntegratedGrid=html.includes(integratedGrid);if(!html.includes('<h1>업종 데이터</h1>')||(!hasBaseGrid&&!hasIntegratedGrid))throw new Error('Categories hub shape mismatch');if(!hasIntegratedGrid){if(!hasBaseGrid)throw new Error('Categories grid baseline changed');html=html.replace(baseGrid,integratedGrid);}
  let next=replaceMarked(html,marks.categoriesRail,CATEGORIES_RAIL);html=next??addBefore(html,integratedGrid,CATEGORIES_RAIL,'categories rail');
  next=replaceMarked(html,marks.categoriesFaq,CATEGORIES_FAQ);html=next??addBefore(html,'<section class="block v11-24-polish" data-v11-24-polish="categories">',CATEGORIES_FAQ,'categories faq');
  const items=parseCategoryItems(html);html=addJsonLd(html,'data-v52-discovery-categories-list',{'@context':'https://schema.org','@type':'ItemList','name':'프랜차이즈 업종 데이터 20개','numberOfItems':20,itemListElement:items});html=addJsonLd(html,'data-v52-discovery-categories-faq',faqJsonLd(CATEGORIES_FAQS));html=ensureAssetTags(html);if(html!==before)fs.writeFileSync(file,html);return html!==before;
}
function applyExplore(root){const file=path.join(root,'explore/index.html');let html=fs.readFileSync(file,'utf8'),before=html;if(!html.includes('data-v11-budget-explorer="1"')||!html.includes('<h1>예산별 프랜차이즈 찾기</h1>'))throw new Error('Explore hub shape mismatch');let next=replaceMarked(html,marks.exploreRail,EXPLORE_RAIL);html=next??addBefore(html,'<section class="block" id="budget-summary">',EXPLORE_RAIL,'explore rail');next=replaceMarked(html,marks.exploreFaq,EXPLORE_FAQ);html=next??addBefore(html,'</div></main>',EXPLORE_FAQ,'explore faq');html=addJsonLd(html,'data-v52-discovery-explore-faq',faqJsonLd(EXPLORE_FAQS));html=ensureAssetTags(html);if(html!==before)fs.writeFileSync(file,html);return html!==before;}

export function applyDiscoveryHubs(root){requireRoot(root);const changed=[applyBrands(root),applyCategories(root),applyExplore(root)].some(Boolean);validateDiscoveryHubs(root);return{changed,brands:true,categories:true,explore:true,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,candidateSetChanged:false};}

function parseJsonLd(html,attr){const raw=html.match(new RegExp(`<script type="application/ld\\+json" ${attr}>([\\s\\S]*?)<\\/script>`))?.[1];if(!raw)throw new Error(`Missing JSON-LD ${attr}`);return JSON.parse(raw);}
export function validateDiscoveryHubs(root){requireRoot(root);const brands=fs.readFileSync(path.join(root,'brands/index.html'),'utf8'),categories=fs.readFileSync(path.join(root,'categories/index.html'),'utf8'),explore=fs.readFileSync(path.join(root,'explore/index.html'),'utf8');for(const [name,html] of [['brands',brands],['categories',categories],['explore',explore]]){if(!html.includes(ROBOTS))throw new Error(`${name}: preview noindex removed`);if(!html.includes('/assets/discovery-hubs.css')||!html.includes('/assets/discovery-hubs.js'))throw new Error(`${name}: discovery assets missing`);if((html.match(new RegExp(`data-v52-discovery-rail="${name}"`,'g'))||[]).length!==1)throw new Error(`${name}: discovery rail missing or duplicated`);if((html.match(new RegExp(`data-v52-discovery-faq="${name}"`,'g'))||[]).length!==1)throw new Error(`${name}: FAQ missing or duplicated`);}
  if(!fs.existsSync(path.join(root,'assets/discovery-hubs.css'))||!fs.existsSync(path.join(root,'assets/discovery-hubs.js')))throw new Error('Discovery hub asset files missing');
  if(!brands.includes('<option value="7000">7,000만원</option>'))throw new Error('Brands 7,000만원 parity option missing');if((brands.match(/data-v52-directory-empty/g)||[]).length!==1||!brands.includes('data-v52-explore-handoff'))throw new Error('Brands zero-result recovery missing');if((brands.match(/class="v52-discovery-card"/g)||[]).length<4)throw new Error('Brands task cards missing');if((brands.match(/<details>/g)||[]).length<4)throw new Error('Brands FAQs missing');const app=parseJsonLd(brands,'data-v52-discovery-brands-app');if(app['@type']!=='WebApplication')throw new Error('Brands WebApplication JSON-LD invalid');const bf=parseJsonLd(brands,'data-v52-discovery-brands-faq');if(bf['@type']!=='FAQPage'||bf.mainEntity?.length!==4)throw new Error('Brands FAQ JSON-LD invalid');
  if(!categories.includes('id="v52-category-grid"')||(categories.match(/<div class="report-grid"/g)||[]).length!==1)throw new Error('Categories grid contract missing');const list=parseJsonLd(categories,'data-v52-discovery-categories-list');if(list['@type']!=='ItemList'||list.numberOfItems!==20||list.itemListElement?.length!==20)throw new Error('Categories ItemList JSON-LD invalid');const cf=parseJsonLd(categories,'data-v52-discovery-categories-faq');if(cf['@type']!=='FAQPage'||cf.mainEntity?.length!==4)throw new Error('Categories FAQ JSON-LD invalid');
  if(!explore.includes('data-v52-directory-handoff')||!explore.includes('data-v11-budget-dataset'))throw new Error('Explore handoff or Dataset JSON-LD missing');const ef=parseJsonLd(explore,'data-v52-discovery-explore-faq');if(ef['@type']!=='FAQPage'||ef.mainEntity?.length!==4)throw new Error('Explore FAQ JSON-LD invalid');for(const href of ['/explore/','/categories/','/brands/','/compare/','/tools/startup-cost/'])if(!brands.includes(BASE+href)&&!categories.includes(BASE+href)&&!explore.includes(BASE+href))throw new Error(`Discovery link missing ${href}`);return{discoveryHubs:true,brandsCost7000:true,categoryItemList:20,faqPages:3,taskRails:3,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false};}
