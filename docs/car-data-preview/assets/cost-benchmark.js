(function(){
  const host=document.querySelector('[data-cost-benchmark]');if(!host)return;
  const money=n=>Math.round(n).toLocaleString('ko-KR')+'원';
  const median=values=>{const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
  const tax=row=>['electric','hydrogen'].includes(row.powertrain)?130000:Number(row.displacement_cc)>0?Math.round(Number(row.displacement_cc)*(row.displacement_cc<=1000?80:row.displacement_cc<=1600?140:200)*1.3):null;
  const section=host.closest('section');
  const show=value=>{host.hidden=!value;if(section)section.hidden=!value};
  let rows=[],dataRef=null;
  function clear(){
    host.querySelector('[data-benchmark-scope]').textContent='계산 가능한 신고 사양을 선택하세요.';
    ['current','median','average','diff','rank'].forEach(key=>{const el=host.querySelector(`[data-benchmark-${key}]`);if(el)el.textContent='—'});
    const fill=host.querySelector('[data-benchmark-fill]');if(fill)fill.style.width='0%';
  }
  function update(){
    const mode=document.documentElement.dataset.costMode||'all';if(mode!=='all'){show(false);return}
    const select=document.getElementById('sourceRow'),selected=dataRef?.rows?.find(row=>row.calc_id===select?.value);
    const distance=Number(document.getElementById('km')?.value),price=Number(document.getElementById('price')?.value);
    if(!selected||!selected.full_cost_ready||!(distance>=1000&&distance<=100000&&price>0&&selected.combined_efficiency>0)){show(false);clear();return}
    const peers=rows.filter(row=>row.powertrain===selected.powertrain&&row.vehicle_class===selected.vehicle_class&&row.combined_efficiency>0&&tax(row)!=null);
    if(!peers.length){show(false);clear();return}
    show(true);
    const total=row=>distance/row.combined_efficiency*price+tax(row),values=peers.flatMap(row=>Array(Math.max(1,Number(row.count)||1)).fill(total(row))),current=total(selected),avg=values.reduce((sum,value)=>sum+value,0)/values.length,mid=median(values),rank=values.filter(value=>value<current).length+1,percent=Math.round(rank/values.length*100);
    host.querySelector('[data-benchmark-current]').textContent=money(current);host.querySelector('[data-benchmark-median]').textContent=money(mid);host.querySelector('[data-benchmark-average]').textContent=money(avg);host.querySelector('[data-benchmark-diff]').textContent=(current<=mid?'중앙값보다 낮음 ':'중앙값보다 높음 ')+money(Math.abs(current-mid));host.querySelector('[data-benchmark-rank]').textContent=`낮은 비용부터 ${rank} / ${values.length} · ${percent}% 위치`;host.querySelector('[data-benchmark-fill]').style.width=Math.min(100,Math.max(2,percent))+'%';host.querySelector('[data-benchmark-scope]').textContent=`${selected.vehicle_class} · ${selected.powertrain==='electric'?'전기':selected.powertrain==='hydrogen'?'수소':selected.powertrain==='hybrid'?'하이브리드':selected.powertrain==='diesel'?'경유':selected.powertrain==='lpg'?'LPG':'휘발유'} · 계산 가능한 신고 사양 ${values.length}개 · 신차 세액 기준`;
  }
  function bind(data){dataRef=data;rows=data?.benchmark_rows||[];update();['sourceRow','generation','familySearch'].forEach(id=>document.getElementById(id)?.addEventListener('change',update));['price','km','familySearch'].forEach(id=>document.getElementById(id)?.addEventListener('input',update));document.addEventListener('car-cost-context-change',update)}
  if(window.CAR_CALC_DATA)bind(window.CAR_CALC_DATA);else document.addEventListener('car-calc-data-ready',event=>bind(event.detail),{once:true});
})();
