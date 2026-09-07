// Keep the initial HTML and the interactive calculator on the same price snapshot.
export function updateStaticCosts(html,car,catalog){
  const money=n=>n==null?'단가 입력':Math.round(n).toLocaleString('ko-KR')+'원';
  const text=(id,value)=>{html=html.replace(new RegExp(`(<[a-z][^>]*\\bid="${id}"[^>]*>)[^<]*(<\\/[a-z][^>]*>)`,'i'),(_,a,b)=>a+value+b);};
  const p=car.rep.fuelType==='diesel'?catalog.dieselPrice:car.rep.fuelType==='lpg'?catalog.lpgPrice:car.energy==='ev'?null:catalog.gasPrice;
  const energy=p==null?null:Math.round(catalog.annualKm/car.rep.combined*p),total=energy==null?null:car.rep.tax+energy;
  text('energyValue',money(energy));text('totalValue',money(total));
  html=html.replace(/(<b[^>]*data-field="annual-total"[^>]*>)[^<]*(<\/b>)/g,(_,a,b)=>a+money(total)+b);
  if(car.id==='grandeur-gn7'){
    for(const id of ['mFuel','fuelTotal','cGasFuel'])text(id,money(energy));
    for(const id of ['mTotal','totalCost','cGasTotal'])text(id,money(total));
    text('answerFuel',energy==null?'단가 입력':energy.toLocaleString('ko-KR'));
    text('fuelPriceView',Math.round(p).toLocaleString('ko-KR')+'원/L');
    text('fuelSource',`오피넷 휘발유 전국 평균 · ${catalog.fuelPriceAsOf}${catalog.fuelPriceStale?' · 갱신 지연':''}`);
    html=html.replace(/(<input[^>]*id="fuelPrice"[^>]*value=")[^"]*(")/,(_,a,b)=>a+p+b);
    const hev=car.variants.find(v=>v.id==='gn7-hev16-2wd-18');
    if(hev){const hevEnergy=Math.round(catalog.annualKm/hev.combined*catalog.gasPrice),hevTax=Math.round(hev.cc*(hev.cc<=1000?80:hev.cc<=1600?140:200)*1.3);text('cHevFuel',money(hevEnergy));text('cHevTotal',money(hevTax+hevEnergy));text('cDiff',money(total-hevTax-hevEnergy));}
  }
  return html;
}
