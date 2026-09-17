import fs from 'node:fs';
import path from 'node:path';

const START='<!-- v11.52 tools decision: start -->';
const END='<!-- v11.52 tools decision: end -->';
const FAQ_JSON_START='<!-- v11.52 tools faq jsonld: start -->';
const FAQ_JSON_END='<!-- v11.52 tools faq jsonld: end -->';

const startBlock=`${START}<section class="v52-tools-start" data-v52-tools-start="1" aria-label="목적별 도구 시작"><div class="v52-tools-start-head"><div><span>목적별 시작</span><strong>지금 확인할 항목을 고르세요</strong></div><p>공개자료 확인과 내 조건 계산은 역할이 다릅니다. 먼저 목적을 고른 뒤 필요한 값만 입력합니다.</p></div><div class="v52-tools-start-grid"><a class="v52-tools-start-card" data-v52-tools-start-card="startup" href="/pm-lab/franchise-ssg-preview/tools/startup-cost/"><small>총 준비자금</small><strong>실제 준비금 범위 계산</strong><span>공개 창업비용에 임대·추가공사·운전자금을 따로 더합니다.</span><b>창업비용 계산기 →</b></a><a class="v52-tools-start-card" data-v52-tools-start-card="profit" href="/pm-lab/franchise-ssg-preview/tools/monthly-profit-simulator/"><small>월 운영</small><strong>월 손익 구조 계산</strong><span>매출·변동비·고정비를 나눠 월 손익과 손익분기 조건을 봅니다.</span><b>월 손익 계산기 →</b></a><a class="v52-tools-start-card" data-v52-tools-start-card="brand" href="/pm-lab/franchise-ssg-preview/tools/brand-filter/"><small>후보 찾기</small><strong>조건에 맞는 브랜드 찾기</strong><span>예산·업종·가맹점·점포증감 조건으로 공개 데이터 후보를 좁힙니다.</span><b>브랜드 조건 찾기 →</b></a><a class="v52-tools-start-card" data-v52-tools-start-card="category" href="/pm-lab/franchise-ssg-preview/tools/category-median/"><small>업종 기준</small><strong>업종 중앙값과 분포 확인</strong><span>한 브랜드 숫자만 보지 않고 같은 업종의 중앙값·분포와 함께 비교합니다.</span><b>업종 중앙값 비교 →</b></a></div></section>${END}`;

const faqBlock=`<section class="v52-tools-faq" data-v52-tools-faq="1"><header><h2>도구 선택 FAQ</h2></header><details><summary>공개 창업비용과 실제 준비자금은 같은가요?</summary><p>같지 않습니다. 정보공개서의 공개 창업비용에는 점포 임대보증금·권리금·일부 추가공사·운전자금 등이 빠질 수 있습니다. <a href="/pm-lab/franchise-ssg-preview/tools/startup-cost/">창업비용 계산기</a>에서 공개값과 별도 준비금을 분리해 확인합니다.</p></details><details><summary>평균매출이 높으면 수익도 높다고 볼 수 있나요?</summary><p>평균매출은 이익이 아닙니다. 임차료·인건비·재료비·수수료 등 비용 구조가 다르므로 <a href="/pm-lab/franchise-ssg-preview/tools/monthly-profit-simulator/">월 손익 계산기</a>에서 내 조건을 별도로 입력해야 합니다.</p></details><details><summary>공개값 0과 정보 없음은 어떻게 다른가요?</summary><p>0은 원자료에 0으로 공개된 값이고, 정보 없음은 비교 가능한 값이 없다는 뜻입니다. 이 서비스는 누락값을 0으로 채우지 않으며 0도 무료·면제로 단정하지 않습니다.</p></details><details><summary>브랜드를 정하지 못했다면 어디서 시작하나요?</summary><p><a href="/pm-lab/franchise-ssg-preview/tools/brand-filter/">브랜드 조건 찾기</a>로 후보를 좁히고, <a href="/pm-lab/franchise-ssg-preview/tools/category-median/">업종 중앙값 비교</a>로 같은 업종의 기준을 확인한 뒤 브랜드 비교로 넘어갑니다.</p></details></section>`;

const faqJson={
  '@context':'https://schema.org','@type':'FAQPage',mainEntity:[
    {'@type':'Question',name:'공개 창업비용과 실제 준비자금은 같은가요?',acceptedAnswer:{'@type':'Answer',text:'같지 않습니다. 정보공개서의 공개 창업비용에는 점포 임대보증금, 권리금, 일부 추가공사, 운전자금 등이 빠질 수 있어 별도 준비금을 함께 확인해야 합니다.'}},
    {'@type':'Question',name:'평균매출이 높으면 수익도 높다고 볼 수 있나요?',acceptedAnswer:{'@type':'Answer',text:'평균매출은 이익이 아닙니다. 임차료, 인건비, 재료비, 수수료 등 비용 구조가 다르므로 내 조건의 월 손익을 별도로 계산해야 합니다.'}},
    {'@type':'Question',name:'공개값 0과 정보 없음은 어떻게 다른가요?',acceptedAnswer:{'@type':'Answer',text:'0은 원자료에 0으로 공개된 값이고 정보 없음은 비교 가능한 값이 없다는 뜻입니다. 누락값을 0으로 채우지 않으며 0도 무료나 면제로 단정하지 않습니다.'}},
    {'@type':'Question',name:'브랜드를 정하지 못했다면 어디서 시작하나요?',acceptedAnswer:{'@type':'Answer',text:'브랜드 조건 찾기로 후보를 좁히고 업종 중앙값 비교로 같은 업종의 기준을 확인한 뒤 브랜드 비교로 넘어갑니다.'}}
  ]
};
const faqJsonBlock=`${FAQ_JSON_START}<script type="application/ld+json" data-v52-tools-faq-jsonld>${JSON.stringify(faqJson)}</script>${FAQ_JSON_END}`;

function replaceMarked(text,start,end,block){
  const a=text.indexOf(start),b=text.indexOf(end);
  if((a<0)!=(b<0))throw new Error(`Incomplete tools marker ${start}`);
  if(a<0)return null;
  if(b<a)throw new Error(`Reversed tools marker ${start}`);
  return text.slice(0,a)+block+text.slice(b+end.length);
}

export function applyToolsDecision(root){
  if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');
  const file=path.join(root,'tools/index.html');
  let html=fs.readFileSync(file,'utf8');
  const original=html;
  if(!html.includes('<main id="main" data-v25-tools="1">')||!html.includes('<h1>데이터 도구</h1>'))throw new Error('Tools hub shape mismatch');
  const existingStart=replaceMarked(html,START,END,startBlock);if(existingStart!==null)html=existingStart;else html=html.replace('<h1>데이터 도구</h1>','<h1>데이터 도구</h1>'+startBlock);
  if(!html.includes('data-v52-tools-faq="1"')){
    const needle='</details></div></main>';
    if(!html.includes(needle))throw new Error('Tools method close marker missing');
    html=html.replace(needle,'</details>'+faqBlock+'</div></main>');
  }
  const existingJson=replaceMarked(html,FAQ_JSON_START,FAQ_JSON_END,faqJsonBlock);if(existingJson!==null)html=existingJson;else html=html.replace('</head>',faqJsonBlock+'</head>');
  const cssTag='<link rel="stylesheet" href="/pm-lab/franchise-ssg-preview/assets/tools-decision.css" data-v52-tools-decision>';
  if(!html.includes('/assets/tools-decision.css'))html=html.replace('</head>',cssTag+'</head>');
  if(html!==original)fs.writeFileSync(file,html);
  validateToolsDecision(root);
  return{changed:html!==original,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false};
}

export function validateToolsDecision(root){
  if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');
  const html=fs.readFileSync(path.join(root,'tools/index.html'),'utf8');
  if((html.match(/data-v52-tools-start="1"/g)||[]).length!==1)throw new Error('Tools start section missing or duplicated');
  if((html.match(/data-v52-tools-start-card=/g)||[]).length!==4)throw new Error('Tools start cards not 4');
  if((html.match(/<section class="v52-tools-faq" data-v52-tools-faq="1">/g)||[]).length!==1)throw new Error('Tools FAQ missing or duplicated');
  if((html.match(/<details>/g)||[]).length<4)throw new Error('Tools FAQ details missing');
  if((html.match(/data-v52-tools-faq-jsonld/g)||[]).length!==1)throw new Error('Tools FAQ JSON-LD missing or duplicated');
  for(const href of ['/tools/startup-cost/','/tools/monthly-profit-simulator/','/tools/brand-filter/','/tools/category-median/'])if(!html.includes(`href="/pm-lab/franchise-ssg-preview${href}"`))throw new Error(`Tools decision href missing ${href}`);
  if(!html.includes('/assets/tools-decision.css'))throw new Error('Tools decision CSS tag missing');
  if(!html.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))throw new Error('Tools preview noindex missing');
  return{toolsDecision:true,startCards:4,faqItems:4};
}
