import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE='/pm-lab/franchise-ssg-preview';
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const generatedAt=new Date().toISOString();
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const report15=JSON.parse(await fs.readFile(path.join(out,'v11-15-tool-trust.json'),'utf8'));
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeJson=v=>JSON.stringify(v).replace(/</g,'\\u003c');

const tools=[
  {slug:'startup-cost',name:'창업비용 계산기',group:'초기 투자·준비자금',goal:'공개비용에 보증금·권리금·별도 공사를 더해 준비자금 범위를 확인',basis:'공식 공개값 + 사용자 입력'},
  {slug:'disclosure-decoder',name:'정보공개서 비용 항목 계산기',group:'초기 투자·준비자금',goal:'가맹비·교육비·보증금·기타비·인테리어 항목을 분리해 합계를 확인',basis:'사용자 입력'},
  {slug:'monthly-fixed-cost',name:'월 고정비 계산기',group:'초기 투자·준비자금',goal:'월세·관리비·고정 인건비·원리금 등 매달 고정되는 금액을 합산',basis:'사용자 입력'},
  {slug:'monthly-profit-simulator',name:'월 손익 계산기',group:'운영·회수',goal:'월 매출과 변동비·고정비를 입력해 단순 영업잔액을 확인',basis:'사용자 입력'},
  {slug:'break-even',name:'손익분기 계산기',group:'운영·회수',goal:'투자금과 월 잔액을 기준으로 단순 회수기간을 계산',basis:'사용자 입력'},
  {slug:'brand-filter',name:'브랜드 조건 찾기',group:'브랜드·업종 비교',goal:'업종·공개비용·가맹점 수·점포 증감 조건으로 브랜드를 좁혀 보기',basis:'공식 매칭 공개값'},
  {slug:'category-median',name:'업종 중앙값 비교',group:'브랜드·업종 비교',goal:'선택 브랜드 공개비용을 같은 업종의 공식 매칭 중앙값과 비교',basis:'공식 매칭값의 파생 통계'},
  {slug:'open-close-rate',name:'가맹점 개·폐업률 계산기',group:'브랜드·업종 비교',goal:'기준 점포 수와 신규·종료·해지 건수를 같은 분모로 계산',basis:'사용자 입력'}
].map(t=>({...t,route:`/tools/${t.slug}/`,href:`${BASE}/tools/${t.slug}/`}));
const bySlug=new Map(tools.map(t=>[t.slug,t]));
const related={
  'startup-cost':['disclosure-decoder','monthly-fixed-cost'],
  'disclosure-decoder':['startup-cost','monthly-fixed-cost'],
  'monthly-fixed-cost':['monthly-profit-simulator','break-even','startup-cost'],
  'monthly-profit-simulator':['monthly-fixed-cost','break-even'],
  'break-even':['monthly-profit-simulator','monthly-fixed-cost'],
  'brand-filter':['category-median','open-close-rate'],
  'category-median':['brand-filter','startup-cost'],
  'open-close-rate':['brand-filter','category-median']
};
const linkRow=t=>`<a href="${t.href}"><strong>${esc(t.name)}</strong><span>${esc(t.goal)}</span></a>`;
const groupList=group=>`<div class="tool-link-list">${tools.filter(t=>t.group===group).map(linkRow).join('')}</div>`;
const tableRows=tools.map(t=>`<tr data-v11-16-tool-row="${t.slug}"><td><a href="${t.href}">${esc(t.name)}</a></td><td>${esc(t.goal)}</td><td>${esc(t.basis)}</td></tr>`).join('');
const itemList={'@context':'https://schema.org','@type':'ItemList','@id':`${SITE}/tools/#tool-list`,name:'프랜차이즈 창업 계산기·분석 도구',numberOfItems:tools.length,itemListElement:tools.map((t,i)=>({'@type':'ListItem',position:i+1,name:t.name,url:`${SITE}${t.route}`}))};
const hubMain=`<main data-v11-16-tool-hub="1"><div class="shell page"><nav class="crumbs" aria-label="현재 위치"><a href="${BASE}">홈</a><i>›</i><span>계산기</span></nav><div class="page-head"><h1>프랜차이즈 창업 계산기·분석 도구</h1><p>현재 데이터·입력 의미를 검증한 8개 도구만 모았습니다. 공식 공개값, 사용자가 넣는 가정, 공개값에서 계산한 파생 통계를 서로 구분합니다.</p></div><section class="block"><h2>무엇을 확인하려는지부터 고르세요</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>도구</th><th>확인하는 것</th><th>값의 기준</th></tr></thead><tbody>${tableRows}</tbody></table></div></section><section class="block"><h2>공식값과 입력값을 섞지 않습니다</h2><dl class="tool-basis-list"><div><dt>공식 매칭 공개값</dt><dd>공정거래위원회 공개자료와 안전 매칭한 브랜드 값입니다. 누락값은 0으로 바꾸지 않습니다.</dd></div><div><dt>사용자 입력</dt><dd>월세·인건비·매출·권리금처럼 사용자가 직접 넣은 가정입니다. 사이트가 평균값을 임의로 채우지 않습니다.</dd></div><div><dt>파생 통계</dt><dd>공식 매칭값 중 실제 값이 확인된 표본만 사용해 중앙값·비율 등을 계산한 값입니다.</dd></div></dl></section><section class="block"><h2>초기 투자·준비자금</h2>${groupList('초기 투자·준비자금')}</section><section class="block"><h2>운영·회수</h2>${groupList('운영·회수')}</section><section class="block"><h2>브랜드·업종 비교</h2>${groupList('브랜드·업종 비교')}</section><section class="block"><h2>계산 결과를 읽는 기준</h2><div class="faq"><details><summary>계산 결과가 실제 계약금액과 같은가요?</summary><p>아닙니다. 공개자료와 사용자가 입력한 가정을 정리하는 도구이며 실제 견적·계약서·최신 정보공개서를 다시 확인해야 합니다.</p></details><details><summary>정보가 없으면 0으로 계산하나요?</summary><p>공식 공개값의 누락은 0과 구분합니다. 값이 필요한 비교·필터에서는 정보 없음으로 처리합니다.</p></details><details><summary>월 손익과 평균매출은 같은 의미인가요?</summary><p>아닙니다. 평균매출 공개지표는 수익이 아니며 월 손익 도구는 사용자가 입력한 비용 가정으로 단순 영업잔액을 계산합니다.</p></details></div></section></div></main>`;

const hubPath=path.join(out,'tools/index.html');
let hub=await fs.readFile(hubPath,'utf8');
hub=hub.replace(/<meta name="description" content="[^"]*">/,'<meta name="description" content="창업비용, 정보공개서 비용, 월 고정비, 월 손익, 손익분기, 브랜드 조건, 업종 중앙값, 개·폐업률을 목적별로 계산하고 비교합니다.">');
hub=hub.replace(/<script type="application\/ld\+json" data-v11-16-tool-list>[\s\S]*?<\/script>/,'').replace('</head>',`<script type="application/ld+json" data-v11-16-tool-list>${safeJson(itemList)}</script></head>`);
hub=hub.replace(/<main[\s\S]*?<\/main>/,hubMain);
await fs.writeFile(hubPath,hub,'utf8');

const relatedPatched=[];
for(const tool of tools){
  const file=path.join(out,`tools/${tool.slug}/index.html`);
  let html=await fs.readFile(file,'utf8');
  html=html.replace(/<section class="block tool-related" data-v11-16-related-tools="1">[\s\S]*?<\/section>/,'');
  const rel=(related[tool.slug]||[]).map(slug=>bySlug.get(slug)).filter(Boolean);
  const section=`<section class="block tool-related" data-v11-16-related-tools="1"><h2>다음에 같이 확인할 도구</h2><div class="tool-link-list">${rel.map(linkRow).join('')}</div></section>`;
  if(html.includes('</article>'))html=html.replace('</article>',`${section}</article>`);else html=html.replace('</main>',`${section}</main>`);
  await fs.writeFile(file,html,'utf8');
  relatedPatched.push({route:tool.route,related:rel.map(x=>x.route)});
}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.16 tool directory */')){css+=`\n/* v11.16 tool directory */\n.tool-link-list{display:grid;border-top:1px solid var(--line)}.tool-link-list a{display:grid;grid-template-columns:minmax(170px,230px) 1fr;gap:18px;align-items:start;padding:15px 2px;border-bottom:1px solid var(--line);text-decoration:none}.tool-link-list strong{font-size:15px}.tool-link-list span{font-size:14px;line-height:1.6;color:var(--muted)}.tool-basis-list{display:grid;margin:0}.tool-basis-list>div{display:grid;grid-template-columns:minmax(150px,210px) 1fr;gap:18px;padding:14px 0;border-bottom:1px solid var(--line)}.tool-basis-list dt{font-weight:800}.tool-basis-list dd{margin:0;color:var(--muted);line-height:1.7}@media(max-width:720px){.tool-link-list a,.tool-basis-list>div{grid-template-columns:1fr;gap:5px}}\n`;await fs.writeFile(cssPath,css,'utf8')}

quality.contentTrust={...(quality.contentTrust||{}),version:'11.16',generatedAt,toolHubPolicy:true,toolHubCount:tools.length,toolRelatedLinks:true,toolValueBasisLabels:true};
await fs.writeFile(qualityPath,JSON.stringify(quality,null,2),'utf8');
manifest.uiVersion='11.16';manifest.v11_16={toolHubPolicy:true,approvedToolCount:tools.length,toolHubItemList:true,toolRelatedLinks:true,toolValueBasisLabels:true,blockedToolStillExcluded:true};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
const report={schemaVersion:1,generatedAt,uiVersion:'11.16',previewMode:report15.previewMode,policy:'ONE_TOOL_ONE_INTENT; HUB_LISTS_ONLY_V11_15_APPROVED_TOOLS; OFFICIAL_USER_DERIVED_VALUES_EXPLICIT; BLOCKED_STORE_DENSITY_NOT_LINKED',approvedToolCount:tools.length,productionCandidateCount:report15.productionCandidateCount,hubRoutes:tools.map(t=>t.route),relatedPatched,blockedRoutes:report15.blockedToolRoutes};
await fs.writeFile(path.join(out,'v11-16-tool-hub.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_16:'PASS',approvedToolCount:tools.length,relatedPages:relatedPatched.length,productionCandidates:report.productionCandidateCount},null,2));
