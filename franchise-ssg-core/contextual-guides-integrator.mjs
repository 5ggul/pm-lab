import fs from 'node:fs';
import path from 'node:path';

const BASE='/pm-lab/franchise-ssg-preview';
const START='<!-- v11.52 contextual guides: start -->';
const END='<!-- v11.52 contextual guides: end -->';
const HUB_ROUTES=['/brands/','/categories/','/tools/','/explore/','/rankings/','/cost-components/'];

const guides={
  disclosure:['/guides/how-to-read-franchise-disclosure/','프랜차이즈 정보공개서는 어떤 순서로 봐야 하나','등록 상태부터 점포 변화·평균매출 기준연도·창업비용 항목까지 확인 순서를 정리했습니다.'],
  fees:['/guides/franchise-fee-interior-deposit-difference/','가맹비·교육비·보증금·인테리어비는 어떻게 다른가','같은 창업비용 안에서도 성격이 다른 항목을 구분해 비교하는 기준입니다.'],
  rent:['/guides/why-rent-deposit-is-not-in-startup-cost/','임대보증금이 공개 창업비용에서 빠지는 이유','공개비용과 점포 임대보증금·월세·권리금 등 실제 추가비용을 분리해 봅니다.'],
  openClose:['/guides/how-to-read-open-close-store-counts/','신규점·계약종료·해지 숫자는 어떻게 읽나','신규점만 보지 않고 종료·해지와 이전 점포 수를 함께 확인하는 방법입니다.'],
  stores:['/guides/many-stores-do-not-mean-profit/','가맹점이 많으면 수익도 높은가','점포 수가 브랜드 규모를 보여줄 뿐 개별 점포 수익을 직접 뜻하지 않는 이유입니다.'],
  coffee:['/guides/low-price-coffee-comparison-checklist/','저가커피 브랜드를 비교할 때 어떤 숫자를 봐야 하나','공개비용·점포 변화·평균매출 기준·로열티를 같은 기준으로 맞춰 보는 체크리스트입니다.'],
  chicken:['/guides/chicken-franchise-cost-comparison/','치킨 프랜차이즈 창업비용을 비교할 때 볼 항목','주방 설비·기준면적·인테리어·별도 공사 범위를 총액과 분리해 비교합니다.'],
  royalty:['/guides/royalty-mandatory-purchase-fixed-cost/','로열티와 필수구매는 월 고정비에 어떻게 반영하나','정액·매출연동 로열티와 필수구매를 손익 계산에서 중복 없이 넣는 기준입니다.'],
  breakEven:['/guides/why-break-even-calculation-goes-wrong/','손익분기 계산이 실제와 달라지는 이유','계절성·세금·감가상각·이자·점주 인건비 등이 빠질 때 생기는 차이를 확인합니다.'],
  sales:['/guides/do-not-copy-headquarters-expected-sales/','본사 예상매출을 그대로 수익으로 보면 안 되는 이유','매출 추정치와 원가·인건비·임대료를 뺀 실제 수익을 구분해서 봅니다.'],
  contract:['/guides/franchise-contract-checklist/','프랜차이즈 계약 전 어떤 항목을 확인해야 하나','계약기간·갱신·해지·영업지역·필수구매·광고분담 등을 문서로 확인하는 체크리스트입니다.'],
  source:['/guides/why-our-number-differs-from-ftc/','공정위 조회 숫자와 이 사이트 숫자가 다를 수 있는 이유','기준연도·갱신 시점·명칭 정합·누락값 처리 차이를 확인하는 방법입니다.'],
  keyMoney:['/guides/why-key-money-is-not-public-cost/','권리금은 왜 정보공개서 창업비용에 없나','특정 점포 계약에서 형성되는 권리금을 브랜드 공개비용과 분리해 확인합니다.']
};

function requireRoot(root){if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');}
function esc(v){return String(v??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));}
function fileFor(root,route){return route==='/'?path.join(root,'index.html'):path.join(root,...String(route).split('/').filter(Boolean),'index.html');}
function marked(text,block){
  const a=text.indexOf(START),b=text.indexOf(END);
  if((a<0)!=(b<0))throw new Error('Incomplete contextual guide marker');
  if(a<0)return null;if(b<a)throw new Error('Reversed contextual guide marker');
  return text.slice(0,a)+block+text.slice(b+END.length);
}
function ensureStyle(html){
  const tag=`<link rel="stylesheet" href="${BASE}/assets/contextual-guides.css" data-v52-context-guides-style>`;
  if(!html.includes('/assets/contextual-guides.css'))html=html.replace('</head>',tag+'</head>');
  return html;
}
function unique(items){
  const out=[];for(const item of items){if(!item||out.some(x=>x[0]===item[0]))continue;out.push(item)}return out.slice(0,3);
}
function rail(kind,title,note,items){
  const links=unique(items);
  if(links.length!==3)throw new Error(`Context guide set ${kind} has ${links.length}/3 links`);
  return `${START}<aside class="v52-context-guides" data-v52-context-guides="${esc(kind)}" aria-labelledby="v52-context-${esc(kind)}-title"><div class="v52-context-guides-head"><h2 id="v52-context-${esc(kind)}-title">${esc(title)}</h2><span>${esc(note)}</span></div><div class="v52-context-guides-list">${links.map(([href,label,desc])=>`<a class="v52-context-guide" href="${BASE}${href}"><strong>${esc(label)}</strong><small>${esc(desc)}</small><b aria-hidden="true">읽기</b></a>`).join('')}</div></aside>${END}`;
}
function categorySpecific(slug){if(slug==='cafe')return guides.coffee;if(slug==='chicken')return guides.chicken;return guides.disclosure}
function brandItems(b){
  const category=categorySpecific(b.categorySlug);
  const movement=Math.abs(Number(b.growth));
  const trend=Number.isFinite(movement)&&movement>=10?guides.openClose:guides.stores;
  const cost=Number(b.cost);
  const costGuide=Number.isFinite(cost)&&cost>=10000?guides.rent:guides.fees;
  return unique([category,trend,costGuide,guides.contract]);
}
function categoryItems(slug){return unique([categorySpecific(slug),guides.openClose,guides.rent,guides.stores])}
function hubSet(route){
  const map={
    '/brands/':['브랜드 숫자를 읽는 기준','필터 결과를 계약 판단으로 바로 연결하지 않기',[guides.disclosure,guides.openClose,guides.rent]],
    '/categories/':['업종 중앙값을 읽는 기준','중앙값·점포 수·공개비용을 함께 보기',[guides.stores,guides.openClose,guides.rent]],
    '/tools/':['계산 전에 확인할 기준','입력값과 공개값의 범위를 구분하기',[guides.breakEven,guides.royalty,guides.rent]],
    '/explore/':['예산 결과를 실제 준비자금과 구분하기','공개비용에 빠질 수 있는 금액 확인',[guides.rent,guides.keyMoney,guides.disclosure]],
    '/rankings/':['순위 숫자를 해석하는 기준','매출·점포 규모를 수익성 순위로 바꾸지 않기',[guides.sales,guides.stores,guides.openClose]],
    '/cost-components/':['비용 항목을 합치기 전에','공개 항목과 점포별 추가비용을 분리하기',[guides.fees,guides.rent,guides.keyMoney]]
  };
  return map[route]||null;
}
function insertAfter(html,needle,block){if(!html.includes(needle))throw new Error(`Context insertion point missing ${needle}`);return html.replace(needle,needle+block)}
function insertBeforeMainEnd(html,block){
  const needle='</div></main>',i=html.lastIndexOf(needle);if(i<0)throw new Error('Context main insertion point missing');
  return html.slice(0,i)+block+html.slice(i);
}
function write(file,html,before){if(html!==before)fs.writeFileSync(file,html);return html!==before}

function candidateRoutes(root){
  const quality=JSON.parse(fs.readFileSync(path.join(root,'v11-quality-report.json'),'utf8'));
  return quality.indexPolicy?.productionCandidateUrls||[];
}

export function applyContextualGuides(root,coreDir){
  requireRoot(root);if(typeof coreDir!=='string'||!path.isAbsolute(coreDir))throw new Error('Explicit absolute core dir required');
  const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data-snapshot-v11-26.json'),'utf8'));
  if(snapshot.brand_count!==136||snapshot.brands?.length!==136)throw new Error(`Context brand baseline ${snapshot.brand_count}/${snapshot.brands?.length}`);
  const candidates=candidateRoutes(root),candidateSet=new Set(candidates);
  const categoryRoutes=candidates.filter(r=>/^\/categories\/[^/]+\/$/.test(r));
  fs.copyFileSync(path.join(coreDir,'contextual-guides.css'),path.join(root,'assets/contextual-guides.css'));
  let changed=0;

  for(const b of snapshot.brands){
    if(!candidateSet.has(b.route))throw new Error(`Trusted brand missing from candidates ${b.route}`);
    const file=fileFor(root,b.route);let html=fs.readFileSync(file,'utf8'),before=html;
    const block=rail('brand','이 브랜드 숫자를 읽기 전에',`${b.categoryName} · 공개값 해석 가이드`,brandItems(b));
    const replaced=marked(html,block);html=replaced!==null?replaced:insertAfter(html,'<!-- v11.52 retention brand: end -->',block);
    html=ensureStyle(html);if(write(file,html,before))changed++;
  }

  for(const route of categoryRoutes){
    const slug=route.split('/').filter(Boolean).at(-1),file=fileFor(root,route);let html=fs.readFileSync(file,'utf8'),before=html;
    const block=rail('category','업종 숫자를 브랜드 선택으로 연결하기','중앙값·점포 변화·실제 준비자금 구분',categoryItems(slug));
    const replaced=marked(html,block);html=replaced!==null?replaced:insertBeforeMainEnd(html,block);
    html=ensureStyle(html);if(write(file,html,before))changed++;
  }

  for(const route of HUB_ROUTES){
    if(!candidateSet.has(route))throw new Error(`Context hub missing from candidates ${route}`);
    const set=hubSet(route),file=fileFor(root,route);let html=fs.readFileSync(file,'utf8'),before=html;
    const block=rail('hub',set[0],set[1],set[2]);
    const replaced=marked(html,block);html=replaced!==null?replaced:insertBeforeMainEnd(html,block);
    html=ensureStyle(html);if(write(file,html,before))changed++;
  }
  return{changed,...validateContextualGuides(root),productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,candidateSetChanged:false};
}

export function validateContextualGuides(root){
  requireRoot(root);
  const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data-snapshot-v11-26.json'),'utf8'));
  const candidates=candidateRoutes(root),candidateSet=new Set(candidates);
  const categoryRoutes=candidates.filter(r=>/^\/categories\/[^/]+\/$/.test(r));
  let brandGuideRails=0,categoryGuideRails=0,hubGuideRails=0,guideLinks=0,styledPages=0;
  const check=(route,kind)=>{
    const html=fs.readFileSync(fileFor(root,route),'utf8');
    if((html.match(new RegExp('data-v52-context-guides="'+kind+'"','g'))||[]).length!==1)throw new Error(`Context rail missing ${route}`);
    const links=(html.match(/class="v52-context-guide"/g)||[]).length;if(links!==3)throw new Error(`Context guide links ${route} ${links}/3`);
    if(!html.includes('/assets/contextual-guides.css'))throw new Error(`Context guide styles missing ${route}`);
    guideLinks+=links;styledPages++;
  };
  for(const b of snapshot.brands){if(!candidateSet.has(b.route))throw new Error(`Context candidate drift ${b.route}`);check(b.route,'brand');brandGuideRails++}
  for(const route of categoryRoutes){check(route,'category');categoryGuideRails++}
  for(const route of HUB_ROUTES){check(route,'hub');hubGuideRails++}
  const allCategories=fs.readdirSync(path.join(root,'categories'),{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>`/categories/${e.name}/`);
  for(const route of allCategories.filter(r=>!candidateSet.has(r))){const html=fs.readFileSync(fileFor(root,route),'utf8');if(html.includes('data-v52-context-guides='))throw new Error(`Noindex category received context rail ${route}`)}
  if(!fs.existsSync(path.join(root,'assets/contextual-guides.css')))throw new Error('Context guide css asset missing');
  return{contextualGuides:true,brandGuideRails,categoryGuideRails,hubGuideRails,totalGuideRails:brandGuideRails+categoryGuideRails+hubGuideRails,guideLinks,styledPages,candidateOnly:true};
}
