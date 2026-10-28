import {MILEAGE_FIELDS} from '../assets/annual-mileage.js';

const input=(key,label,value='',help='')=>{
  const field=MILEAGE_FIELDS[key];
  return `<label for="${field.id}">${label}<input id="${field.id}" name="${field.id}" type="number" inputmode="decimal" min="0" max="${field.max}" step="any" value="${value}" required${help?` aria-describedby="${help}"`:''}></label>`;
};

export function renderAnnualMileagePlanner(){
  return `<section class="db-section annual-mileage" data-annual-mileage aria-label="연간 주행거리 계산"><div class="db-shell"><div class="mileage-grid">
<form id="mileage_form" class="tool-panel" aria-labelledby="mileage_title"><h2 id="mileage_title">운행 조건</h2><div class="utility-fields">
${input('oneWayKm','편도 출퇴근 거리 (km)','','mileage_commute_help')}
${input('monthlyDays','월평균 출근일 (일)','','mileage_commute_help')}
<p class="notice mileage-wide" id="mileage_commute_help">편도 거리를 왕복으로 환산합니다. 출퇴근 운행이 없으면 두 값에 0을 입력하세요.</p>
${input('weekendKm','주말 주행거리 (km/주)','0','mileage_weekend_help')}
<p class="notice mileage-wide" id="mileage_weekend_help">토·일 합계입니다. 출퇴근 거리와 겹치지 않게 입력하세요.</p>
${input('extraAnnualKm','그 밖의 연간 주행거리 (km)','0','mileage_extra_help')}
<p class="notice mileage-wide" id="mileage_extra_help">휴가·명절 등 추가 운행입니다. 이미 입력한 출퇴근·주말 거리는 다시 더하지 마세요.</p>
</div><div class="mileage-actions"><button class="utility-button" type="submit">계산하기</button><button id="mileage_example" class="mileage-example" type="button">예시 적용</button></div></form>
<div class="tool-panel utility-result" data-mileage-result-panel><h2>연간 예상 주행거리</h2><p id="mileage_status" class="notice" role="status" aria-live="polite" aria-atomic="true">운행 조건을 입력하세요.</p>
<div id="mileage_result" hidden><output id="mileage_annual" aria-live="off"></output><dl><div><dt>월평균</dt><dd id="mileage_monthly"></dd></div><div><dt>연간 출퇴근</dt><dd id="mileage_commute"></dd></div><div><dt>연간 주말 운행</dt><dd id="mileage_weekend_total"></dd></div><div><dt>그 밖의 연간 운행</dt><dd id="mileage_extra_total"></dd></div></dl></div>
<p class="notice">월평균 출근일 × 12개월, 주말 거리 × 52주로 계산한 예상치입니다.</p><p class="notice" id="mileage_transfer_note">비용 계산기에는 1km 단위로 반올림한 거리를 전달합니다.</p>
<nav class="mileage-handoffs" aria-label="예상 거리로 비용 계산"><a data-mileage-handoff="annual" href="../../tools/annual-cost/">자동차세·연료·충전비 계산</a><a data-mileage-handoff="fuel" href="../../tools/fuel-cost/">유류비 계산</a><a data-mileage-handoff="electric" href="../../tools/ev-charge-cost/">전기차 충전비 계산</a></nav>
<button class="mileage-example" id="mileage_copy" type="button" disabled>현재 조건 링크 복사</button><p class="notice" id="mileage_share_status" role="status"></p></div>
</div><noscript><p class="notice">입력 계산과 조건 공유에는 자바스크립트가 필요합니다. 연간 거리 = 편도 출퇴근 거리 × 2 × 월평균 출근일 × 12 + 주말 거리 × 52 + 그 밖의 연간 거리입니다. 비용 도구는 링크에서 직접 열 수 있습니다.</p></noscript></div></section>`;
}
