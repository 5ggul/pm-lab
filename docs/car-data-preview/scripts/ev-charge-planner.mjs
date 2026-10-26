import {CHARGE_PLANNER_FIELDS} from '../assets/ev-charge-planner.js';

const input = (key, label, attributes = '') => {
  const {id, max} = CHARGE_PLANNER_FIELDS[key];
  return `<label for="${id}">${label}<input id="${id}" name="${id}" type="number" inputmode="decimal" min="0" max="${max}" step="any" required ${attributes}></label>`;
};

// A fragment for the existing EV charging tool. Its original form, inputs,
// calculator output and script wiring remain owned by the page builder.
export function renderEvChargePlanner() {
  return `<section class="db-section ev-charge-planner" data-ev-charge-planner aria-labelledby="charge_planner_title"><div class="db-shell">
<h2 id="charge_planner_title">충전량과 충전 방식으로 계산</h2>
<p class="notice">충전량을 알고 있다면 1회 요금을, 급속과 완속을 함께 쓴다면 월·연간 충전비를 계산하세요. 단가는 자동으로 채우지 않습니다.</p>
<div class="utility-grid">
<form id="charge_session_form" class="tool-panel" aria-labelledby="charge_session_title"><h3 id="charge_session_title">충전량으로 1회 요금 계산</h3><div class="utility-fields">
${input('sessionKwh', '계량된 충전량 (kWh)', 'aria-describedby="charge_session_help"')}
${input('sessionPrice', '실제 적용 단가 (원/kWh)', 'aria-describedby="charge_zero_price"')}
<p id="charge_session_help" class="notice">충전기 화면·영수증에 표시된 충전 전력량을 입력하세요. 배터리 잔량 증가분이나 배터리 정격용량을 대신 넣는 계산이 아닙니다.</p>
<p id="charge_zero_price" class="notice">무료 충전을 계산하려면 단가에 0을 직접 입력하세요. 빈칸은 0원으로 처리하지 않습니다.</p>
</div><button class="utility-button" type="submit">1회 충전비 계산</button></form>
<div class="tool-panel utility-result"><h3>예상 1회 충전 전력요금</h3><p id="charge_session_status" class="notice" role="status" aria-live="polite" aria-atomic="true">충전량과 단가를 모두 입력하세요.</p><div id="charge_session_result" hidden><output id="charge_session_cost" aria-live="off"></output><p id="charge_session_breakdown"></p></div><p class="notice">계량된 충전량 × 입력 단가입니다. 주차료·점유 요금·회원 구독료·카드 할인 등 별도 항목은 합산하지 않습니다.</p></div>
</div>
<div class="utility-grid">
<form id="charge_mixed_form" class="tool-panel" aria-labelledby="charge_mixed_title"><h3 id="charge_mixed_title">급속·완속을 섞어 쓰는 월·연 충전비</h3><div class="utility-fields">
${input('monthlyKm', '월 주행거리 (km)')}
${input('efficiency', '적용 전비 (km/kWh)', 'aria-describedby="charge_efficiency_help"')}
${input('slowPrice', '완속 적용 단가 (원/kWh)', 'aria-describedby="charge_mixed_price_help"')}
${input('fastPrice', '급속 적용 단가 (원/kWh)', 'aria-describedby="charge_mixed_price_help"')}
${input('fastShare', '급속 충전 전력량 비중 (%)', 'aria-describedby="charge_share_help"')}
<p id="charge_efficiency_help" class="notice">차량의 표시 전비나 직접 기록한 전비를 입력하세요. 월 주행거리 ÷ 전비로 필요한 전력량을 추정하며 충전손실률을 별도로 더하지 않습니다.</p>
<p id="charge_share_help" class="notice">급속 비중은 충전 횟수나 충전 시간이 아닌 kWh 기준입니다. 0%는 모두 완속, 100%는 모두 급속입니다.</p>
<p id="charge_mixed_price_help" class="notice">회원·비회원·로밍·시간대에 따라 달라지는 실제 적용 단가를 각각 입력하세요. 0원은 직접 입력할 수 있습니다. 급속 비중 0%는 완속 단가만, 100%는 급속 단가만 필요합니다.</p>
</div><button class="utility-button" type="submit">혼합 충전비 계산</button></form>
<div class="tool-panel utility-result"><h3>혼합요금 계산 결과</h3><p id="charge_mixed_status" class="notice" role="status" aria-live="polite" aria-atomic="true">월 주행거리·전비·사용 단가·급속 비중을 입력하세요.</p><div id="charge_mixed_result" hidden><dl><div><dt>가중평균 충전단가</dt><dd id="charge_weighted_price"></dd></div><div><dt>월 예상 충전비</dt><dd id="charge_monthly_cost"></dd></div><div><dt>연 예상 충전비</dt><dd id="charge_annual_cost"></dd></div></dl><p id="charge_mixed_breakdown"></p><p class="notice">연 충전비는 반올림 전 월 비용 × 12로 계산한 뒤 원 단위로 표시합니다. 단가와 전력량은 유효숫자 6자리까지 표시합니다.</p></div><p class="notice">차량 구매가격·자동차세·보험·정비·주차료·점유 요금·구독료는 제외합니다. 실제 충전시간은 계산하지 않습니다.</p></div>
</div>
<div class="utility-reading"><button id="charge_copy_link" class="utility-button" type="button" disabled>현재 조건 링크 복사</button><p id="charge_share_status" class="notice" role="status"></p><p class="notice">단가가 바뀌면 다시 입력하세요. 사업자별 안내가는 <a href="https://ev.or.kr/nportal/evcarInfo/initEvcarChargePriceV2.do" rel="noopener noreferrer">무공해차 통합누리집 충전요금 안내</a>에서 확인할 수 있습니다.</p><noscript><p>계산과 조건 링크 복사에는 자바스크립트가 필요합니다. 1회 요금은 충전량(kWh) × 단가, 혼합 단가는 완속 단가 × 완속 비중 + 급속 단가 × 급속 비중입니다.</p></noscript></div>
</div></section>`;
}

export function renderEvChargeNavigation() {
  return '<div class="db-shell"><nav class="charge-tool-nav" aria-label="충전비 계산 방식"><a href="#charge_distance">주행거리</a><a href="#charge_session_form">1회 충전</a><a href="#charge_mixed_form">급속·완속</a></nav></div>';
}

export function renderEvChargeMethod() {
  return `<section class="db-section" data-reviewed-tool="ev-charge-cost"><div class="db-shell utility-reading"><h2>충전비 계산 기준과 예시</h2>
<div class="charge-methods"><article><h3>주행거리 기준</h3><p data-calculation-formula="ev-distance">충전비 = 주행거리(km) ÷ 전비(km/kWh) × 충전단가(원/kWh)</p><p data-calculation-example="ev-distance">20,000 km ÷ 5 km/kWh × 300원/kWh = <strong>1,200,000원</strong></p></article>
<article><h3>계량된 충전량 기준</h3><p data-calculation-formula="ev-session">1회 충전비 = 계량된 충전량(kWh) × 적용 단가(원/kWh)</p><p data-calculation-example="ev-session">50 kWh × 300원/kWh = <strong>15,000원</strong></p></article>
<article><h3>급속·완속 혼합</h3><p data-calculation-formula="ev-mixed">평균 단가 = 완속 단가 × (1 − 급속 전력량 비중) + 급속 단가 × 급속 전력량 비중. 월 충전비 = 월 주행거리 ÷ 전비 × 평균 단가. 연 충전비 = 반올림 전 월 충전비 × 12.</p><p data-calculation-example="ev-mixed">월 1,000 km · 전비 5 km/kWh · 완속 300원/kWh · 급속 450원/kWh · 급속 전력량 비중 30% → 평균 <strong>345원/kWh</strong>, 월 <strong>69,000원</strong>, 연 <strong>828,000원</strong></p></article></div>
<p class="notice" data-calculation-limits="ev-charge">단가와 전비는 계산 예시이며 현재 사업자 요금이 아닙니다. 충전 전력량과 주행거리는 같은 기간으로 맞추세요. 충전손실은 임의로 더하지 않습니다. 전비의 측정 범위와 청구 전력량에 따라 실제 결제액은 달라질 수 있습니다. 자동차세·보험·정비·주차료·점유 요금·구독료·카드 할인은 제외하며 전체 유지비가 아닙니다. 금액은 원 단위로 반올림합니다.</p>
<details><summary>입력 범위</summary><p>1회 충전량 0~100만kWh, 월 거리 0~1,000만km, 전비 0 초과~1만km/kWh, 단가 0~1,000만원/kWh, 급속 비중 0~100%. 계산상 월 전력량은 100만kWh까지입니다. 무료 단가는 0을 직접 입력하며 빈칸이나 유효하지 않은 값은 0원으로 계산하지 않습니다.</p></details>
<div class="utility-links"><a href="../fuel-efficiency/">실제 전비 계산</a><a href="../annual-cost/">자동차세와 충전비 계산</a><a href="../../guide/ev-charging-budget/">급속·완속 계산 예시</a></div>
</div></section>`;
}
