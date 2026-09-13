// Keep the initial HTML and the interactive calculator on the same price snapshot.
export function updateStaticCosts(html,car,catalog){
  const money=n=>n==null?'단가 입력':Math.round(n).toLocaleString('ko-KR')+'원';
  const exactPrice=n=>Number(n).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})+'원/L';
  const text=(id,value)=>{html=html.replace(new RegExp(`(<[a-z][^>]*\\bid="${id}"[^>]*>)[^<]*(<\\/[a-z][^>]*>)`,'i'),(_,a,b)=>a+value+b);};
  const p=car.rep.fuelType==='diesel'?catalog.dieselPrice:car.rep.fuelType==='lpg'?catalog.lpgPrice:car.energy==='ev'?null:catalog.gasPrice;
  const energy=p==null?null:Math.round(catalog.annualKm/car.rep.combined*p),total=energy==null?null:car.rep.tax+energy;
  text('energyValue',money(energy));text('totalValue',money(total));
  html=html.replace(/(<b[^>]*data-field="annual-total"[^>]*>)[^<]*(<\/b>)/g,(_,a,b)=>a+money(total)+b);
  html=html.replace(/(<div class="model-metric"><small>세금\+(?:유류비|충전비|에너지비)<\/small><b[^>]*>)[^<]*(<\/b>)/g,(_,a,b)=>a+money(total)+b);
  if(p!=null){
    const priceName=car.rep.fuelType==='diesel'?'경유':car.rep.fuelType==='lpg'?'LPG':'휘발유';
    text('assumptionLine',`연 ${catalog.annualKm.toLocaleString('ko-KR')}km · ${priceName} ${Number(p).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})}원/L`);
    html=html.replace(/(<input[^>]*id="energyPrice"[^>]*)(>)/i,(whole,attrs,end)=>/\bvalue=/.test(attrs)?whole:`${attrs} value="${p}"${end}`);
  }
  if(html.includes('model-lite-answer')){
    const answer=car.energy==='ev'
      ?`${car.rep.label} 기준 복합전비는 <strong>${car.rep.combined}km/kWh</strong>${car.rep.range?`, 1회 충전 주행거리는 <strong>${Number(car.rep.range).toLocaleString('ko-KR')}km</strong>`:''}, 연간 정상 자동차세는 <strong>${money(car.rep.tax)}</strong>입니다.`
      :`${car.rep.label} 기준 복합연비는 <strong>${car.rep.combined}km/L</strong>, 신차 기준 연간 정상 자동차세는 <strong>${money(car.rep.tax)}</strong>, 연 ${catalog.annualKm.toLocaleString('ko-KR')}km 유류비는 약 <strong>${money(energy)}</strong>입니다.`;
    html=html.replace(/(<p class="model-lite-answer"[^>]*>)[\s\S]*?(<\/p>)/,(_,a,b)=>a+answer+b);
  }
  if(car.id==='grandeur-gn7'){
    for(const id of ['mFuel','fuelTotal','cGasFuel'])text(id,money(energy));
    for(const id of ['mTotal','totalCost','cGasTotal'])text(id,money(total));
    text('answerFuel',energy==null?'단가 입력':energy.toLocaleString('ko-KR'));
    text('fuelPriceView',exactPrice(p));
    text('fuelSource',`오피넷 휘발유 전국 평균 · ${catalog.fuelPriceAsOf}${catalog.fuelPriceStale?' · 갱신 지연':''}`);
    html=html.replace(/(<input[^>]*id="fuelPrice"[^>]*value=")[^"]*(")/,(_,a,b)=>a+p+b);
    const hev=car.variants.find(v=>v.id==='gn7-hev16-2wd-18');
    if(hev){const hevEnergy=Math.round(catalog.annualKm/hev.combined*catalog.gasPrice),hevTax=Math.round(hev.cc*(hev.cc<=1000?80:hev.cc<=1600?140:200)*1.3);text('cHevFuel',money(hevEnergy));text('cHevTotal',money(hevTax+hevEnergy));text('cDiff',money(total-hevTax-hevEnergy));}
  }
  return html;
}
