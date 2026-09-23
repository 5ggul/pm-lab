(function(){
  // Carry explicit calculation inputs in links. Prices are keyed by fuel so
  // a per-litre price can never become a per-kWh charging price.
  const params=new URLSearchParams(location.search),$=s=>document.querySelector(s);
  const keys=['gasoline','diesel','lpg','electric'];
  const maxEnergyPrice=1000000;
  const distance=()=>$('#annualKm,#pm-distance,#decision-km,#km');
  const priceInput=()=>$('#fuelPrice,#energyPrice,#pm-price,#decision-price,#price');
  const registrationInput=()=>$('#reg');
  function fuel(){
    const pm=$('#pm-data');if(pm){const data=JSON.parse(pm.textContent);const v=data.variants.find(v=>v.id===$('#pm-variant')?.value);return v?.fuel==='hybrid'?'gasoline':v?.fuel;}
    const decision=$('#decision-data');if(decision){const data=JSON.parse(decision.textContent);const p=data.pairs?.find(p=>p.slug===$('#decision-pair')?.value)||data.pairs?.[0];return p?.left?.fuel==='hybrid'?'gasoline':p?.left?.fuel;}
    if($('#familySearch')&&document.documentElement.dataset.costMode==='all'){
      const label=$('#priceLabelText')?.textContent||'';
      return /충전|전기/.test(label)?'electric':/LPG/i.test(label)?'lpg':/경유|디젤/.test(label)?'diesel':/휘발유|가솔린|하이브리드/.test(label)?'gasoline':null;
    }
    const reviewed=window.CAR_CATALOG?.byId?.[$('#car')?.value],selected=reviewed?.variants.find(v=>v.id===$('#variant')?.value);
    if(selected){const key=window.CAR_UTILS?.fuelKey(selected);return key==='hybrid'?'gasoline':key;}
    const spec=$('#specFuel')?.textContent;if(spec)return /전기|electric|\bev\b/i.test(spec)?'electric':/LPG/i.test(spec)?'lpg':/경유|디젤/.test(spec)?'diesel':/휘발유|가솔린|하이브리드/.test(spec)?'gasoline':null;
    const car=window.CAR_CATALOG?.byId?.[document.body.dataset.car];if(car){const v=car.variants.find(v=>v.label===$('#selectedLabel')?.textContent)||car.rep;const k=window.CAR_UTILS?.fuelKey(v);return k==='hybrid'?'gasoline':k;}
    const text=$('#specFuel')?.textContent||$('#priceLabelText')?.textContent||'';
    return /충전|전기/.test(text)?'electric':/LPG/i.test(text)?'lpg':/경유|디젤/.test(text)?'diesel':/휘발유|가솔린/.test(text)?'gasoline':null;
  }
  function valid(value,max=Infinity){return String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>0&&Number(value)<=max;}
  function validPrice(value){return valid(value,maxEnergyPrice);}
  function validKm(value){return valid(value)&&Number(value)>=1000&&Number(value)<=100000;}
  function validRegistration(value,input=registrationInput()){
    return /^\d{4}-\d{2}$/.test(String(value||''))&&(!input?.min||value>=input.min)&&(!input?.max||value<=input.max);
  }
  function carry(url){
    const km=distance()?.value||params.get('km');
    if(validKm(km))url.searchParams.set('km',km);else url.searchParams.delete('km');
    for(const k of keys){const value=params.get('cprice_'+k);if(validPrice(value))url.searchParams.set('cprice_'+k,value);else url.searchParams.delete('cprice_'+k);}
    const k=fuel(),input=priceInput();if(k&&input){if(validPrice(input.value))url.searchParams.set('cprice_'+k,input.value);else url.searchParams.delete('cprice_'+k);}
    for(const [id,k] of [['gas','gasoline'],['diesel','diesel'],['lpg','lpg'],['elec','electric']]){const input=$('#'+id);if(input){if(validPrice(input.value))url.searchParams.set('cprice_'+k,input.value);else url.searchParams.delete('cprice_'+k);}}
    if(/\/tools\/annual-cost\/?$/.test(url.pathname)){
      const registrationControl=registrationInput(),registration=registrationControl?.value||params.get('reg');
      if(registrationControl&&!registrationControl.disabled&&validRegistration(registration,registrationControl))url.searchParams.set('reg',registration);else url.searchParams.delete('reg');
    }else url.searchParams.delete('reg');
  }
  function syncCurrent(){
    const url=new URL(location.href);carry(url);
    const mode=document.documentElement.dataset.costMode;
    if($('#familySearch')&&mode){
      url.searchParams.set('mode',mode);
      if(mode==='reviewed'){
        if($('#car')?.value)url.searchParams.set('car',$('#car').value);else url.searchParams.delete('car');
        if($('#variant')?.value)url.searchParams.set('variant',$('#variant').value);else url.searchParams.delete('variant');
        url.searchParams.delete('fa');url.searchParams.delete('calc');
      }else{
        url.searchParams.delete('car');url.searchParams.delete('variant');url.searchParams.delete('fa');
        if($('#sourceRow')?.value)url.searchParams.set('calc',$('#sourceRow').value);else url.searchParams.delete('calc');
      }
    }else{
      const selected=$('#variant')?.value||window.CAR_CATALOG?.byId?.[document.body.dataset.car]?.variants.find(v=>v.label===$('#selectedLabel')?.textContent)?.id;
      if(selected)url.searchParams.set('variant',selected);
    }
    if(url.href!==location.href)history.replaceState(history.state,'',url.href);
  }
  for(const kind of ['input','change'])document.addEventListener(kind,event=>{if(event.isTrusted&&event.target.matches('#annualKm,#pm-distance,#decision-km,#km,#fuelPrice,#energyPrice,#pm-price,#decision-price,#price,#reg,#variant,#sourceRow,#car,#familySearch,#generation,#gas,#diesel,#lpg,#elec'))queueMicrotask(syncCurrent)});
  document.addEventListener('click',event=>{if(event.isTrusted&&event.target.closest('#variantButtons [data-variant-index],#variantButtons [data-selector-key]'))queueMicrotask(syncCurrent)});
  document.addEventListener('click',event=>{if(event.isTrusted&&event.target.closest('#allMode,#reviewedMode'))queueMicrotask(syncCurrent)});
  document.addEventListener('click',event=>{
    const a=event.target.closest('a[href]');if(!a||a.dataset.costReset||a.getAttribute('href').startsWith('#'))return;
    const url=new URL(a.href);if(url.origin!==location.origin||!/(?:\/cars\/|\/compare\/|\/tools\/annual-cost\/)/.test(url.pathname))return;
    carry(url);a.href=url.href;
  },true);
  // Async family/shard selection updates controls after the trusted input
  // event has already fired. Sync again when the calculator announces that
  // its derived selection is ready so copied URLs always match the screen.
  document.addEventListener('car-cost-context-change',()=>queueMicrotask(syncCurrent));
  if(!params.has('km')&&!params.has('reg')&&!keys.some(k=>params.has('cprice_'+k)))return;
  let applied=false,observer;
  function apply(){
    if(applied)return;
    const km=distance();if(!km)return;
    if($('#familySearch')&&(!document.documentElement.dataset.costMode||!$('#sourceRow')?.options?.length))return;
    if($('#compareTable')&&!$('#compareTable').textContent.trim())return;
    applied=true;observer?.disconnect();
    if(validKm(params.get('km'))){if(km.tagName==='SELECT'&&!Array.from(km.options).some(o=>o.value===params.get('km'))){const o=new Option(Number(params.get('km')).toLocaleString('ko-KR')+' km',params.get('km'));km.add(o);}km.value=params.get('km');km.dispatchEvent(new Event('change',{bubbles:true}));km.dispatchEvent(new Event('input',{bubbles:true}));}
    const registration=registrationInput(),registrationValue=params.get('reg');if(registration&&!registration.disabled&&validRegistration(registrationValue,registration)){registration.value=registrationValue;registration.dispatchEvent(new Event('change',{bubbles:true}));}
    const k=fuel(),input=priceInput(),value=params.get('cprice_'+k);if(input&&k&&params.has('cprice_'+k)){input.value=value||'';input.dispatchEvent(new Event('input',{bubbles:true}));if(!validPrice(value)){const clean=new URL(location.href);clean.searchParams.delete('cprice_'+k);history.replaceState(history.state,'',clean.href);}}
    for(const [id,k] of [['gas','gasoline'],['diesel','diesel'],['lpg','lpg'],['elec','electric']]){const input=$('#'+id),value=params.get('cprice_'+k);if(input&&validPrice(value)){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}}
    function resetUrl(){const url=new URL(location.href);['km','reg','price','gas','diesel','lpg','elec',...keys.map(k=>'cprice_'+k)].forEach(k=>url.searchParams.delete(k));return url.href;}
    const a=document.createElement('a');a.href=resetUrl();a.textContent='조건 초기화';a.dataset.costReset='true';a.style.cssText='display:inline-flex;align-items:center;min-height:44px;font-size:12px;text-decoration:underline';a.addEventListener('click',()=>{a.href=resetUrl()});km.closest('label')?.append(a);
  }
  observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',apply);document.addEventListener('car-cost-context-change',apply);window.addEventListener('load',apply);
  if(document.readyState!=='loading')apply();
})();
