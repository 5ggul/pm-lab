(()=>{
  const init=()=>{
    const main=document.querySelector('main[data-v10-brand="1"]');
    const section=document.querySelector('#official-current-cost.operator-cost');
    if(!main||!section||section.querySelector('[data-v52-total-funnel]'))return;

    const publicCost=document.querySelector('[data-v35-kpi="cost"] strong')?.textContent?.trim()||'공개값 확인';
    const operatorCost=section.querySelector('tbody .num')?.textContent?.trim()||'본사 공개값 확인';
    const exclusions=[...section.querySelectorAll('.operator-excluded li')].map(el=>el.textContent.trim()).filter(Boolean);
    const calc=document.querySelector('.brand-actions a[href*="/tools/startup-cost/"]');
    if(!calc)return;

    section.classList.add('v52-total-funnel-section');
    const panel=document.createElement('div');
    panel.className='v52-total-funnel';
    panel.dataset.v52TotalFunnel='1';
    panel.setAttribute('aria-label','실제 총 준비자금 확인 순서');

    const items=[
      ['공정위 공개비용',publicCost,'정보공개서 기준 공개 합계'],
      ['본사 개설비',operatorCost,'현재 본사 공개 안내와 별도 기준'],
      ['별도 확인',exclusions.length?exclusions.length+'개 항목':'점포별 확인','임대·권리금·별도공사 등']
    ];
    for(const [label,value,note] of items){
      const card=document.createElement('div');card.className='v52-total-funnel-card';
      const span=document.createElement('span');span.textContent=label;
      const strong=document.createElement('strong');strong.textContent=value;
      const small=document.createElement('small');small.textContent=note;
      card.append(span,strong,small);panel.append(card);
    }

    const action=document.createElement('div');action.className='v52-total-funnel-action';
    const copy=document.createElement('div');
    copy.innerHTML='<strong>실제 총 준비자금은 직접 합산</strong><span>임대보증금·권리금·별도공사·초기 운전자금을 입력해 공개비용과 분리해서 확인하세요.</span>';
    const link=document.createElement('a');link.className='button';link.href=calc.href;link.textContent='총 준비자금 계산하기';link.dataset.v52TotalCalculator='1';link.setAttribute('aria-label','이 브랜드 총 준비자금 계산하기');
    action.append(copy,link);panel.append(action);

    const excluded=section.querySelector('.operator-excluded');
    if(excluded)excluded.insertAdjacentElement('afterend',panel);else section.append(panel);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
