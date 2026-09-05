import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');

const targets=[
  'cars/index.html',
  'cars/family/index.html',
  'data-sources/index.html'
];

const replacements=[
  ['공식 신고행 전체를 보존하면서 제조사 → 차종 → 세대 → 파워트레인 순으로 자동 정규화합니다.','한국에너지공단 공식 신고 데이터를 제조사 → 차종 → 세대 → 파워트레인 순으로 한눈에 확인할 수 있습니다.'],
  ['출처: 한국에너지공단 자동차 표시연비 정보 · 자동 정규화가 낮은 신뢰도인 차량도 삭제하지 않고 원문 모델 보기에서 그대로 확인할 수 있습니다.','출처: 한국에너지공단 자동차 표시연비 정보 · 모든 공식 신고 데이터는 삭제하지 않고 원문 모델 보기에서도 그대로 확인할 수 있습니다.'],
  ['모든 정규화 상태','모든 차량'],
  ['<th>정규화</th>','<th>데이터</th>'],
  ['검수 규칙','상세 확인'],
  ['자동 고신뢰','차종 확인'],
  ['자동 중신뢰','차종 확인'],
  ['원문 기준','공식 원문'],
  ['자동 정규화 결과는 검색·탐색용입니다. 개별 SEO 상세는 별도 검수를 통과한 차량만 생성합니다.','공식 신고 데이터는 검색·비교·계산에 사용하며, 별도 상세 페이지는 확인된 데이터가 충분한 차량부터 제공합니다.'],
  [' · 정규화 신뢰도 ${Math.round((f.confidence||0)*100)}%',''],
  ["${f.category?' · '+esc(f.category):''}","${f.category?esc(f.category):'공식 신고 데이터'}"],
  ['차종·세대 정규화','차종·세대 분류'],
  ['원문 신고행은 그대로 보존하고 서비스 탐색용 차종군만 별도 정규화. 근거 없는 세대 추정은 하지 않음','원문 신고행은 그대로 보존하고 같은 차종과 세대를 묶어 보기 쉽게 제공합니다. 근거 없는 세대 추정은 하지 않습니다.'],
  ['전장·전폭·전고·축거·출력·토크·배터리 용량을 KEA 원문과 분리된 enrichment 계층에 저장. 공식 페이지 연결 상태를 주기적으로 확인하고 미확인 값은 추정하지 않음','전장·전폭·전고·축거·출력·토크·배터리 용량은 제조사 공식 자료에서 확인된 경우에만 추가합니다. 공식 페이지를 주기적으로 다시 확인하며 미확인 값은 추정하지 않습니다.'],
  ['raw snapshot → hierarchy → calc index','공식 원문 → 차종·세대 → 계산 데이터'],
  ['원천 snapshot이 바뀌면 차종군·세대·계산 가능 인덱스까지 자동으로 다시 생성','공식 원문이 바뀌면 차종·세대와 계산 데이터를 자동으로 다시 만듭니다.'],
  ['제조사 공식 원문 → manufacturer spec snapshot','제조사 공식 자료 → 상세제원'],
  ['stable catalog ID + first_seen','신규 모델 자동 감지'],
  ['record signature 비교','공식 수치 변경 감지'],
  ['removed_from_latest','이전 제공 기록'],
  ['별도 quality gate','별도 품질 확인'],
  ['KEA 원문과 분리된 보강 계층입니다.','한국에너지공단 신고 데이터에 제조사 공식 제원을 추가해 보여줍니다.'],
  ['<table class="allcar-table"><thead><tr><th>제조사 / 차종','<table class="allcar-table family-table"><thead><tr><th>제조사 / 차종'],
  ["filterEl.innerHTML='<option value=\"all\">모든 차량</option><option value=\"reviewed_override\">상세 확인</option><option value=\"auto_high\">차종 확인</option><option value=\"auto_medium\">차종 확인</option><option value=\"raw_only\">공식 원문</option>'","filterEl.innerHTML='<option value=\"all\">모든 차량</option>'"],
  ["filterEl.value=p.get('filter')||(view==='family'?'all':'active')","filterEl.value=view==='family'?'all':(p.get('filter')||'active')"],
  ["if(view==='family'){document.getElementById('topStats')","if(view==='family'){filterEl.hidden=true;document.getElementById('topStats')"],
  ["}else{document.getElementById('topStats')","}else{filterEl.hidden=false;document.getElementById('topStats')"],
  ['.family-meta{font-size:13px;color:#666}', '.family-meta{font-size:13px;color:#666}.family-meta .badge{display:none}'],
  ['.source-strip{font-size:12px;color:#777;margin-top:12px}', '.source-strip{font-size:12px;color:#777;margin-top:12px}.family-table th:nth-child(4),.family-table td:nth-child(4){display:none}'],
  ['차량군 데이터','차량 상세'],
  ['차량군 ID가 없습니다.','차량 정보가 없습니다.'],
  ['해당 차량군을 찾지 못했습니다.','해당 차량을 찾지 못했습니다.'],
  ['차종군 보기','차종 보기'],
  ['차종군 계층','차량 목록'],
  ['서비스 차종군','차종'],
  ['차종군 상세','차량 상세'],
  ['차량군 QA','데이터 확인'],
  ['검수 완료 상세','상세제원'],
  ['검수 상세 연결','상세제원 있음'],
  ['검수 상세','상세제원'],
  ['세대그룹','세대']
];

for(const rel of targets){
  const file=path.join(root,rel);
  if(!fs.existsSync(file))continue;
  let html=fs.readFileSync(file,'utf8');
  for(const [from,to] of replacements)html=html.split(from).join(to);
  fs.writeFileSync(file,html);
  console.log(`Cleaned user-facing copy: ${rel}`);
}
