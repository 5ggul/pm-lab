'use strict';

const readinessLabel = (s) => {
  const live=s?.live||s?.availability||'UNKNOWN';
  const map={
    LIVE_VERIFIED:'실호출 확인',READY:'동작',KEY_REQUIRED:'인증키 대기',ENDPOINT_MAPPING_REQUIRED:'명세 매핑 대기',APPROVAL_OR_KEY_REQUIRED_BY_DATASET:'데이터셋별 승인/키 필요',LIVE_ERROR:'실호출 오류',PORTAL_VERIFIED:'포털 확인',METADATA_VERIFIED:'메타데이터 확인',METADATA_UNAVAILABLE:'메타데이터 오류'
  };
  return map[live]||live;
};
const readinessClass=(s)=>{
  const x=s?.live||s?.availability||'';
  if(['LIVE_VERIFIED','READY'].includes(x)) return 'ok';
  if(['METADATA_VERIFIED','PORTAL_VERIFIED'].includes(x)) return 'ready';
  if(x.includes('ERROR')||x.includes('UNAVAILABLE')) return 'bad';
  return 'wait';
};
const sourceStatusList=()=>globalThis.SOURCE_STATUS?.sources||[];
const fmtChecked=(v)=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';

function sourceReadinessTable(){
 const list=sourceStatusList();
 return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>소스</th><th>현재 상태</th><th>라이선스/접근</th><th>최근 확인</th></tr></thead><tbody>${list.map(s=>`<tr><td><b>${esc(s.name||s.id)}</b><br><small>${esc(s.provider||'')}</small></td><td><span class="status-pill ${readinessClass(s)}">${esc(readinessLabel(s))}</span></td><td>${esc(s.license|| (s.id==='fairdata'?'데이터셋별 조건 확인':'자체 계산'))}</td><td>${fmtChecked(s.checkedAt)}</td></tr>`).join('')}</tbody></table></div>`;
}

globalThis.sourcesPage=function(){
 setTitle('데이터 출처');
 const list=sourceStatusList();
 return `<div class="page"><section class="page-hero"><div class="shell">${crumb([{label:'데이터 출처'}])}<div class="page-head"><div><span class="eyebrow">DATA SOURCES</span><h1>데이터 출처와 실제 연결 준비 상태</h1><p>공식 소스의 메타데이터, 이용조건, 인증·승인 필요 여부, 실호출 검증 상태를 분리해서 공개합니다.</p></div></div></div></section><div class="shell content-wrap">${previewNotice()}<div class="source-grid">${list.map(s=>`<article class="source-card"><div class="source-card-head"><span class="status-pill ${readinessClass(s)}">${esc(readinessLabel(s))}</span><h2>${esc(s.name||s.id)}</h2><p>${esc(s.provider||'')}</p></div><dl><div><dt>메타데이터</dt><dd>${esc(s.availability||'—')}</dd></div><div><dt>실데이터 상태</dt><dd>${esc(s.live||'—')}</dd></div><div><dt>이용허락</dt><dd>${esc(s.license|| (s.id==='fairdata'?'데이터셋별 확인 필요':'자체 계산'))}</dd></div><div><dt>원천 수정일</dt><dd>${esc(s.modifiedAt||s.latestPortalDate||'—')}</dd></div><div><dt>최근 확인</dt><dd>${fmtChecked(s.checkedAt)}</dd></div></dl>${s.guideUrl?`<a href="${s.guideUrl}" target="_blank" rel="noopener" class="text-link">공식 안내 페이지 ↗</a>`:''}</article>`).join('')}</div><section class="panel" style="margin-top:20px"><h2>정식 수치 전환 규칙</h2><p>메타데이터 확인만 끝난 소스는 브랜드 숫자에 사용하지 않습니다. 실제 API 응답 검증 → Snapshot 저장 → 이상치 검사까지 통과한 소스만 화면의 공식 수치로 승격합니다. FairData는 데이터셋별 승인 조건을 확인한 뒤 허용된 범위만 활성화합니다.</p></section></div></div>`;
};

globalThis.updatesPage=function(){
 setTitle('데이터 업데이트 현황');
 const st=globalThis.SOURCE_STATUS||{generatedAt:null,dataMode:'UNKNOWN',sources:[]};
 const live=st.sources.filter(s=>['LIVE_VERIFIED','READY'].includes(s.live)).length;
 const pending=st.sources.filter(s=>['KEY_REQUIRED','ENDPOINT_MAPPING_REQUIRED','APPROVAL_OR_KEY_REQUIRED_BY_DATASET'].includes(s.live)).length;
 return `<div class="page"><section class="page-hero"><div class="shell">${crumb([{label:'업데이트 현황'}])}<div class="page-head"><div><span class="eyebrow">DATA FRESHNESS</span><h1>데이터 업데이트 현황</h1><p>메타데이터 확인과 실제 데이터 연결을 별도 단계로 관리해, 준비되지 않은 값을 최신 공식값처럼 보이지 않게 합니다.</p></div></div></div></section><div class="shell content-wrap"><div class="data-strip"><div><small>상태 스냅샷</small><b>${fmtChecked(st.generatedAt)}</b></div><div><small>실호출/엔진 준비</small><b>${live}개</b></div><div><small>키·승인·매핑 대기</small><b>${pending}개</b></div><div><small>현재 화면 수치</small><b>합성 프리뷰</b></div></div><div style="margin-top:20px">${sourceReadinessTable()}</div><section class="panel" style="margin-top:20px"><h2>자동 업데이트 파이프라인</h2><div class="pipeline"><span>공식 포털 메타데이터</span><i>→</i><span>인증/승인 확인</span><i>→</i><span>API 실호출</span><i>→</i><span>Snapshot</span><i>→</i><span>검증</span><i>→</i><span>페이지 전환</span></div><p class="panel-sub">GitHub Actions가 소스 상태를 주기적으로 확인하며, 인증키가 없을 때는 작업을 실패시키지 않고 KEY_REQUIRED 상태를 유지합니다.</p></section></div></div>`;
};

globalThis.dataQualityPage=function(){
 setTitle('데이터 품질 대시보드');
 const st=globalThis.SOURCE_STATUS||{sources:[]};
 const metaOk=st.sources.filter(s=>['METADATA_VERIFIED','PORTAL_VERIFIED','READY'].includes(s.availability)).length;
 const liveOk=st.sources.filter(s=>['LIVE_VERIFIED','READY'].includes(s.live)).length;
 const errors=st.sources.filter(s=>String(s.live||s.availability).includes('ERROR')||String(s.availability).includes('UNAVAILABLE')).length;
 return `<div class="page"><section class="page-hero"><div class="shell">${crumb([{label:'데이터 품질'}])}<div class="page-head"><div><span class="eyebrow">QUALITY CONTROL</span><h1>데이터 품질 대시보드</h1><p>소스 준비상태와 페이지용 파생지표 품질을 같은 화면에서 확인합니다.</p></div></div></div></section><div class="shell content-wrap">${previewNotice()}<div class="summary-grid"><div class="summary-card"><span>메타데이터 확인</span><b>${metaOk}/${st.sources.length}</b><small>공식 포털/자체 엔진</small></div><div class="summary-card"><span>실호출·엔진 준비</span><b>${liveOk}</b><small>실데이터 승격 가능 단계</small></div><div class="summary-card"><span>소스 오류</span><b class="${errors?'negative':'positive'}">${errors}</b><small>오류는 공식값 승격 차단</small></div><div class="summary-card"><span>색인 상태</span><b>0</b><small>전체 noindex 유지</small></div></div><div style="margin-top:20px">${sourceReadinessTable()}</div><div class="quality-grid" style="margin-top:20px"><section class="panel"><h2>승격 전 필수 검증</h2><div class="check-list"><div><span>✓</span><p><b>응답 스키마</b> totalCount·items·필수 식별자 검증</p></div><div><span>✓</span><p><b>누락값</b> null을 0으로 치환하지 않음</p></div><div><span>✓</span><p><b>이상치</b> 점포수·비용 급변을 자동 공개하지 않음</p></div><div><span>✓</span><p><b>기준일</b> Snapshot 기준일과 소스 확인일을 별도 보존</p></div><div><span>✓</span><p><b>라이선스</b> 소스별 이용조건을 레코드와 함께 기록</p></div></div></section><section class="panel"><h2>현재 콘텐츠 커버리지</h2><div class="fact-list"><div class="fact-row"><span>업종</span><b>${Object.keys(categories).length}개</b></div><div class="fact-row"><span>브랜드 프리뷰</span><b>${brands.length}개</b></div><div class="fact-row"><span>지역 프리뷰</span><b>${areas.length}곳</b></div><div class="fact-row"><span>가이드</span><b>${guides.length}개</b></div></div><p class="panel-sub">이 커버리지는 UI·정보구조 검수 범위이며 공식 데이터 커버리지와 동일하다는 뜻이 아닙니다.</p></section></div></div></div>`;
};
