import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const file=path.join(ROOT,'interior-cost/matrix/index.html');
let html=fs.readFileSync(file,'utf8');

html=html.replace(/(<span>출시 후보<\/span><strong>)\d+개(<\/strong>)/,'$125개$2');
html=html.replace(/<div class="v21-boundary" data-v23-release-note>[\s\S]*?<\/div>/,'');
html=html.replace(/<div class="v21-boundary" data-v22-release-note>[\s\S]*?<\/div>/,'');
html=html.replace(/<p>모든 조합을 production 검색 후보로 올리지 않습니다\.[\s\S]*?상위노출 가능성을 의미하지 않습니다\.<\/p>/,'<p>v23에서 누락됐던 단열 OD0** 표준시장단가 8개 연결을 복구했습니다. 25개 조합 모두 데이터·편집 검수 후보이며, 검색량이나 상위노출을 보장하는 목록은 아닙니다. 실제 프리뷰는 계속 noindex입니다.</p>');

for(const p of [24,30,32,34,40]){
  const href=`${BASE}/interior-cost/matrix/${p}-pyeong/insulation/`;
  const escaped=href.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp(`<a class="v21-route-link(?: v21-hold)?" href="${escaped}">견적 확인<small>[^<]*<\\/small><\\/a>`);
  html=html.replace(re,`<a class="v21-route-link" href="${href}">견적 확인<small>단열 참조 복구</small></a>`);
}

const note='<div class="v21-boundary" data-v23-release-note><p><strong>v23 단열 참조 복구</strong></p><p>단열 5개 HOLD는 공식 데이터 부재가 아니라 matrix 매핑 누락이 원인이었습니다. 기존 2026년 하반기 OD0** 단열 8개 ㎡ 공공 참고항목을 연결하고 평수별 편집 검수를 추가해, 25개 모두 데이터·편집 검수 후보가 되었습니다. 실제 프리뷰는 계속 noindex이며 production 전환·Search Console 제출·광고 활성화는 하지 않습니다.</p></div>';
if(!html.includes('data-v21-matrix-filter'))throw new Error('v23 matrix filter anchor missing');
html=html.replace('<div data-v21-matrix-filter>',note+'<div data-v21-matrix-filter>');

const holdClasses=(html.match(/class="v21-route-link v21-hold"/g)||[]).length;
const restored=(html.match(/<small>단열 참조 복구<\/small>/g)||[]).length;
if(holdClasses!==0)throw new Error(`v23 matrix still has ${holdClasses} hold links`);
if(restored!==5)throw new Error(`v23 matrix insulation route labels ${restored}/5`);
if(!html.includes('출시 후보</span><strong>25개</strong>'))throw new Error('v23 matrix candidate count not finalized');
if(!html.includes('25개 모두 데이터·편집 검수 후보'))throw new Error('v23 matrix editorial state missing');

fs.writeFileSync(file,html);
console.log(JSON.stringify({ok:true,matrix_release:25,hold_links:holdClasses,insulation_route_labels:restored},null,2));
