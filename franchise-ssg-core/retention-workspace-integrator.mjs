import fs from 'node:fs';
import path from 'node:path';

const BASE='/pm-lab/franchise-ssg-preview';
const HOME_START='<!-- v11.52 retention home: start -->',HOME_END='<!-- v11.52 retention home: end -->';
const COMPARE_START='<!-- v11.52 retention compare: start -->',COMPARE_END='<!-- v11.52 retention compare: end -->';
const UPDATES_START='<!-- v11.52 retention updates: start -->',UPDATES_END='<!-- v11.52 retention updates: end -->';
const BRAND_START='<!-- v11.52 retention brand: start -->',BRAND_END='<!-- v11.52 retention brand: end -->';

function requireRoot(root){if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');}
function esc(v){return String(v??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));}
function marked(text,start,end,block){
  const a=text.indexOf(start),b=text.indexOf(end);
  if((a<0)!=(b<0))throw new Error(`Incomplete marker ${start}`);
  if(a>=0){if(b<a)throw new Error(`Reversed marker ${start}`);return text.slice(0,a)+block+text.slice(b+end.length)}
  return null;
}
function ensureAssets(html){
  const css=`<link rel="stylesheet" href="${BASE}/assets/retention-workspace.css" data-v52-retention>`;
  const js=`<script src="${BASE}/assets/retention-workspace.js" defer data-v52-retention></script>`;
  if(!html.includes('/assets/retention-workspace.css'))html=html.replace('</head>',css+'</head>');
  if(!html.includes('/assets/retention-workspace.js'))html=html.replace('</body>',js+'</body>');
  return html;
}
function safeJson(v){return JSON.stringify(v).replace(/</g,'\\u003c')}
function publicBrand(b){return{name:b.name,slug:b.slug,route:b.route,categoryName:b.categoryName,cost:b.cost,stores:b.stores,sales:b.sales,growth:b.growth,sourceYear:b.sourceYear}}
function datasetScript(snapshot){return `<script type="application/json" data-v52-retention-dataset>${safeJson({snapshotId:snapshot.snapshot_id,sourceYear:snapshot.source_year,brands:snapshot.brands.map(publicBrand)})}</script>`}
const editorialSets={
  home:{title:'숫자를 보기 전에 확인할 것',note:'공개값 해석 가이드',links:[
    ['/guides/how-to-read-franchise-disclosure/','프랜차이즈 정보공개서는 어떤 순서로 봐야 하나','등록 상태부터 점포 변화·평균매출 기준연도·창업비용 항목까지 확인 순서를 정리했습니다.'],
    ['/guides/why-rent-deposit-is-not-in-startup-cost/','임대보증금이 창업비용에서 빠지는 이유','공개 창업비용과 점포 임대보증금·월세·권리금을 분리해서 봐야 하는 이유를 설명합니다.'],
    ['/guides/','창업 데이터 읽는 법 15편 전체 보기','정보공개서·비용·점포 증감·권리금·손익분기 등 질문별 가이드를 모았습니다.']
  ]},
  compare:{title:'비교 결과를 해석할 때',note:'같은 숫자도 기준을 맞춰 보기',links:[
    ['/guides/many-stores-do-not-mean-profit/','가맹점이 많으면 수익도 높은가','점포 수는 브랜드 규모 지표이며 개별 점포 수익을 직접 뜻하지 않는 이유를 확인합니다.'],
    ['/guides/how-to-read-open-close-store-counts/','신규점·계약종료·해지 숫자는 어떻게 읽나','신규점만 보지 않고 종료·해지와 이전 점포 수를 함께 비교하는 기준을 설명합니다.'],
    ['/guides/','창업 데이터 읽는 법 15편 전체 보기','비용·매출·점포 변화 수치를 비교하기 전에 필요한 해석 기준을 모았습니다.']
  ]},
  updates:{title:'점포 변화 숫자를 읽는 기준',note:'증가·감소를 수익성으로 오해하지 않기',links:[
    ['/guides/how-to-read-open-close-store-counts/','신규점·계약종료·해지 숫자는 어떻게 읽나','점포 수 증감과 신규·종료·해지 흐름을 같은 기간 기준으로 확인하는 방법입니다.'],
    ['/guides/why-our-number-differs-from-ftc/','공정위 조회 숫자와 이 사이트 숫자가 다를 수 있는 이유','기준연도·갱신 시점·명칭 정합·누락값 처리 차이를 어떻게 확인하는지 설명합니다.'],
    ['/guides/','창업 데이터 읽는 법 15편 전체 보기','점포 변화 외에도 창업비용·로열티·손익분기 등 판단 기준을 함께 확인할 수 있습니다.']
  ]}
};
function editorialRail(kind){
  const set=editorialSets[kind];if(!set)throw new Error(`Unknown editorial rail ${kind}`);
  return `<aside class="v52-editorial-rail" data-v52-editorial-rail="${esc(kind)}" aria-labelledby="v52-editorial-${esc(kind)}-title"><div class="v52-editorial-rail-head"><h2 id="v52-editorial-${esc(kind)}-title">${esc(set.title)}</h2><span>${esc(set.note)}</span></div><div class="v52-editorial-links">${set.links.map(([href,title,desc])=>`<a class="v52-editorial-link" href="${BASE}${href}"><strong>${esc(title)}</strong><small>${esc(desc)}</small><b aria-hidden="true">가이드</b></a>`).join('')}</div></aside>`;
}
const checklist=[
  ['disclosure','최신 정보공개서 원문 확인'],
  ['opening-cost','본사 개설비 견적을 항목별로 확인'],
  ['lease','임대보증금·권리금 등 점포비용을 별도 입력'],
  ['construction','철거·전기·냉난방·외부공사 범위를 확인'],
  ['recurring','로열티·필수구매·월 고정비를 확인'],
  ['simulation','월 손익·손익분기 시뮬레이션 완료']
];
function brandBlock(b,snapshot){
  return `${BRAND_START}<section class="v52-brand-workspace" data-v52-brand-workspace="1" data-brand-slug="${esc(b.slug)}" data-brand-name="${esc(b.name)}" data-brand-route="${esc(b.route)}" data-brand-category="${esc(b.categoryName)}" data-cost="${Number(b.cost)}" data-stores="${Number(b.stores)}" data-sales="${Number(b.sales)}" data-growth="${Number(b.growth)}" data-source-year="${Number(b.sourceYear)}" data-snapshot-id="${esc(snapshot.snapshot_id)}"><div class="v52-brand-workspace-top"><div class="v52-brand-workspace-copy"><strong>내 후보로 저장</strong><span>저장 당시 공개값과 다음 데이터 갱신 값을 이 브라우저에서 비교합니다.</span></div><button type="button" class="v52-save-button" data-v52-save-brand aria-pressed="false">관심 브랜드 저장</button></div><div class="v52-brand-change" data-v52-brand-change hidden></div><details class="v52-checklist"><summary>계약 전 체크리스트 <b data-v52-check-progress>0/6</b></summary><div class="v52-checklist-grid">${checklist.map(([k,t])=>`<label><input type="checkbox" data-v52-check="${k}"><span>${t}</span></label>`).join('')}</div><p class="v52-local-note">체크 상태와 관심 브랜드는 서버로 전송하지 않고 현재 브라우저의 저장공간에만 보관합니다.</p></details><details class="v52-candidate-note"><summary>후보 메모 <b data-v52-note-count>0/240</b></summary><label><span>이 브랜드를 저장한 이유나 다시 확인할 항목</span><textarea data-v52-candidate-note maxlength="240" rows="3" placeholder="예: 본사 견적에서 전기증설 비용 확인, 임대보증금 3천만원 기준으로 다시 계산"></textarea></label><p class="v52-local-note">메모도 서버로 전송하지 않고 현재 브라우저에만 저장합니다.</p></details><details class="v52-candidate-plan"><summary>후보 상태·다음 행동 <b data-v52-plan-summary>검토 중</b></summary><div class="v52-candidate-plan-grid"><label><span>현재 상태</span><select data-v52-candidate-status><option value="review">검토 중</option><option value="hq">본사 문의</option><option value="site">입지 확인</option><option value="hold">보류</option></select></label><label><span>다음 확인할 일</span><input type="text" data-v52-next-action maxlength="120" placeholder="예: 본사에 20평 기준 최신 견적 요청"></label></div><p class="v52-local-note">상태와 다음 행동도 현재 브라우저에만 저장합니다.</p></details></section>${BRAND_END}`;
}
function homeBlock(snapshot){
 return `${HOME_START}<section class="v52-retention-home" data-v52-retention-home="1" aria-labelledby="v52-retention-home-title"><div class="v52-retention-head"><div><small>다시 방문할 이유</small><strong id="v52-retention-home-title">내 후보와 최근 본 브랜드 이어보기</strong></div><p>관심 브랜드를 저장하면 다음 데이터 갱신 때 저장 당시 공개값과 현재 공개값의 차이를 확인할 수 있습니다. 로그인 없이 현재 브라우저에만 저장됩니다.</p></div><div class="v52-retention-alert" data-v52-retention-alert hidden></div><div class="v52-shortlist-dashboard" data-v52-shortlist-dashboard><div class="v52-shortlist-stats"><div><small>저장 후보</small><strong data-v52-dashboard-saved>0</strong></div><div><small>계약 전 확인</small><strong data-v52-dashboard-checks>0/0</strong></div><div><small>변화 감지</small><strong data-v52-dashboard-changes>0</strong></div></div><div class="v52-shortlist-toolbar"><div class="v52-status-filters" aria-label="후보 필터"><button type="button" data-v52-status-filter="all" aria-pressed="true">전체</button><button type="button" data-v52-status-filter="review" aria-pressed="false">검토 중</button><button type="button" data-v52-status-filter="hq" aria-pressed="false">본사 문의</button><button type="button" data-v52-status-filter="site" aria-pressed="false">입지 확인</button><button type="button" data-v52-status-filter="hold" aria-pressed="false">보류</button><button type="button" data-v52-change-only aria-pressed="false">변경 있음 <b data-v52-change-filter-count>0</b></button></div><div class="v52-backup-actions"><button type="button" data-v52-export-shortlist>후보 백업</button><button type="button" data-v52-import-shortlist>백업 복원</button><input type="file" accept="application/json,.json" data-v52-import-file hidden><span data-v52-backup-status aria-live="polite"></span></div></div></div><section class="v52-change-inbox" data-v52-change-inbox="home" hidden><div class="v52-change-inbox-head"><div><small>저장 기준과 현재 공개값 비교</small><strong>변경 후보 확인</strong></div><button type="button" data-v52-ack-all-changes>모두 현재값으로 확인</button></div><div class="v52-change-inbox-list" data-v52-change-inbox-list></div></section><div class="v52-retention-columns"><div class="v52-retention-group"><h3>저장한 후보</h3><div class="v52-retention-list" data-v52-saved-list><p class="v52-retention-empty">브랜드 상세에서 관심 브랜드를 저장해 보세요.</p></div></div><div class="v52-retention-group"><h3>최근 본 브랜드</h3><div class="v52-retention-list" data-v52-recent-list><p class="v52-retention-empty">브랜드 상세를 열면 최근 기록이 여기에 남습니다.</p></div></div></div>${datasetScript(snapshot)}${editorialRail('home')}</section>${HOME_END}`;
}
function compareBlock(snapshot){
 return `${COMPARE_START}<section class="v52-saved-compare" data-v52-saved-compare="1" aria-labelledby="v52-saved-compare-title"><div class="v52-retention-head"><div><small>저장 후보</small><strong id="v52-saved-compare-title">내 후보로 바로 비교</strong></div><p>브랜드 상세에서 저장한 후보를 최대 4개까지 현재 비교 화면에 불러옵니다.</p></div><div class="v52-saved-compare-list" data-v52-saved-compare-list><span class="v52-retention-empty">저장한 후보가 없습니다.</span></div><div class="v52-saved-compare-actions"><button type="button" class="v52-load-saved" data-v52-load-saved>후보 2개 이상 저장하면 불러올 수 있습니다</button><span>저장 정보는 이 브라우저에만 남습니다.</span></div>${datasetScript(snapshot)}${editorialRail('compare')}</section>${COMPARE_END}`;
}
function deltaOf(b){if(!Array.isArray(b.history)||b.history.length<2)return null;const a=b.history.at(-2),z=b.history.at(-1);if(!Number.isFinite(Number(a?.stores))||!Number.isFinite(Number(z?.stores)))return null;return{...publicBrand(b),fromYear:a.year,toYear:z.year,fromStores:a.stores,toStores:z.stores,delta:Number(z.stores)-Number(a.stores)}}
function radarRows(rows){return rows.map(x=>`<div class="v52-change-radar-row"><a href="${BASE}${x.route}">${esc(x.name)}</a><span>${x.delta>0?'+':''}${new Intl.NumberFormat('ko-KR').format(x.delta)}개</span><small>${x.fromYear}년 ${new Intl.NumberFormat('ko-KR').format(x.fromStores)}개 → ${x.toYear}년 ${new Intl.NumberFormat('ko-KR').format(x.toStores)}개</small></div>`).join('')}
function updatesBlock(snapshot){
 const deltas=snapshot.brands.map(deltaOf).filter(Boolean);
 const up=[...deltas].filter(x=>x.delta>0).sort((a,b)=>b.delta-a.delta).slice(0,6);
 const down=[...deltas].filter(x=>x.delta<0).sort((a,b)=>a.delta-b.delta).slice(0,6);
 if(up.length<3||down.length<3)throw new Error(`Insufficient update radar ${up.length}/${down.length}`);
 return `${UPDATES_START}<section class="v52-retention-updates" data-v52-retention-updates="1" aria-labelledby="v52-change-radar-title"><div class="v52-retention-head"><div><small>${esc(snapshot.snapshot_id)}</small><strong id="v52-change-radar-title">공개자료 점포 변화 레이더</strong></div><p>같은 브랜드의 최근 두 공개 기준년도 가맹점 수 차이를 자체 계산했습니다. 변화가 크다는 사실은 수익성·성장성 추천을 뜻하지 않습니다.</p></div><div class="v52-retention-alert" data-v52-retention-alert hidden></div><section class="v52-change-inbox" data-v52-change-inbox="updates" hidden><div class="v52-change-inbox-head"><div><small>내 저장 후보</small><strong>저장 후 달라진 공개값</strong></div><button type="button" data-v52-ack-all-changes>모두 현재값으로 확인</button></div><div class="v52-change-inbox-list" data-v52-change-inbox-list></div></section><div class="v52-change-radar"><div><h3>점포 수 증가폭 상단</h3><div class="v52-change-radar-list">${radarRows(up)}</div></div><div><h3>점포 수 감소폭 상단</h3><div class="v52-change-radar-list">${radarRows(down)}</div></div></div><p class="v52-change-radar-note">증감은 공정위 공개자료의 기준년도 간 가맹점 수 단순 차이입니다. 신규점, 계약종료, 계약해지와 개별 점포 수익성은 별도로 확인해야 합니다.</p><div class="v52-retention-columns"><div class="v52-retention-group"><h3>내 저장 후보 현재값</h3><div class="v52-retention-list" data-v52-saved-list><p class="v52-retention-empty">저장한 후보가 있으면 현재 스냅샷과 비교합니다.</p></div></div><div class="v52-retention-group"><h3>최근 본 브랜드</h3><div class="v52-retention-list" data-v52-recent-list><p class="v52-retention-empty">최근 본 브랜드가 없습니다.</p></div></div></div>${datasetScript(snapshot)}${editorialRail('updates')}</section>${UPDATES_END}`;
}
function writeIf(file,next,before){if(next!==before)fs.writeFileSync(file,next);return next!==before}

export function applyRetentionWorkspace(root,coreDir){
 requireRoot(root);if(typeof coreDir!=='string'||!path.isAbsolute(coreDir))throw new Error('Explicit absolute core dir required');
 const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data-snapshot-v11-26.json'),'utf8'));
 if(snapshot.brand_count!==136||snapshot.brands?.length!==136)throw new Error(`Retention snapshot brand baseline ${snapshot.brand_count}/${snapshot.brands?.length}`);
 fs.copyFileSync(path.join(coreDir,'retention-workspace.js'),path.join(root,'assets/retention-workspace.js'));
 fs.copyFileSync(path.join(coreDir,'retention-workspace.css'),path.join(root,'assets/retention-workspace.css'));

 let changed=0,brandWorkspaces=0;
 const byRoute=new Map(snapshot.brands.map(b=>[b.route,b]));
 for(const [route,b] of byRoute){
   const file=path.join(root,...route.split('/').filter(Boolean),'index.html');
   if(!fs.existsSync(file))throw new Error(`Trusted brand file missing ${route}`);
   let html=fs.readFileSync(file,'utf8'),before=html;
   const block=brandBlock(b,snapshot);
   const repl=marked(html,BRAND_START,BRAND_END,block);
   if(repl!==null)html=repl;
   else{
     const needle='<!-- v11.49 brand cost checks -->';
     if(!html.includes(needle))throw new Error(`Brand workspace insertion point missing ${route}`);
     html=html.replace(needle,block+needle);
   }
   html=ensureAssets(html);if(writeIf(file,html,before))changed++;brandWorkspaces++;
 }
 {
   const file=path.join(root,'index.html');let html=fs.readFileSync(file,'utf8'),before=html,block=homeBlock(snapshot);
   const repl=marked(html,HOME_START,HOME_END,block);if(repl!==null)html=repl;else{
     const needle='<!-- v11.52 home decision: end -->';if(!html.includes(needle))throw new Error('Home retention insertion point missing');html=html.replace(needle,needle+block);
   }
   html=ensureAssets(html);if(writeIf(file,html,before))changed++;
 }
 {
   const file=path.join(root,'compare/index.html');let html=fs.readFileSync(file,'utf8'),before=html,block=compareBlock(snapshot);
   const repl=marked(html,COMPARE_START,COMPARE_END,block);if(repl!==null)html=repl;else{
     const needle='<!-- v11.34 compare workspace -->';if(!html.includes(needle))throw new Error('Compare retention insertion point missing');html=html.replace(needle,block+needle);
   }
   html=ensureAssets(html);if(writeIf(file,html,before))changed++;
 }
 {
   const file=path.join(root,'updates/index.html');let html=fs.readFileSync(file,'utf8'),before=html,block=updatesBlock(snapshot);
   const repl=marked(html,UPDATES_START,UPDATES_END,block);if(repl!==null)html=repl;else{
     const needle='<section class="block v11-24-polish" data-v11-24-polish="updates">';if(!html.includes(needle))throw new Error('Updates retention insertion point missing');html=html.replace(needle,block+needle);
   }
   html=ensureAssets(html);if(writeIf(file,html,before))changed++;
 }
 const result=validateRetentionWorkspace(root);
 return{changed,...result,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,candidateSetChanged:false};
}

export function validateRetentionWorkspace(root){
 requireRoot(root);
 const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data-snapshot-v11-26.json'),'utf8'));
 let brandWorkspaces=0,assetPages=0;
 for(const b of snapshot.brands){
   const file=path.join(root,...b.route.split('/').filter(Boolean),'index.html'),html=fs.readFileSync(file,'utf8');
   if((html.match(/data-v52-brand-workspace="1"/g)||[]).length!==1)throw new Error(`Brand retention workspace missing ${b.route}`);
   for(const k of ['data-v52-save-brand','data-v52-check="disclosure"','data-v52-check="simulation"','data-v52-candidate-note','data-v52-note-count','data-v52-candidate-status','data-v52-next-action','data-v52-plan-summary'])if(!html.includes(k))throw new Error(`Brand retention control missing ${k} ${b.route}`);
   if(!html.includes('/assets/retention-workspace.css')||!html.includes('/assets/retention-workspace.js'))throw new Error(`Brand retention assets missing ${b.route}`);
   brandWorkspaces++;assetPages++;
 }
 const home=fs.readFileSync(path.join(root,'index.html'),'utf8'),compare=fs.readFileSync(path.join(root,'compare/index.html'),'utf8'),updates=fs.readFileSync(path.join(root,'updates/index.html'),'utf8');
 if((home.match(/data-v52-retention-home="1"/g)||[]).length!==1||(home.match(/data-v52-retention-dataset/g)||[]).length!==1)throw new Error('Home retention block/dataset');
 if((home.match(/data-v52-shortlist-dashboard/g)||[]).length!==1)throw new Error('Home shortlist dashboard missing');
 for(const token of ['data-v52-dashboard-saved','data-v52-dashboard-checks','data-v52-dashboard-changes','data-v52-export-shortlist','data-v52-import-shortlist','data-v52-import-file','data-v52-change-only','data-v52-change-filter-count'])if(!home.includes(token))throw new Error(`Home shortlist control missing ${token}`);
 if((home.match(/data-v52-change-inbox="home"/g)||[]).length!==1)throw new Error('Home change inbox missing');
 if((compare.match(/data-v52-saved-compare="1"/g)||[]).length!==1||(compare.match(/data-v52-retention-dataset/g)||[]).length!==1)throw new Error('Compare retention block/dataset');
 if((updates.match(/data-v52-retention-updates="1"/g)||[]).length!==1||(updates.match(/data-v52-retention-dataset/g)||[]).length!==1)throw new Error('Updates retention block/dataset');
 if((updates.match(/data-v52-change-inbox="updates"/g)||[]).length!==1)throw new Error('Updates change inbox missing');
 if((updates.match(/class="v52-change-radar-row"/g)||[]).length!==12)throw new Error('Updates change radar rows');
 let editorialGuideLinks=0;
 for(const [kind,html] of [['home',home],['compare',compare],['updates',updates]]){
   if((html.match(new RegExp('data-v52-editorial-rail="'+kind+'"','g'))||[]).length!==1)throw new Error(`Editorial rail missing ${kind}`);
   const links=(html.match(/class="v52-editorial-link"/g)||[]).length;if(links!==3)throw new Error(`Editorial guide links ${kind} ${links}/3`);editorialGuideLinks+=links;
   if(!html.includes(BASE+'/guides/'))throw new Error(`Editorial guide hub link missing ${kind}`);
 }
 for(const html of [home,compare,updates]){if(!html.includes('/assets/retention-workspace.css')||!html.includes('/assets/retention-workspace.js'))throw new Error('Retention page assets missing');assetPages++}
 for(const asset of ['retention-workspace.css','retention-workspace.js'])if(!fs.existsSync(path.join(root,'assets',asset)))throw new Error(`Retention asset missing ${asset}`);
 const js=fs.readFileSync(path.join(root,'assets/retention-workspace.js'),'utf8');
 for(const token of ['franchiseLabShortlistV1','franchiseLabRecentV1','franchiseLabChecklistV1:','franchiseLabNoteV1:','franchiseLabPlanV1:','data-v52-load-saved','data-v52-ack-change','data-v52-candidate-note','data-v52-export-shortlist','data-v52-import-shortlist','data-v52-change-inbox','data-v52-ack-saved-change','data-v52-ack-all-changes','data-v52-change-only'])if(!js.includes(token))throw new Error(`Retention JS missing ${token}`);
 return{retentionWorkspace:true,brandWorkspaces,assetPages,homeWorkspace:true,compareSavedLoader:true,updatesRadarRows:12,localOnlyPersistence:true,candidateNotes:true,checklistProgressSummary:true,candidatePlanning:true,shortlistDashboard:true,shortlistBackup:true,changeInbox:true,changeInboxSurfaces:2,changeAcknowledgement:true,changedOnlyFilter:true,editorialRails:3,editorialGuideLinks};
}
