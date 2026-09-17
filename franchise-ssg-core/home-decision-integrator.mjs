import fs from 'node:fs';
import path from 'node:path';

const START='<!-- v11.52 home decision: start -->';
const END='<!-- v11.52 home decision: end -->';
const BLOCK=`${START}<section class="v52-home-start" data-v52-home-start="1" aria-label="창업 데이터 시작 경로"><div class="v52-home-start-head"><div><span>START HERE</span><strong>지금 가진 기준부터 고르세요</strong></div><p>브랜드가 정해졌는지, 예산부터 볼지, 업종 기준부터 볼지에 따라 첫 화면에서 바로 다음 단계로 이동합니다.</p></div><div class="v52-home-start-grid"><a class="v52-home-start-card" data-v52-home-start-card="brand" href="/pm-lab/franchise-ssg-preview/brands/"><small>브랜드가 정해짐</small><strong>브랜드 검색·조건 좁히기</strong><span>브랜드명·업종·비용·가맹점 조건으로 후보를 찾습니다.</span><b>브랜드 찾기 →</b></a><a class="v52-home-start-card" data-v52-home-start-card="budget" href="/pm-lab/franchise-ssg-preview/explore/"><small>예산부터</small><strong>예산 안의 후보 찾기</strong><span>준비 가능한 공개 창업비용 범위에서 후보를 먼저 좁힙니다.</span><b>예산별 찾기 →</b></a><a class="v52-home-start-card" data-v52-home-start-card="category" href="/pm-lab/franchise-ssg-preview/categories/"><small>업종부터</small><strong>업종 중앙값·분포 보기</strong><span>개별 브랜드보다 먼저 업종의 비용·매출·가맹점 기준을 확인합니다.</span><b>업종 데이터 →</b></a><a class="v52-home-start-card" data-v52-home-start-card="compare" href="/pm-lab/franchise-ssg-preview/compare/"><small>후보가 2개 이상</small><strong>브랜드를 같은 기준으로 비교</strong><span>공개비용·가맹점·평균매출·점포 변화를 한 화면에서 비교합니다.</span><b>브랜드 비교 →</b></a></div><p class="v52-home-start-note"><strong>브랜드명을 이미 알고 있다면</strong> 위 검색창에서 바로 상세 페이지로 이동할 수 있습니다. 실제 계약 전에는 <a href="/pm-lab/franchise-ssg-preview/sources/">출처</a>와 최신 정보공개서를 다시 확인하세요.</p></section>${END}`;

function replaceMarked(text){
  const a=text.indexOf(START),b=text.indexOf(END);
  if((a<0)!=(b<0))throw new Error('Incomplete home decision marker');
  if(a<0)return null;
  if(b<a)throw new Error('Reversed home decision marker');
  return text.slice(0,a)+BLOCK+text.slice(b+END.length);
}

export function applyHomeDecision(root){
  if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');
  const file=path.join(root,'index.html');
  let html=fs.readFileSync(file,'utf8');
  const original=html;
  if(!html.includes('<main id="main" data-v25-home="1">')||!html.includes('data-v25-search')||!html.includes('<h2>업종별 창업비용</h2>')||!html.includes('<h2>예산</h2>'))throw new Error('Home shape mismatch');
  const replaced=replaceMarked(html);
  if(replaced!==null)html=replaced;
  else{
    const needle='<section class="v25-sec"><header><h2>업종별 창업비용</h2>';
    if(!html.includes(needle))throw new Error('Home category section insertion point missing');
    html=html.replace(needle,BLOCK+needle);
  }
  const cssTag='<link rel="stylesheet" href="/pm-lab/franchise-ssg-preview/assets/home-decision.css" data-v52-home-decision>';
  if(!html.includes('/assets/home-decision.css'))html=html.replace('</head>',cssTag+'</head>');
  if(html!==original)fs.writeFileSync(file,html);
  validateHomeDecision(root);
  return{changed:html!==original,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false};
}

export function validateHomeDecision(root){
  if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  if((html.match(/data-v52-home-start="1"/g)||[]).length!==1)throw new Error('Home decision section missing or duplicated');
  if((html.match(/data-v52-home-start-card=/g)||[]).length!==4)throw new Error('Home decision cards not 4');
  for(const href of ['/brands/','/explore/','/categories/','/compare/'])if(!html.includes(`href="/pm-lab/franchise-ssg-preview${href}"`))throw new Error(`Home decision href missing ${href}`);
  if(!html.includes('<form class="v25-search" data-v25-search>'))throw new Error('Home brand search removed');
  if(!html.includes('data-v25-search-map'))throw new Error('Home search map removed');
  if(!html.includes('<h2>업종별 창업비용</h2>')||!html.includes('<h2>예산</h2>'))throw new Error('Home data sections removed');
  if(!html.includes('/assets/home-decision.css'))throw new Error('Home decision CSS tag missing');
  if(!fs.existsSync(path.join(root,'assets/home-decision.css')))throw new Error('Home decision CSS asset missing');
  if(!html.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))throw new Error('Home preview noindex missing');
  return{homeDecision:true,startCards:4,searchPreserved:true,dataSectionsPreserved:true};
}
