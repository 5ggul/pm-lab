(function(){
  const form=document.querySelector('#simpleCostForm');if(!form)return;
  const field=id=>document.getElementById(id),kind=form.dataset.kind,math=CAR_COST_MATH;
  const money=n=>Math.round(n).toLocaleString('ko-KR')+'원';
  const number=id=>field(id).value.trim()===''?NaN:Number(field(id).value);
  function render(){
    const output=field('costResult'),note=field('costBreakdown');
    if(kind==='car-tax'){
      const electric=field('taxFuel').value==='electric';field('cc').disabled=electric;field('registration').disabled=electric;
      const tax=math.annualTax(number('cc'),electric,field('registration').value,Number(form.dataset.taxYear));
      output.textContent=tax?money(tax.total):'입력값을 확인하세요';
      note.textContent=tax?`자동차세 ${money(tax.auto)} + 지방교육세 ${money(tax.education)} · 차령 경감 ${Math.round(tax.discount*100)}%`:'배기량과 차령기산 참고월을 입력하세요.';
    }else{
      const cost=math.energyCost(number('distance'),number('efficiency'),number('unitPrice'));
      output.textContent=cost==null?'거리·효율·단가를 입력하세요':money(cost);
      note.textContent=cost==null?'거리는 0 이상, 연비·전비와 단가는 0보다 큰 값을 입력하세요.':`${number('distance').toLocaleString('ko-KR')}km ÷ ${number('efficiency')} ${kind==='fuel-cost'?'km/L':'km/kWh'} × ${number('unitPrice').toLocaleString('ko-KR')} ${kind==='fuel-cost'?'원/L':'원/kWh'}`;
    }
  }
  form.addEventListener('submit',e=>{e.preventDefault();render();});form.addEventListener('input',render);form.addEventListener('change',render);
  if(kind==='fuel-cost'){
    let prices=null,manual=false;
    field('unitPrice').addEventListener('input',()=>{manual=true;field('priceOrigin').textContent='직접 입력한 단가로 계산합니다.';});
    function applyPrice(){
      const value=prices?.[field('fuel').value];field('unitPrice').value=Number.isFinite(value)&&value>0?value:'';
      field('priceOrigin').textContent=value?'전국 평균을 기본값으로 사용합니다. 실제 주유할 가격으로 바꿀 수 있습니다.':'연료가격을 직접 입력하세요.';render();
    }
    field('fuel').addEventListener('change',()=>{manual=false;applyPrice();});
    const base=new URL('../',document.currentScript.src);
    Promise.all([fetch(new URL('data/fuel-price.json',base),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}),fetch(new URL('data/generated/opinet-status.json',base),{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))]).then(([snapshot,status])=>{
      prices=snapshot.prices;const stamp=Date.parse(snapshot.price_as_of+'T00:00:00+09:00');
      const failed=status.ok===false&&Date.parse(status.checked_at)>=Date.parse(snapshot.last_successful_at||'1970-01-01');
      const stale=snapshot.stale||failed||!Number.isFinite(stamp)||stamp>Date.now()||Date.now()-stamp>3*86400000;
      const state=field('liveFuelStatus');state.textContent=stale?`유가 갱신 지연 · ${snapshot.price_as_of} 마지막 수집 가격`:`오피넷 전국 평균 · ${snapshot.price_as_of} 기준`;state.classList.toggle('is-delayed',!!stale);
      if(!manual)applyPrice();
    }).catch(()=>{field('liveFuelStatus').textContent='유가를 불러오지 못했습니다. 연료가격을 직접 입력하세요.';field('liveFuelStatus').classList.add('is-delayed');});
  }
  render();
})();
