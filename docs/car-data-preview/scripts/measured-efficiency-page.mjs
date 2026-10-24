import {MEASURED_LIMITS} from '../assets/measured-efficiency.js';

export function renderMeasuredEfficiencyPage() {
  return {
    schemaType: 'WebPage',
    title: '실연비 계산기',
    description: '실제 주행거리와 주유량으로 내 차의 연비를 계산하세요. 전기차는 같은 구간의 사용 전력량으로 전비를 구할 수 있습니다.',
    content: `<section class="db-section"><div class="db-shell"><div class="utility-grid">
<form id="measuredEfficiencyForm" class="tool-panel" novalidate><h2>측정 기록</h2><div class="utility-fields">
<label for="measuredMode">기록 종류<select id="measuredMode" name="measured_mode"><option value="fuel">주유 기록 · 연비</option><option value="electric">전기 사용 기록 · 전비</option></select></label>
<label id="measuredFuelField" for="measuredFuel">연료<select id="measuredFuel" name="measured_fuel"><option value="gasoline">휘발유</option><option value="diesel">경유</option><option value="lpg">LPG</option></select></label>
<label for="measuredDistance">주행거리 (km)<input id="measuredDistance" name="measured_distance" type="number" min="0.000001" max="${MEASURED_LIMITS.distance}" step="any" inputmode="decimal" required></label>
<label for="measuredQuantity"><span id="measuredQuantityLabel">같은 구간의 주유량 (L)</span><input id="measuredQuantity" name="measured_quantity" type="number" min="0.000001" max="${MEASURED_LIMITS.quantity}" step="any" inputmode="decimal" aria-describedby="measuredRecordHint" required></label>
<label for="measuredPrice"><span id="measuredPriceLabel">실제 주유단가 (원/L, 선택)</span><input id="measuredPrice" name="measured_price" type="number" min="0" max="${MEASURED_LIMITS.price}" step="any" inputmode="decimal"></label>
<p id="measuredRecordHint" class="notice">가득 주유 후 다음 가득 주유까지의 거리와, 두 번째 주유량을 입력하세요.</p>
</div><button type="submit" class="utility-button">계산하기</button></form>
<div class="tool-panel utility-result"><h2 id="measuredResultHeading">내 기록의 실연비</h2><output id="measuredEfficiencyValue" aria-live="polite">—</output><p id="measuredBreakdown">거리와 사용량을 입력하면 결과가 표시됩니다.</p>
<div id="measuredCostRows" class="rows" hidden><div class="row"><span>100km당 비용</span><strong id="measuredCostPer100">—</strong></div><div class="row"><span>기록 구간의 비용</span><strong id="measuredRecordCost">—</strong></div></div>
<p id="measuredStatus" class="notice" role="status">같은 구간의 주행거리와 사용량을 입력하세요.</p><p class="notice">내가 측정한 기록이며 공인연비·전비가 아닙니다. 공식 사양과 비교할 때는 측정 조건의 차이를 확인하세요.</p>
<a id="measuredCostLink" class="utility-button" style="display:inline-flex;align-items:center;text-decoration:none" hidden>이 연비로 유류비 계산</a>
<noscript><p class="notice">계산에는 자바스크립트가 필요합니다. 실연비 = 주행거리(km) ÷ 주유량(L), 실전비 = 주행거리(km) ÷ 사용 전력량(kWh)입니다.</p></noscript>
</div></div></div></section><section class="db-section" data-reviewed-tool="fuel-efficiency"><div class="db-shell"><div class="utility-reading"><h2>계산식과 예시</h2>
<p data-calculation-formula="measured">실연비 = 주행거리(km) ÷ 주유량(L). 실전비 = 주행거리(km) ÷ 사용 전력량(kWh)입니다.</p>
<p data-calculation-example="fuel">600km를 주행하고 40L를 주유했다면 <strong>15 km/L</strong>입니다. 주유단가가 1,800원/L라면 100km당 <strong>12,000원</strong>입니다.</p>
<p data-calculation-example="electric">600km에 120kWh를 사용했다면 <strong>5 km/kWh</strong>입니다. 단가가 300원/kWh라면 기록 구간의 전력요금은 <strong>36,000원</strong>입니다.</p>
<p class="notice" data-calculation-limits="measured">같은 구간의 거리와 사용량을 비교한 예시입니다. 배터리 잔량·충전 손실이 섞인 기록은 계기판 전비와 다를 수 있습니다. 공인연비·전비나 차량의 전체 유지비를 뜻하지 않습니다.</p>
<nav class="utility-links" aria-label="관련 계산과 기준"><a href="../fuel-cost/">유류비 계산</a><a href="../ev-charge-cost/">충전비 계산</a><a href="../../guide/official-efficiency/">공인연비와 측정 조건</a></nav>
</div></div></section>`,
    faqs: [
      ['주유량은 언제 넣은 양인가요?', '가득 주유한 뒤 주행거리를 기록하고, 다음에 다시 가득 주유할 때 넣은 양을 사용하세요. 처음 주유한 양과 그 이후의 거리를 바로 나누면 실제 사용량과 맞지 않을 수 있습니다.'],
      ['전기차 충전량은 무엇을 쓰나요?', '주행거리와 같은 기록 구간의 사용 전력량을 넣으세요. 결제한 충전량을 사용하면 충전 손실이나 배터리 잔량 차이가 포함될 수 있어 차량 계기판 전비와 다를 수 있습니다.'],
      ['단가를 비워도 계산되나요?', '연비·전비는 거리와 사용량만으로 계산됩니다. 실제 단가를 입력한 경우에만 100km당 비용과 기록 구간의 비용을 계산합니다. 무료 주유·충전은 0을 직접 입력하세요.'],
      ['공인연비와 직접 비교해도 되나요?', '공인연비·전비는 정해진 시험 조건에서 측정한 값입니다. 이 결과는 개인의 주행·급유 기록이므로 교통, 기온, 적재, 주행 습관 등의 영향을 함께 고려하세요.']
    ],
    scripts: [{src: 'measured-efficiency.js', type: 'module'}]
  };
}
