/* v11.54: behavioral fixes; v11.42 visual language stays unchanged. */
(()=>{
  const ready=()=>{
    const title=document.querySelector('.v44-home-title');
    if(title){
      let scheduled=false;
      const fit=()=>{scheduled=false;title.style.removeProperty('font-size');let size=parseFloat(getComputedStyle(title).fontSize);while(title.scrollWidth>title.clientWidth+1&&size>16){size-=0.5;title.style.setProperty('font-size',size+'px','important')}};
      const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(fit)}};
      if('ResizeObserver' in window)new ResizeObserver(schedule).observe(title.parentElement);
      document.fonts?.ready.then(schedule);window.addEventListener('resize',schedule,{passive:true});fit();
    }
    const read=el=>{const raw=String(el?.value??'').trim();return raw===''?null:Number(raw)};
    const valid=el=>{const v=read(el);return v===null||(Number.isFinite(v)&&v>=0)};
    const mark=(el,message)=>{el.setCustomValidity(message);if(message)el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid')};
    const noteFor=root=>{let note=root.querySelector('[data-v54-input-note]');if(!note){note=document.createElement('p');note.dataset.v54InputNote='1';note.className='v54-input-note';note.setAttribute('role','status');root.appendChild(note)}return note};
    const share=root=>{if(root.querySelector('[data-v54-share]'))return;const bar=document.createElement('div');bar.className='v54-tool-actions';const button=document.createElement('button');button.type='button';button.dataset.v54Share='1';button.textContent='조건 링크 복사';button.className='button secondary';button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);button.textContent='링크 복사됨'}catch{button.textContent='주소창의 링크를 복사하세요'}setTimeout(()=>button.textContent='조건 링크 복사',2500)});bar.appendChild(button);root.appendChild(bar);return bar};
    const startup=document.querySelector('[data-v36-startup="1"]');
    if(startup){
      const names=['lease','premium','construction','inventory','working','profit'];
      const inputs=names.map(name=>startup.querySelector('[name="'+name+'"]')).filter(Boolean);
      const original=new URLSearchParams(location.search);
      inputs.forEach(el=>{el.step='any';if(original.has(el.name)){const value=original.get(el.name);if(value===''||(Number.isFinite(Number(value))&&Number(value)>=0))el.value=value}});
      const note=noteFor(startup.querySelector('.v36-inputs')||startup);
      const sync=()=>{
        const p=new URLSearchParams(location.search),bad=inputs.filter(el=>!valid(el));
        inputs.forEach(el=>{mark(el,valid(el)?'':'0 이상의 숫자를 입력하세요.');const v=read(el);if(Number.isFinite(v)&&v>0)p.set(el.name,String(v));else p.delete(el.name)});
        history.replaceState(null,'',location.pathname+(p.size?'?'+p.toString():'')+location.hash);
        note.hidden=bad.length===0;note.textContent=bad.length?'금액은 0 이상의 숫자로 입력하세요. 잘못된 입력은 준비자금으로 계산하지 않습니다.':'';
        if(bad.length)startup.querySelectorAll('[data-v36-derived],[data-v46-total],[data-v49-startup-total]').forEach(el=>el.textContent='입력 확인');
      };
      inputs.forEach(el=>el.addEventListener('input',()=>queueMicrotask(sync)));
      startup.querySelector('[data-v36-brand]')?.addEventListener('change',()=>queueMicrotask(sync));
      inputs.forEach(el=>el.dispatchEvent(new Event('input',{bubbles:true})));sync();
      share(startup.querySelector('.v36-inputs')||startup);
    }
    const monthly=document.querySelector('form[data-tool="monthly-profit-v10"]');
    if(monthly){
      const fields=[...monthly.querySelectorAll('input')],rates=['materialRate','platformRate','royaltyRate'];
      const root=monthly.closest('[data-v10-calculator-page]')||document;
      const note=noteFor(monthly);
      const update=()=>{
        const bad=fields.filter(el=>!valid(el)||(rates.includes(el.name)&&read(el)>100));
        fields.forEach(el=>mark(el,bad.includes(el)?(rates.includes(el.name)?'0~100 사이의 비율을 입력하세요.':'0 이상의 숫자를 입력하세요.'):''));
        const sum=rates.reduce((s,name)=>s+(read(monthly.elements[name])||0),0);
        if(bad.length){note.hidden=false;note.textContent='금액은 0 이상, 각 비용 비율은 0~100 사이로 입력하세요.';root.querySelectorAll('[data-profit-balance],[data-profit-revenue],[data-profit-variable],[data-profit-fixed],[data-profit-breakeven]').forEach(el=>el.textContent='입력 확인');return}
        if(read(monthly.elements.revenue)===null){root.querySelectorAll('[data-profit-balance],[data-profit-revenue],[data-profit-variable],[data-profit-fixed],[data-profit-breakeven]').forEach(el=>el.textContent='입력 대기')}
        note.hidden=false;
        note.textContent=sum>100?'변동비율 합계 '+sum.toFixed(1)+'%입니다. 입력 비율을 그대로 계산했으므로 변동비가 매출보다 큽니다. 항목을 중복 입력했는지 확인하세요.':'빈 비용 항목은 0으로 계산합니다. 실제로 발생하는 비용은 빠짐없이 입력하세요.';
      };
      fields.forEach(el=>el.addEventListener('input',update));update();
    }
    for(const root of document.querySelectorAll('[data-tool="break-even"],[data-tool="open-close"],form[data-tool="monthly-fixed-cost-v11"],form[data-tool="monthly-profit-v10"]')){
      const fields=[...root.querySelectorAll('input[name],select[name]')];
      const legacy=['break-even','open-close'].includes(root.dataset.tool);
      const params=new URLSearchParams(location.search);
      if(legacy){
        fields.forEach(el=>{if(params.has(el.name)){const v=params.get(el.name);if(v===''||(Number.isFinite(Number(v))&&Number(v)>=0))el.value=v}});
        const sync=()=>{const p=new URLSearchParams(location.search);fields.forEach(el=>p.set(el.name,el.value));history.replaceState(null,'',location.pathname+(p.size?'?'+p.toString():'')+location.hash)};
        fields.forEach(el=>el.addEventListener('input',sync));fields.forEach(el=>el.dispatchEvent(new Event('input',{bubbles:true})));
      }
      const bar=share(root)||root.querySelector('.v54-tool-actions');
      if(bar&&!bar.querySelector('[data-v54-reset]')){
        const button=document.createElement('button');button.type='button';button.dataset.v54Reset='1';button.className='button secondary';button.textContent='입력 초기화';
        button.addEventListener('click',()=>{fields.forEach(el=>{if(el.name==='reserveMonths')el.value='1';else el.value='';el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))});fields[0]?.focus()});bar.prepend(button);
      }
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
