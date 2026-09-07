(function(){
  function refresh(){document.querySelectorAll('[data-fuel-status]').forEach(el=>{
    const date=el.dataset.priceDate,stamp=Date.parse(date+'T00:00:00+09:00');
    const delayed=el.dataset.priceStale==='true'||!Number.isFinite(stamp)||stamp>Date.now()||Date.now()-stamp>3*86400000;
    el.classList.toggle('is-delayed',delayed);
    el.textContent=date?(delayed?`유가 갱신 지연 · ${date} 마지막 수집 가격`:`오피넷 전국 평균 · ${date} 기준`):'유가를 불러오지 못했습니다. 연료가격을 직접 입력하세요.';
  });}
  refresh(); document.addEventListener('visibilitychange',refresh);
})();
