import {searchEditorialNotes} from './search-editorial-notes.mjs';

const start='<!-- SEARCH:EDITORIAL:START -->';
const end='<!-- SEARCH:EDITORIAL:END -->';
const blockPattern=()=>/<!-- SEARCH:EDITORIAL:START -->[\s\S]*?<!-- SEARCH:EDITORIAL:END -->/g;
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Stable subjects and conditions belong in metadata. Live prices and selected
// specification values remain in the existing calculator, never duplicated here.
export const searchEditorialMetadata=Object.freeze({
  'cars/hyundai/grandeur-gn7/index.html':{title:'그랜저 GN7 연비·자동차세·연료비 비교',description:'그랜저 GN7의 가솔린·하이브리드·LPG 사양별 신고 연비와 자동차세를 확인하세요. 엔진·구동·휠을 고르고 같은 주행거리로 연료비를 비교합니다.'},
  'cars/hyundai/grandeur-gn7/hybrid/index.html':{title:'그랜저 하이브리드 연비·자동차세·연료비',description:'그랜저 하이브리드의 휠별 신고 연비와 배기량 기준 자동차세를 확인하세요. 가솔린과 비교할 때 맞춰야 할 주행거리·유가·사양 조건을 설명합니다.'},
  'cars/hyundai/grandeur-gn7/lpg/index.html':{title:'그랜저 LPG 연비·자동차세·연료비',description:'그랜저 LPG의 휠별 신고 연비와 자동차세를 확인하세요. 가솔린과 다른 연료 단가를 적용해 같은 거리의 연료비를 비교합니다.'},
  'cars/kia/sorento-mq4/index.html':{title:'쏘렌토 하이브리드 연비·MQ4 사양별 자동차세',description:'쏘렌토 MQ4의 하이브리드·가솔린 사양별 신고 연비와 자동차세를 확인하세요. 구동·인승·휠·빌트인캠 조건을 고르고 연료비를 비교합니다.'},
  'cars/kia/k8-gl3/index.html':{title:'K8 GL3 연비·자동차세·연료비 비교',description:'K8 GL3의 엔진·구동·휠별 신고 연비와 자동차세를 확인하세요. 그랜저와 비교할 때 서로 다른 휠 조건과 연료비 계산 기준을 함께 봅니다.'},
  'cars/hyundai/ioniq-5/index.html':{title:'아이오닉 5 전비·자동차세·충전비 비교',description:'아이오닉 5의 배터리·구동·휠별 신고 전비와 주행거리를 확인하세요. 전기 승용차 자동차세와 직접 입력한 충전단가의 연간 충전비를 구분해 봅니다.'},
  'cars/kia/ev6/index.html':{title:'EV6 전비·자동차세·충전비 비교',description:'EV6의 배터리·구동·휠별 신고 전비와 주행거리를 확인하세요. 자동차세는 전기 승용차 기준으로, 충전비는 본인 충전단가를 적용해 비교합니다.'},
  'compare/grandeur-vs-k8/index.html':{title:'그랜저 vs K8 자동차세·연료비 비교',description:'그랜저와 K8 가솔린의 자동차세·연료비를 같은 주행거리와 유가로 비교하세요. 서로 다른 휠 조건을 표시하고 세금 차이와 연료비 차이를 나눠 봅니다.'},
  'compare/grandeur-gasoline-vs-hybrid/index.html':{title:'그랜저 가솔린 vs 하이브리드 자동차세·연료비',description:'그랜저 가솔린과 하이브리드의 연료비·자동차세 차이를 구분해 비교하세요. 주행거리와 유가를 바꿀 수 있으며 구매가격 차이는 포함하지 않습니다.'},
  'compare/sorento-vs-santafe/index.html':{title:'쏘렌토 vs 싼타페 2.5 가솔린 터보 비교',description:'쏘렌토와 싼타페 가솔린의 신고 연비·자동차세·연료비를 같은 거리와 유가로 비교하세요. 구동·휠·인승 조건과 연료비 차이의 근거를 확인합니다.'},
  'compare/sorento-gasoline-vs-hybrid/index.html':{title:'쏘렌토 가솔린 vs 하이브리드 자동차세·연료비',description:'쏘렌토 가솔린과 하이브리드의 연료비·자동차세를 비교하세요. 서로 다른 휠·인승 조건을 확인하고 본인의 주행거리와 유가를 적용할 수 있습니다.'},
  'compare/ioniq5-vs-ev6/index.html':{title:'아이오닉 5 vs EV6 전비·자동차세·충전비',description:'아이오닉 5와 EV6의 신고 전비·자동차세·충전비를 비교하세요. 화면의 비교용 초기 단가를 본인 충전단가로 바꿔 같은 주행거리의 차이를 확인합니다.'},
  'tools/car-tax/index.html':{title:'자동차세 계산기 · 배기량·차령별 연 세액',description:'차량 유형·배기량·차령기산 참고월로 비영업용 승용차의 연간 자동차세와 지방교육세를 계산합니다. 연납 할인·개별 감면·연중 일할계산은 제외합니다.'},
  'guide/car-tax-basics/index.html':{title:'자동차세 계산 방법 · 배기량·교육세·차령',description:'비영업용 승용차의 배기량별 자동차세와 지방교육세, 차령 경감 기준을 설명합니다. 하이브리드·전기차의 과세 방식과 실제 고지액의 차이도 확인하세요.'},
  'guide/grandeur-wheel-fuel-cost/index.html':{title:'그랜저 휠별 연비·연료비 비교 방법',description:'그랜저의 휠별 신고 연비를 같은 엔진·구동 조건에서 비교하는 방법입니다. 같은 주행거리와 유가를 적용하고 자동차세 차이와 연료비 차이를 구분합니다.'},
  'guide/hybrid-savings/index.html':{title:'가솔린 vs 하이브리드 연료비·자동차세 비교',description:'가솔린과 하이브리드의 연간 연료비·자동차세를 같은 거리와 유가로 비교하는 방법입니다. 연간 지출 차이와 구매가격 차이의 회수 시점을 구분합니다.'}
});

export const SEARCH_EDITORIAL_ROUTES=Object.freeze(Object.keys(searchEditorialMetadata));
export const stripSearchEditorialContext=html=>html.replace(blockPattern(),'');

function setMeta(html,attribute,name,value){
  const tag=`<meta ${attribute}="${name}" content="${escape(value)}">`;
  const pattern=new RegExp('<meta\\b(?=[^>]*\\b'+attribute+'=["\\\']'+name+'["\\\'])[^>]*>','gi');
  let found=false;
  html=html.replace(pattern,()=>{if(found)return '';found=true;return tag;});
  return found?html:html.replace('</head>',tag+'</head>');
}

function relativeLink(route,target){
  if(!target.startsWith('/')||target.startsWith('//'))throw new Error('Expected an internal canonical path');
  const url=new URL(target,'https://peekmycar.com/');
  if(url.origin!=='https://peekmycar.com'||url.search||!url.pathname.endsWith('/'))throw new Error('Expected an existing clean internal route');
  return '../'.repeat(route.split('/').length-1)+target.slice(1);
}

function existingMainLinks(html,route){
  const main=html.slice(html.search(/<main\b/),html.lastIndexOf('</main>'));
  const page=new URL(route.replace(/index\.html$/,''),'https://peekmycar.com/');
  const urls=new Set();
  for(const match of main.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)){
    try{
      const href=match[1].replace(/&amp;/g,'&');
      const url=new URL(href,page);
      if(url.origin===page.origin)urls.add(url.href);
    }catch{ /* Existing dynamic links are outside this static navigation. */ }
  }
  return urls;
}

export function applySearchEditorialContext(html,route){
  const metadata=searchEditorialMetadata[route],note=searchEditorialNotes[route];
  if(!metadata)return html;
  if(!note||!Array.isArray(note.sections)||!Array.isArray(note.links))throw new Error('Missing reviewed editorial note: '+route);
  if(!html.includes('</main>')||!html.includes('</head>'))throw new Error('Missing generated page shell: '+route);
  html=stripSearchEditorialContext(html);
  const title=metadata.title+' | 픽마이카';
  html=html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i,`<title>${escape(title)}</title>`);
  html=setMeta(html,'name','description',metadata.description);
  html=setMeta(html,'property','og:title',title);
  html=setMeta(html,'property','og:description',metadata.description);
  const sections=note.sections.map(section=>`<section><h3>${escape(section.heading)}</h3>${section.paragraphs.map(paragraph=>`<p>${escape(paragraph)}</p>`).join('')}</section>`).join('');
  if(note.links.length>3)throw new Error('Too many editorial links: '+route);
  const linked=existingMainLinks(html,route);
  const links=note.links.filter(link=>!linked.has(new URL(link.path,'https://peekmycar.com/').href)).map(link=>`<a href="${escape(relativeLink(route,link.path))}">${escape(link.text)}</a>`).join('');
  const navigation=links?`<nav class="search-editorial-links" aria-label="관련 계산과 비교">${links}</nav>`:'';
  const block=`${start}<section class="db-section search-editorial-context" id="search-editorial-context" aria-labelledby="search-editorial-heading"><div class="db-shell"><h2 id="search-editorial-heading">${escape(note.heading)}</h2><div class="search-editorial-copy">${sections}</div>${navigation}</div></section>${end}`;
  // Keep the existing price freshness notice at the very bottom of the page.
  const foot='<div class="page-fuel-status-foot">';
  return html.includes(foot)?html.replace(foot,block+foot):html.replace('</main>',block+'</main>');
}
