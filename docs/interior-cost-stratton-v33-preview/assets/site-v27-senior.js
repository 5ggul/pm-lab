(()=>{
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  ready(()=>{
    const compare=document.querySelector('[data-compare-table]');
    if(compare){
      const buttons=[...document.querySelectorAll('[data-v27-count]')];
      const summary=document.querySelector('[data-v27-diff-summary]');
      const chart=compare.querySelector('[data-v6-compare-chart]');
      if(chart)compare.append(chart);
      const visibleVendors=()=>Number(compare.dataset.v27QuoteCount||'2');
      const rows=[...compare.querySelectorAll('[data-compare-row]')];
      const update=()=>{
        const count=visibleVendors();
        const changed=rows.filter(row=>{
          const states=[...row.querySelectorAll('[data-state]')].slice(0,count).map(x=>x.value);
          return states.length>1&&new Set(states).size>1;
        });
        const hasInput=rows.some(row=>{
          const states=[...row.querySelectorAll('[data-state]')].slice(0,count);
          const amounts=[...row.querySelectorAll('[data-amount]')].slice(0,count);
          return states.some(x=>x.value!=='missing')||amounts.some(x=>String(x.value||'').trim()!=='');
        });
        compare.classList.toggle('v27-has-input',hasInput);
        if(summary){
          if(!hasInput)summary.textContent='조건이 다른 항목을 입력하면 여기에서 먼저 알려드립니다.';
          else if(!changed.length)summary.textContent='현재 입력된 견적에서 포함 조건이 다른 항목은 없습니다.';
          else{
            const names=changed.slice(0,4).map(r=>r.querySelector('h3')?.textContent.trim()||'항목');
            summary.textContent=`조건이 다른 항목 ${changed.length}개: ${names.join(' · ')}${changed.length>4?' 외':''}`;
          }
        }
      };
      const setCount=n=>{
        compare.dataset.v27QuoteCount=String(n);
        buttons.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.v27Count)===n)));
        update();
      };
      buttons.forEach(b=>b.addEventListener('click',()=>setCount(Number(b.dataset.v27Count))));
      compare.addEventListener('input',update);
      compare.addEventListener('change',update);
      setCount(2);
    }

    const builder=document.querySelector('[data-budget-builder]');
    if(builder){
      const modeButtons=[...document.querySelectorAll('[data-v27-calc-mode]')];
      const rows=[...builder.querySelectorAll('[data-budget-row]')];
      const help=document.querySelector('[data-v27-calc-help]');
      const modes={
        all:null,
        custom:null,
        bathroom:['demolition','waste','waterproof','bathroom','management'],
        wallpaper:['demolition','waste','wallpaper','management'],
        flooring:['demolition','waste','flooring','management'],
        kitchen:['demolition','waste','kitchen','electrical','management']
      };
      const labels={all:'전체 인테리어 항목을 표시했습니다.',custom:'전체 항목을 한 번에 표시했습니다.',bathroom:'욕실 공사에 자주 필요한 항목만 표시했습니다.',wallpaper:'도배 공사에 자주 필요한 항목만 표시했습니다.',flooring:'바닥 공사에 자주 필요한 항목만 표시했습니다.',kitchen:'주방 공사에 자주 필요한 항목만 표시했습니다.'};
      const setMode=mode=>{
        const allow=modes[mode];
        builder.classList.remove('v27-calc-waiting');
        rows.forEach(row=>{
          const key=row.dataset.budgetRow||'';
          row.hidden=Array.isArray(allow)?!allow.includes(key):false;
        });
        modeButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v27CalcMode===mode)));
        if(help)help.textContent=labels[mode]||'';
      };
      modeButtons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.v27CalcMode)));
    }
  });
})();
