(function(){
  const key='car-data-compare-selection';
  const base=new URL('../',document.currentScript.src);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const buttons=()=>[...document.querySelectorAll('[data-compare-pick]')];
  let selected=[];
  try{selected=JSON.parse(sessionStorage.getItem(key)||'[]')}catch{selected=[]}
  if(!Array.isArray(selected))selected=[];
  function identity(item){return `${item.mode}:${item.id}:${item.variant||''}`}
  function current(button){return {mode:button.dataset.compareMode||'all',id:button.dataset.compareId||'',variant:button.dataset.compareVariant||'',label:button.dataset.compareLabel||button.dataset.compareId||'차량'}}
  function href(){
    if(selected.length!==2)return '#';
    if(selected[0].mode==='reviewed')return new URL(`compare/?mode=reviewed&a=${encodeURIComponent(selected[0].id)}&av=${encodeURIComponent(selected[0].variant)}&b=${encodeURIComponent(selected[1].id)}&bv=${encodeURIComponent(selected[1].variant)}&km=20000`,base).href;
    return new URL(`compare/?fa=${encodeURIComponent(selected[0].id)}&fb=${encodeURIComponent(selected[1].id)}&km=20000`,base).href;
  }
  function ensureTray(){
    let tray=document.querySelector('.compare-tray');
    if(tray)return tray;
    tray=document.createElement('aside');tray.className='compare-tray';tray.hidden=true;tray.setAttribute('aria-label','비교할 차량');
    tray.innerHTML='<div class="compare-tray-list"></div><button type="button" data-compare-clear>비우기</button><a data-compare-go href="#">2대 비교하기</a>';
    document.body.appendChild(tray);
    tray.querySelector('[data-compare-clear]').addEventListener('click',()=>{selected=[];save();});
    return tray;
  }
  function save(){sessionStorage.setItem(key,JSON.stringify(selected));render()}
  function render(){
    const tray=ensureTray();
    for(const button of buttons()){
      const active=selected.some(item=>identity(item)===identity(current(button)));
      button.setAttribute('aria-pressed',String(active));button.textContent=active?'비교에서 빼기':'비교에 담기';
    }
    tray.hidden=selected.length===0;
    tray.querySelector('.compare-tray-list').innerHTML=selected.map(item=>`<span class="compare-tray-item">${esc(item.label)}</span>`).join('');
    const go=tray.querySelector('[data-compare-go]');go.href=href();go.textContent=selected.length===2?'2대 비교하기':`${selected.length}/2 선택`;
    go.toggleAttribute('aria-disabled',selected.length!==2);
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-compare-pick]');if(!button)return;
    const item=current(button),id=identity(item),index=selected.findIndex(row=>identity(row)===id);
    if(index>=0)selected.splice(index,1);else{
      if(selected.length&&selected[0].mode!==item.mode)selected=[];
      if(selected.length===2)selected.shift();
      selected.push(item);
    }
    save();
  });
  document.addEventListener('catalog:render',render);
  render();
})();
