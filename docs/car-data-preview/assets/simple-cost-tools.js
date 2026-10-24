(function(){
  const form=document.querySelector('#simpleCostForm');if(!form)return;
  const field=id=>document.getElementById(id),kind=form.dataset.kind,math=CAR_COST_MATH;
  const money=n=>Math.round(n).toLocaleString('ko-KR')+'원';
  const number=id=>{const raw=String(field(id).value).trim();return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)?Number(raw):NaN;};
  const query=new URLSearchParams(location.search);
  const restoreNumber=(id,min,max)=>{
    if(!query.has(id))return false;
    const raw=query.get(id),value=raw.trim()===''?NaN:Number(raw);
    const nonzeroUnderflow=id==='unitPrice'&&value===0&&/[1-9]/.test(raw.split(/[eE]/)[0]);
    const invalidPriceSyntax=id==='unitPrice'&&(value>0&&value<0.000001||!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim()));
    if(!Number.isFinite(value)||value<min||value>max||nonzeroUnderflow||invalidPriceSyntax){field(id).value='';return false;}
    field(id).value=String(value);return true;
  };
  if(kind==='car-tax'){
    if(query.has('taxFuel'))field('taxFuel').value=['engine','electric'].includes(query.get('taxFuel'))?query.get('taxFuel'):'';
    restoreNumber('cc',1,100000);
    if(query.has('registration'))field('registration').value=/^\d{4}-(0[1-9]|1[0-2])$/.test(query.get('registration')||'')&&query.get('registration')>='1900-01'&&query.get('registration')<=`${form.dataset.taxYear}-12`?query.get('registration'):'';
  }else{
    if(kind==='fuel-cost'&&query.has('fuel'))field('fuel').value=['gasoline','diesel','lpg'].includes(query.get('fuel'))?query.get('fuel'):'';
    restoreNumber('distance',0,10000000);restoreNumber('efficiency',0.000001,10000);
  }
  const suppliedPrice=kind!=='car-tax'&&query.has('unitPrice');
  const restoredPrice=suppliedPrice&&restoreNumber('unitPrice',0,10000000);
  function syncUrl(){
    try{
      const url=new URL(location.href),ids=kind==='car-tax'?['taxFuel','cc','registration']:kind==='fuel-cost'?['distance','efficiency','unitPrice','fuel']:['distance','efficiency','unitPrice'];
      for(const id of ids){const value=field(id).value.trim();if(value)url.searchParams.set(id,value);else url.searchParams.delete(id);}
      history.replaceState(history.state,'',url);
    }catch{/* Calculation remains usable when history is unavailable. */}
  }
  function render(){
    const output=field('costResult'),note=field('costBreakdown');
    if(kind==='car-tax'){
      if(!['engine','electric'].includes(field('taxFuel').value)){field('cc').disabled=false;field('registration').disabled=false;output.textContent='입력값을 확인하세요';note.textContent='차량 유형을 다시 선택하세요.';return;}
      const electric=field('taxFuel').value==='electric';field('cc').disabled=electric;field('registration').disabled=electric;
      const tax=math.roundedTax(math.annualTax(number('cc'),electric,field('registration').value,Number(form.dataset.taxYear)));
      output.textContent=tax?money(tax.total):'입력값을 확인하세요';
      note.textContent=tax?`자동차세 ${money(tax.auto)} + 지방교육세 ${money(tax.education)} · 차령 경감 ${(tax.discount*100).toLocaleString('ko-KR',{maximumFractionDigits:1})}%`:'배기량과 차령기산 참고월을 입력하세요.';
    }else{
      if(kind==='fuel-cost'&&!['gasoline','diesel','lpg'].includes(field('fuel').value)){output.textContent='연료 종류를 선택하세요';note.textContent='휘발유·경유·LPG 중 계산할 연료를 다시 선택하세요.';return;}
      const distance=number('distance'),efficiency=number('efficiency'),price=number('unitPrice');
      const explicitZero=price===0&&!/[1-9]/.test(String(field('unitPrice').value).split(/[eE]/)[0]);
      const valid=[distance,efficiency,price].every(Number.isFinite)&&distance>=0&&distance<=10000000&&efficiency>=0.000001&&efficiency<=10000&&(price===0||price>=0.000001)&&price<=10000000;
      // Free travel is an explicit simple-tool input, never a national-price
      // fallback or a change to the shared official cost calculation policy.
      const cost=!valid?null:price===0?(explicitZero?0:null):math.energyCost(distance,efficiency,price);
      output.textContent=cost==null?'거리·효율·단가를 입력하세요':money(cost);
      note.textContent=cost==null?'거리는 0 이상, 연비·전비는 0 초과, 단가는 0 이상인 값을 입력 범위 안에서 입력하세요.':`${number('distance').toLocaleString('ko-KR')}km ÷ ${number('efficiency')} ${kind==='fuel-cost'?'km/L':'km/kWh'} × ${number('unitPrice').toLocaleString('ko-KR')} ${kind==='fuel-cost'?'원/L':'원/kWh'}`;
    }
  }
  form.addEventListener('submit',e=>{e.preventDefault();render();syncUrl();});form.addEventListener('input',()=>{render();syncUrl();});form.addEventListener('change',()=>{render();syncUrl();});
  if(kind==='fuel-cost'){
    let prices=null,manual=suppliedPrice;
    if(manual)field('priceOrigin').textContent=restoredPrice?'전달받은 단가로 계산합니다. 직접 바꿀 수 있습니다.':'주소의 단가가 올바르지 않습니다. 연료가격을 직접 입력하세요.';
    field('unitPrice').addEventListener('input',()=>{manual=true;field('priceOrigin').textContent='직접 입력한 단가로 계산합니다.';});
    function applyPrice(){
      const value=prices?.[field('fuel').value];field('unitPrice').value=Number.isFinite(value)&&value>0?value:'';
      field('priceOrigin').textContent=value?'전국 평균을 기본값으로 사용합니다. 실제 주유할 가격으로 바꿀 수 있습니다.':'연료가격을 직접 입력하세요.';render();syncUrl();
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
