document.addEventListener('DOMContentLoaded',function(){
 const bars=CAR_METRIC_CHARTS.bars;
 const container=document.getElementById('compareTable');
 // Read the displayed results, never run a second calculator with different rounding or assumptions.
 if(container){
  const target=document.createElement('div');target.className='metric-live';container.before(target);
  const parse=s=>/^\s*[\d,]+(?:\.\d+)?원\s*$/.test(s)?Number(s.replace(/[원,\s]/g,'')):null;
  function update(){
   target.replaceChildren();
   const inputs=['km','gas','diesel','lpg','elec'].map(id=>document.getElementById(id));
   if(inputs.some(i=>i&&i.value&&(!i.validity.valid||!Number.isFinite(i.valueAsNumber)||i.valueAsNumber<=0))||!document.getElementById('km').value)return;
   if(document.getElementById('allMode')?.classList.contains('active')&&['A','B'].some(side=>{const input=document.getElementById('family'+side);return ![...document.getElementById('familyList'+side).options].some(o=>o.value===input.value.trim());}))return;
   const rows=[...container.querySelectorAll('.variant-row')],head=rows.find(r=>r.classList.contains('head'));
   if(!head)return;const names=[...head.children].slice(1,3).map(n=>n.textContent);
   const spec=rows.find(r=>['선택 사양','공식 신고 사양'].includes(r.firstElementChild.textContent));
   if(spec)names.forEach((name,i)=>names[i]=name+' · '+spec.children[i+1].textContent);
   const tax=rows.find(r=>r.firstElementChild.textContent==='신차 기준 연간 정상 자동차세');
   const total=rows.find(r=>r.firstElementChild.textContent==='세금 + 선택 주행거리 에너지비');
   if(!tax||!total)return;
   const taxes=[...tax.children].slice(1,3).map(n=>parse(n.textContent)),totals=[...total.children].slice(1,3).map(n=>parse(n.textContent));
   if([...taxes,...totals].some(v=>v==null)){
    const energyRow=rows.find(r=>r.classList.contains('scenario-active'));if(!energyRow)return;
    const energies=[...energyRow.children].slice(1,3).map(n=>parse(n.textContent));if(energies.some(v=>v==null))return;
    target.innerHTML=bars({title:'연간 연료·충전비',note:`입력한 연 ${Number(document.getElementById('km').value).toLocaleString('ko-KR')}km · 입력 단가 기준 · 자동차세는 계산 조건이 부족해 제외`,rows:names.map((name,i)=>({label:(i?'B ':'A ')+name,values:[energies[i]]}))});return;
   }
   target.innerHTML=bars({title:'연간 비용 구성',note:`입력한 연 ${Number(document.getElementById('km').value).toLocaleString('ko-KR')}km · 입력 단가 기준 · 구매·보험·정비 비용 제외`,stacked:true,rows:names.map((name,i)=>({label:(i?'B ':'A ')+name,values:[totals[i]-taxes[i],taxes[i]]}))});
  }
  new MutationObserver(update).observe(container,{childList:true,subtree:true,characterData:true});
  document.addEventListener('input',update);document.addEventListener('change',update);update();
 }
 const dataElement=document.getElementById('decision-data'),form=document.getElementById('decision-form');
 if(dataElement&&form){
  const data=JSON.parse(dataElement.textContent);if(data.kind!=='compare')return;
  const target=document.createElement('div');target.className='metric-live';form.after(target);
  function update(){const km=document.getElementById('decision-km'),price=document.getElementById('decision-price');target.replaceChildren();
   if(!km.validity.valid||!price.validity.valid||!Number.isFinite(km.valueAsNumber)||!Number.isFinite(price.valueAsNumber))return;
   const p=data.pairs[0],c=CAR_DECISION_MATH.compare(p.left,p.right,km.valueAsNumber,price.valueAsNumber);
   if(!c)return;
   target.innerHTML=bars({title:'입력한 조건의 연간 비용',note:`연 ${km.valueAsNumber.toLocaleString('ko-KR')}km · ${price.valueAsNumber.toLocaleString('ko-KR')}원/L · 구매·보험·정비 비용 제외`,stacked:true,rows:[c.a,c.b].map((v,i)=>({label:(i?'B ':'A ')+[p.left,p.right][i].model+' · '+[p.left,p.right][i].label,values:[v.energy,v.tax]}))});
  }
  form.addEventListener('input',update);form.addEventListener('change',update);update();
 }
});
