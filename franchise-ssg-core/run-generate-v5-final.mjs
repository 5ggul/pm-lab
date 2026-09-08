import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v5.mjs?final=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const SITE=(process.env.SSG_SITE_URL??`https://5ggul.github.io${BASE}`).replace(/\/$/,'');

const webApp=(name,pathName)=>`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebApplication',name,url:`${SITE}${pathName}`,applicationCategory:'BusinessApplication',operatingSystem:'Web'})}</script>`;
const faq=(rows)=>`<section class="block"><h2>자주 묻는 질문</h2><div class="faq">${rows.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></section>`;

async function patchTool(rel,{name,pathName,quality}){
 const file=path.join(out,rel,'index.html');
 let h=await fs.readFile(file,'utf8');
 if(!h.includes('"@type":"WebApplication"'))h=h.replace('</head>',`${webApp(name,pathName)}</head>`);
 if(!h.includes('data-v5-quality="1"'))h=h.replace('</main>',`<section class="shell page" data-v5-quality="1">${quality}</section></main>`);
 await fs.writeFile(file,h,'utf8');
}

await patchTool('tools/brand-filter',{
 name:'조건으로 프랜차이즈 브랜드 찾기',pathName:'/tools/brand-filter/',
 quality:`<section class="block"><h2>계산식</h2><p class="formula">결과 = 브랜드명·업종·최대 공개비용·최소 가맹점 수·점포 변화 조건을 모두 통과한 브랜드 집합</p></section><section class="block"><h2>계산 예</h2><div class="example-grid"><div><b>예시 A</b><p>카페 · 공개비용 1억원 이하 · 가맹점 100개 이상으로 좁힙니다.</p></div><div><b>예시 B</b><p>치킨 · 가맹점 300개 이상 · 전년 대비 점포 증가 조건으로 좁힙니다.</p></div></div></section>${faq([['조건을 많이 통과한 브랜드가 더 좋은 브랜드인가요?','아닙니다. 사용자가 입력한 필터를 통과했다는 뜻일 뿐 수익성·안정성·성공 가능성을 의미하지 않습니다.'],['공개비용은 실제 총 준비자금인가요?','아닙니다. 임대보증금·권리금·운전자금·별도공사 등이 빠질 수 있습니다.'],['가맹점 수가 많으면 수익도 높나요?','아닙니다. 점포 수는 브랜드 규모를 보는 자료이며 개별 점포 수익을 뜻하지 않습니다.'],['누락된 값은 0으로 계산하나요?','아닙니다. 정보 없음과 실제 0은 구분합니다.']])}`
});

await patchTool('tools/monthly-profit-simulator',{
 name:'프랜차이즈 월 손익 시뮬레이터',pathName:'/tools/monthly-profit-simulator/',
 quality:`<section class="block"><h2>계산 예</h2><div class="example-grid"><div><b>입력</b><p>월매출·원가율·플랫폼비율·로열티·인건비·임차료를 직접 입력합니다.</p></div><div><b>출력</b><p>단순 영업잔액과 입력 가정에 따른 손익분기 매출을 계산합니다.</p></div></div></section>${faq([['이 결과가 예상 순이익인가요?','아닙니다. 사용자가 입력한 항목만 반영한 단순 시뮬레이션이며 세금·대출·감가상각·점주 인건비 등은 별도입니다.'],['브랜드 평균매출을 그대로 넣어도 되나요?','평균매출은 개별 점포 매출을 보장하지 않습니다. 사용 목적에 맞는 가정값을 별도로 입력해야 합니다.'],['손익분기 매출보다 높으면 창업해도 되나요?','그렇게 판단할 수 없습니다. 계산 결과는 의사결정을 대신하지 않으며 실제 비용과 계약조건을 추가로 확인해야 합니다.'],['결과가 양수면 수익이 보장되나요?','아닙니다. 실제 영업 결과와 사업 성과를 보장하지 않습니다.']])}`
});

console.log(JSON.stringify({v5ToolQuality:true,tools:['brand-filter','monthly-profit-simulator']},null,2));
