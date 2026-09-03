(function(){
const C=window.CAR_CATALOG;if(!C)return;const id=document.body.dataset.car;const car=C.byId[id];if(!car)return;let selected=0;
const $=s=>document.querySelector(s),fmt=n=>Number(n).toLocaleString('ko-KR');
function variant(){return car.variants[selected]||car.variants[0]||car.rep}
function priceFor(v){return v.fuel==='lpg'?C.lpgPrice:v.fuel==='gas'?C.gasPrice:null}
function tax(v){if(v.fuel==='electric')return 130000;return C.taxForCc(v.cc)}
function cost(v){const km=Number($('#annualKm')?.value||20000);let price=Number($('#energyPrice')?.value||0);if(v.fuel!=='electric'&&!price)price=priceFor(v);if(v.fuel==='electric'&&!price)return null;return C.energyCost(v,km,price)}
function update(){const v=variant();document.querySelectorAll('[data-variant-index]').forEach((b,i)=>b.classList.toggle('active',i===selected));
const effUnit=v.fuel==='electric'?'km/kWh':'km/L';const e=cost(v),t=tax(v),total=e==null?null:t+e;
const set=(sel,val)=>{const el=$(sel);if(el)el.textContent=val};set('#selectedLabel',v.label);set('#effValue',v.combined+' '+effUnit);set('#taxValue',fmt(t)+'원');set('#energyValue',e==null?'충전단가 입력':fmt(e)+'원');set('#totalValue',total==null?'충전단가 입력':fmt(total)+'원');set('#cityValue',v.city?String(v.city)+' '+effUnit:'사양표 참조');set('#highwayValue',v.highway?String(v.highway)+' '+effUnit:'사양표 참조');set('#rangeValue',v.range?fmt(v.range)+' km':'해당 없음');set('#ccValue',v.cc?fmt(v.cc)+' cc':'전기차');
const km=Number($('#annualKm')?.value||20000);set('#assumptionLine',v.fuel==='electric'?`연 ${fmt(km)}km · 충전단가 사용자 입력`:`연 ${fmt(km)}km · ${v.fuel==='lpg'?'LPG':'휘발유'} ${fmt(Number($('#energyPrice')?.value||priceFor(v)))}원/L`);
}
function renderButtons(){const box=$('#variantButtons');if(!box)return;box.innerHTML=car.variants.map((v,i)=>`<button class="chip${i===0?' active':''}" data-variant-index="${i}" type="button">${v.label}</button>`).join('');box.addEventListener('click',e=>{const b=e.target.closest('[data-variant-index]');if(!b)return;selected=Number(b.dataset.variantIndex);const v=variant();const p=$('#energyPrice');if(p){if(v.fuel==='electric'){p.value='';p.placeholder='예: 320';p.removeAttribute('readonly')}else{p.value=String(priceFor(v));p.placeholder='';}}update()})}
renderButtons();const ep=$('#energyPrice');if(ep){const v=variant();if(v.fuel==='electric'){ep.value='';ep.placeholder='예: 320'}else ep.value=String(priceFor(v));ep.addEventListener('input',update)}$('#annualKm')?.addEventListener('change',update);update();
})();
