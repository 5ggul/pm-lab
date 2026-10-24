export function renderCarInstallmentPage() {
  return {
    schemaType: 'WebPage',
    title: '자동차 할부 계산기',
    description: '대출 원금과 견적 연금리·기간을 입력해 원리금균등·원금균등의 월 납입금, 총이자와 월별 상환표를 확인하세요.',
    content: `<section class="db-section car-installment"><div class="db-shell"><div class="utility-grid"><form id="carInstallmentForm" class="tool-panel" novalidate><h2>할부 조건</h2><div class="utility-fields"><label for="loanPrincipal">대출 원금 (원)<input id="loanPrincipal" name="loan_principal" type="number" min="0" max="1000000000000" step="1" inputmode="numeric" placeholder="예: 30000000" aria-describedby="loanPrincipalHelp loanError" required></label><p id="loanPrincipalHelp" class="notice">차량 가격 전체가 아닌 실제로 빌리는 금액을 입력하세요. 0원부터 1조 원까지 계산합니다.</p><label for="loanAnnualRate">견적 연금리 (%)<input id="loanAnnualRate" name="loan_rate" type="number" min="0" max="100" step="any" inputmode="decimal" placeholder="견적서의 연금리 입력" aria-describedby="loanRateHelp loanError" required></label><p id="loanRateHelp" class="notice">금리는 자동으로 채우지 않습니다. 받은 견적의 고정 연금리를 입력하세요. 0%도 계산할 수 있습니다.</p><label for="loanMonths">상환 기간 (개월)<input id="loanMonths" name="loan_months" type="number" min="1" max="600" step="1" value="36" inputmode="numeric" aria-describedby="loanError" required></label><label for="loanMethod">상환 방식<select id="loanMethod" name="loan_method" aria-describedby="loanError"><option value="equal-payment">원리금균등</option><option value="equal-principal">원금균등</option></select></label></div><p id="loanError" class="notice" role="alert" hidden></p><button class="utility-button" type="submit">상환금 계산하기</button></form><div class="tool-panel utility-result" aria-live="polite"><h2>예상 상환금</h2><p>첫 달 납입금</p><output id="loanPayment">대출 조건을 입력하세요</output><p id="loanStatus" class="notice">원금·견적 연금리·기간을 입력한 뒤 계산하세요.</p><dl id="loanMetrics" class="installment-metrics" hidden><div><dt>마지막 달 납입금</dt><dd id="loanLastPayment"></dd></div><div><dt>총이자</dt><dd id="loanTotalInterest"></dd></div><div><dt>총납입금 (원금 + 이자)</dt><dd id="loanTotalPayment"></dd></div></dl><p class="notice">고정 연금리를 12로 나눈 월 이율을 적용한 예상치입니다. 실제 계약일에 따른 일수 계산·수수료·중도상환·거치기간은 반영하지 않습니다. 원 단위 반올림에 따라 월별 금액에 소액 차이가 날 수 있습니다.</p></div></div><details id="loanSchedule" class="installment-schedule" hidden><summary>월별 상환표 보기</summary><div class="installment-table-scroll" role="region" aria-label="월별 원금·이자·잔액 상환표" tabindex="0"><table><caption>월별 상환 원금·이자·납입금·남은 원금</caption><thead><tr><th scope="col">회차</th><th scope="col">상환 원금</th><th scope="col">이자</th><th scope="col">납입금</th><th scope="col">남은 원금</th></tr></thead><tbody id="loanScheduleBody"></tbody></table></div></details></div></section><section class="db-section" data-reviewed-tool="car-installment"><div class="db-shell"><div class="utility-reading"><h2>계산식과 예시</h2>
<p data-calculation-formula="monthly-rate">월 이율 = 견적 연금리(%) ÷ 100 ÷ 12입니다.</p>
<p data-calculation-formula="equal-payment">원리금균등 월 상환액 = 원금 × 월 이율 ÷ [1 − (1 + 월 이율)<sup>−개월 수</sup>]. 연금리가 0%이면 원금을 개월 수로 나눕니다.</p>
<p data-calculation-formula="equal-principal">원금균등은 매월 원금 ÷ 개월 수를 갚고, 월초 남은 원금 × 월 이율을 이자로 더합니다.</p>
<h3>3,000만원 · 연 5% · 36개월 예시</h3>
<p data-calculation-example="equal-payment">원리금균등: 첫 달 <strong>899,127원</strong>, 총이자 <strong>2,368,569원</strong>, 총납입금 <strong>32,368,569원</strong>입니다.</p>
<p data-calculation-example="equal-principal">원금균등: 첫 달 <strong>958,333원</strong>, 마지막 달 <strong>836,805원</strong>, 총이자 <strong>2,312,500원</strong>입니다.</p>
<p class="notice" data-calculation-limits="installment">연 5%는 계산 예시이며 현재 금융상품의 금리가 아닙니다. 고정 연금리·매월 상환·원 단위 반올림 기준이며 수수료·거치기간·중도상환은 제외합니다.</p>
<nav class="utility-links" aria-label="관련 차량 비용 계산"><a href="../car-tax/">자동차세 계산</a><a href="../annual-cost/">연료·충전비 계산</a><a href="../../methodology/">계산 범위와 기준</a></nav>
</div></div></section>`,
    faqs: [
      ['원리금균등과 원금균등은 어떻게 다른가요?', '원리금균등은 원금과 이자를 합친 월 상환액이 일정하도록 계산합니다. 원금균등은 매월 갚는 원금을 같게 나누고 남은 원금에 이자를 붙여 계산합니다. 표시 금액은 원 단위 반올림으로 소액 차이가 날 수 있습니다.'],
      ['연금리는 어떤 값을 입력하나요?', '할부·대출 견적서에 적힌 고정 연금리를 입력하세요. 이 도구는 현재 판매 중인 금융상품의 금리를 조회하거나 특정 상품을 추천하지 않습니다.'],
      ['0% 금리나 0원 원금도 계산하나요?', '0% 금리는 이자 없이 원금을 기간별로 나눕니다. 원금이 0원이면 상환할 차입금과 이자가 없다고 표시합니다.'],
      ['실제 계약 상환표와 왜 다를 수 있나요?', '이 계산은 매월 같은 간격으로 상환한다고 가정합니다. 계약일별 일수, 취급 수수료, 중도상환 수수료, 거치기간과 금융사의 금액 처리 방식에 따라 실제 납입액은 달라질 수 있습니다. 보험료·연료비 등 차량 운영비는 상환금에 포함하지 않습니다.']
    ],
    scripts: [{src: 'car-installment.js', type: 'module'}]
  };
}
