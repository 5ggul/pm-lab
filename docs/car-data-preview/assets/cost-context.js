(function(){
  // Carry explicit calculation inputs in links. Prices are keyed by fuel so
  // a per-litre price can never become a per-kWh charging price.
  const params=new URLSearchParams(location.search),$=s=>document.querySelector(s);
  const keys=['gasoline','diesel','lpg','electric'];
  const distance=()=>$('#annualKm,#pm-distance,#decision-km,#km');
  const priceInput=()=>$('#fuelPrice,#energyPrice,#pm-price,#decision-price,#price');
  function fuel(){
    const pm=$('#pm-data');if(pm){const data=JSON.parse(pm.textContent);const v=data.variants.find(v=>v.id===$('#pm-variant')?.value);return v?.fuel==='hybrid'?'gasoline':v?.fuel;}
    const decision=$('#decision-data');if(decision){const data=JSON.parse(decision.textContent);const p=data.pairs?.find(p=>p.slug===$('#decision-pair')?.value)||data.pairs?.[0];return p?.left?.fuel==='hybrid'?'gasoline':p?.left?.fuel;}
    const spec=$('#specFuel')?.textContent;if(spec)return /LPG/i.test(spec)?'lpg':/경유|디젤/.test(spec)?'diesel':'gasoline';
    const car=window.CAR_CATALOG?.byId?.[document.body.dataset.car];if(car){const v=car.variants.find(v=>v.label===$('#selectedLabel')?.textContent)||car.rep;const k=window.CAR_UTILS?.fuelKey(v);return k==='hybrid'?'gasoline':k;}
    const text=$('#specFuel')?.textContent||$('#priceLabelText')?.textContent||'';
    return /충전|전기/.test(text)?'electric':/LPG/i.test(text)?'lpg':/경유|디젤/.test(text)?'diesel':/휘발유|가솔린/.test(text)?'gasoline':null;
  }
  function valid(value){return String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>0;}
  function carry(url){
    const km=distance()?.value||params.get('km');
    if(valid(km))url.searchParams.set('km',km);else url.searchParams.delete('km');
    for(const k of keys){const value=params.get('cprice_'+k);if(valid(value))url.searchParams.set('cprice_'+k,value);}
    const k=fuel(),input=priceInput();if(k&&input){if(valid(input.value))url.searchParams.set('cprice_'+k,input.value);else url.searchParams.delete('cprice_'+k);}
    for(const [id,k] of [['gas','gasoline'],['diesel','diesel'],['lpg','lpg'],['elec','electric']]){const input=$('#'+id);if(input){if(valid(input.value))url.searchParams.set('cprice_'+k,input.value);else url.searchParams.delete('cprice_'+k);}}
  }
  document.addEventListener('click',event=>{
    const a=event.target.closest('a[href]');if(!a||a.dataset.costReset||a.getAttribute('href').startsWith('#'))return;
    const url=new URL(a.href);if(url.origin!==location.origin||!/(?:\/cars\/|\/compare\/|\/tools\/annual-cost\/)/.test(url.pathname))return;
    carry(url);a.href=url.href;
  },true);
  if(!params.has('km')&&!keys.some(k=>params.has('cprice_'+k)))return;
  let applied=false,observer;
  function apply(){
    if(applied)return;
    const km=distance();if(!km)return;
    if($('#familySearch')&&(!document.documentElement.dataset.costMode||!$('#sourceRow')?.options?.length))return;
    if($('#compareTable')&&!$('#compareTable').textContent.trim())return;
    applied=true;observer?.disconnect();
    if(valid(params.get('km'))){if(km.tagName==='SELECT'&&!Array.from(km.options).some(o=>o.value===params.get('km'))){const o=new Option(Number(params.get('km')).toLocaleString('ko-KR')+' km',params.get('km'));km.add(o);}km.value=params.get('km');km.dispatchEvent(new Event('change',{bubbles:true}));km.dispatchEvent(new Event('input',{bubbles:true}));}
    const k=fuel(),input=priceInput(),value=params.get('cprice_'+k);if(input&&k&&valid(value)){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
    for(const [id,k] of [['gas','gasoline'],['diesel','diesel'],['lpg','lpg'],['elec','electric']]){const input=$('#'+id),value=params.get('cprice_'+k);if(input&&valid(value)){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}}
    const reset=new URL(location.href);reset.searchParams.delete('km');keys.forEach(k=>reset.searchParams.delete('cprice_'+k));
    const a=document.createElement('a');a.href=reset.href;a.textContent='조건 초기화';a.dataset.costReset='true';a.style.cssText='display:inline-flex;align-items:center;min-height:44px;font-size:12px;text-decoration:underline';km.closest('label')?.append(a);
  }
  observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',apply);document.addEventListener('car-cost-context-change',apply);window.addEventListener('load',apply);
  if(document.readyState!=='loading')apply();
})();
