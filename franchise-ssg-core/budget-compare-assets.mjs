// v11.52 preview-only enhancement: emitted inside the two bounded shared assets.
// Read existing DOM data; do not change official figures or explorer query fields.
export const BUDGET_COMPARE_JS = String.raw`
(()=>{
  const init=()=>{
    const form=document.querySelector('[data-budget-form]');
    const tbody=document.querySelector('[data-budget-results]');
    if(!form||!tbody||document.querySelector('[data-v52-budget-compare]'))return;
    const state=document.querySelector('[data-v50-explore-state-wrap]');
    const oldLink=state?.querySelector('a[href*="/compare/"]');
    const compareBase=new URL(oldLink?.getAttribute('href')||'../compare/',location.href);
    if(compareBase.origin!==location.origin)return;
    const items=new Map();
    for(const row of tbody.querySelectorAll('[data-budget-row]')){
      const link=row.querySelector('td:first-child a[href]');
      if(!link)continue;
      let slug;try{slug=decodeURIComponent(new URL(link.href).pathname.match(/\/brands\/([^/]+)\/$/)?.[1]||'');}catch{continue;}
      if(!slug||items.has(slug))continue;
      const label=document.createElement('label');label.className='v52-budget-pick';
      const input=document.createElement('input');input.type='checkbox';input.dataset.v52BudgetPick=slug;
      const name=link.textContent.trim();input.setAttribute('aria-label',name+' 비교 선택');
      const text=document.createElement('span');text.textContent='비교 선택';
      label.append(input,text);link.after(label);items.set(slug,{row,input,name});
    }
    if(items.size<2)return;
    const key='v11.52:budget-compare:'+location.pathname;
    let selected=[];
    const restore=()=>{try{const saved=JSON.parse(sessionStorage.getItem(key)||'[]');if(Array.isArray(saved))selected=[...new Set(saved.filter(s=>typeof s==='string'&&items.has(s)))].slice(0,2);}catch{}};
    const save=()=>{try{sessionStorage.setItem(key,JSON.stringify(selected));}catch{}};
    restore();
    const dock=document.createElement('section');dock.className='v52-budget-dock';dock.dataset.v52BudgetCompare='1';
    dock.setAttribute('aria-label','선택한 브랜드 비교');
    dock.innerHTML='<div class="v52-budget-selection-head"><strong data-v52-budget-count></strong><button type="button" data-v52-budget-clear>선택 해제</button></div><div class="v52-budget-chips" data-v52-budget-chips></div><button class="button v52-budget-submit" type="button" data-v52-budget-submit disabled>2개 선택 후 비교</button><p class="v52-budget-status" data-v52-budget-status role="status" aria-live="polite" aria-atomic="true"></p>';
    const space=document.createElement('div');space.className='v52-budget-dock-space';space.append(dock);
    if(state){state.after(space);oldLink?.remove();}else tbody.closest('.table-scroll').before(space);
    document.body.classList.add('v52-budget-selection');
    const count=dock.querySelector('[data-v52-budget-count]'),chips=dock.querySelector('[data-v52-budget-chips]');
    const submit=dock.querySelector('[data-v52-budget-submit]'),clear=dock.querySelector('[data-v52-budget-clear]');
    const status=dock.querySelector('[data-v52-budget-status]');
    const size=()=>{const target=matchMedia('(max-width:760px)').matches&&selected.length?document.body:space;if(dock.parentElement!==target){const active=dock.contains(document.activeElement)?document.activeElement:null;target.append(dock);active?.focus({preventScroll:true});}const h=Math.ceil(dock.getBoundingClientRect().height)+20;document.body.style.setProperty('--v52-budget-dock-height',h+'px');};
    const render=(message='')=>{
      count.textContent='비교 후보 '+selected.length+'/2';clear.disabled=!selected.length;
      submit.disabled=selected.length!==2;submit.textContent=selected.length===2?'선택한 2개 비교':'2개 선택 후 비교';
      const focused=chips.contains(document.activeElement)?document.activeElement?.dataset.v52BudgetRemove:null;
      chips.replaceChildren();
      for(const slug of selected){
        const button=document.createElement('button');button.type='button';button.dataset.v52BudgetRemove=slug;
        button.setAttribute('aria-label',items.get(slug).name+' 선택 해제');button.title=items.get(slug).name+' 선택 해제';
        const name=document.createElement('span');name.textContent=items.get(slug).name;
        const cross=document.createElement('span');cross.textContent='×';cross.setAttribute('aria-hidden','true');
        button.append(name,cross);chips.append(button);
      }
      for(const [slug,item]of items){item.input.checked=selected.includes(slug);item.input.disabled=selected.length===2&&!item.input.checked;item.row.classList.toggle('v52-budget-selected',item.input.checked);}
      status.textContent=message||(selected.length===2?'선택을 해제하면 다른 후보를 고를 수 있습니다.':selected.length===1?'브랜드 1개를 더 선택하세요.':'비교할 브랜드 2개를 선택하세요.');
      document.body.classList.toggle('v52-budget-has-selection',selected.length>0);
      if(focused){const next=[...chips.children].find(el=>el.dataset.v52BudgetRemove===focused);(next||clear).focus();}
      save();size();
    };
    const refresh=()=>{
      const removed=selected.filter(slug=>items.get(slug).row.hidden);
      selected=selected.filter(slug=>!items.get(slug).row.hidden);
      // Native selects can emit both input and change; retain the removal notice.
      render(removed.length?'조건에서 제외된 '+removed.map(s=>items.get(s).name).join(', ')+' 선택을 해제했습니다.':status.textContent);
    };
    tbody.addEventListener('change',event=>{
      const input=event.target.closest('[data-v52-budget-pick]');if(!input)return;
      const slug=input.dataset.v52BudgetPick,item=items.get(slug);if(!item||item.row.hidden)return;
      if(input.checked){if(!selected.includes(slug)&&selected.length<2)selected.push(slug);}else selected=selected.filter(s=>s!==slug);
      render();
    });
    chips.addEventListener('click',event=>{
      const button=event.target.closest('[data-v52-budget-remove]');if(!button)return;
      const slug=button.dataset.v52BudgetRemove;selected=selected.filter(s=>s!==slug);render();
      const remaining=chips.querySelector('button');if(remaining)remaining.focus();else if(!items.get(slug).row.hidden)items.get(slug).input.focus();
    });
    clear.addEventListener('click',()=>{selected=[];render();[...items.values()].find(item=>!item.row.hidden)?.input.focus();});
    submit.addEventListener('click',()=>{
      refresh();if(selected.length!==2)return;
      const url=new URL(compareBase);url.search='';url.hash='';url.searchParams.set('a',selected[0]);url.searchParams.set('b',selected[1]);
      save();location.assign(url.href);
    });
    // Existing explorer handlers run first; keep only candidates still displayed.
    const onFilter=()=>queueMicrotask(refresh);
    form.addEventListener('input',onFilter);form.addEventListener('change',onFilter);
    document.querySelectorAll('[data-budget]').forEach(button=>button.addEventListener('click',onFilter));
    document.querySelector('[data-budget-reset]')?.addEventListener('click',()=>{selected=[];queueMicrotask(()=>render('예산 조건과 비교 선택을 초기화했습니다.'));});
    addEventListener('pageshow',()=>{restore();refresh();});
    addEventListener('resize',size,{passive:true});
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(size).observe(dock);
    refresh();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();`;

export const BUDGET_COMPARE_CSS=String.raw`
body.v52-budget-selection .v52-budget-dock{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 16px;margin:12px 0 18px;padding:14px 16px;border:1px solid #344034;border-radius:9px;background:#101710;color:#eaf1ea}
body.v52-budget-selection .v52-budget-selection-head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
body.v52-budget-selection .v52-budget-selection-head strong{font-size:14px;white-space:nowrap}
body.v52-budget-selection [data-v52-budget-clear]{min-height:44px;padding:6px 10px;background:none;border:0;color:#b6c2b7;font-size:12px}
body.v52-budget-selection .v52-budget-chips{display:flex;gap:8px;min-width:0;grid-column:1}
body.v52-budget-selection .v52-budget-chips:empty{display:none}
body.v52-budget-selection .v52-budget-chips button{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;max-width:50%;min-height:44px;padding:8px 10px;border:1px solid #64794b;border-radius:6px;background:#1b2819;color:#d8efc3;font-size:13px}
body.v52-budget-selection .v52-budget-chips button>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
body.v52-budget-selection .v52-budget-submit{grid-column:2;grid-row:1/3;align-self:center;min-height:48px;white-space:nowrap}
body.v52-budget-selection .v52-budget-status{grid-column:1/-1;margin:0;font-size:12px;line-height:1.5;color:#b6c2b7;overflow-wrap:anywhere}
body.v52-budget-selection .v52-budget-pick{display:flex;align-items:center;gap:7px;min-height:44px;width:max-content;max-width:100%;margin-top:5px;color:#b6c2b7;font-size:12px;cursor:pointer}
body.v52-budget-selection .v52-budget-pick input{width:20px;height:20px;min-width:20px;min-height:20px;margin:0;padding:0;accent-color:#c8ff3d}
body.v52-budget-selection .budget-result-table td:first-child{min-width:145px}
body.v52-budget-selection .budget-result-table .v52-budget-selected td{background:#152011}
body.v52-budget-selection .v52-budget-pick:has(input:disabled){opacity:.5;cursor:default}
body.v52-budget-selection .v52-budget-dock button:disabled{opacity:.45;cursor:not-allowed}
body.v52-budget-selection .v52-budget-dock button:focus-visible,body.v52-budget-selection .v52-budget-pick input:focus-visible{outline:2px solid #c8ff3d!important;outline-offset:2px}
@media(max-width:760px){
body.v52-budget-selection .v52-budget-dock{grid-template-columns:1fr;gap:6px;padding:10px 12px}
body.v52-budget-selection .v52-budget-chips{grid-column:1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
body.v52-budget-selection .v52-budget-chips:empty{display:none}
body.v52-budget-selection .v52-budget-chips button{max-width:100%;width:100%}
body.v52-budget-selection .v52-budget-submit{grid-column:1;grid-row:auto;width:100%}
body.v52-budget-selection.v52-budget-has-selection{padding-bottom:var(--v52-budget-dock-height,210px)}
body.v52-budget-selection.v52-budget-has-selection .v52-budget-dock{position:fixed;z-index:115;left:0;right:0;bottom:0;margin:0;border-radius:0;padding-bottom:calc(10px + env(safe-area-inset-bottom));box-shadow:0 -6px 24px rgba(0,0,0,.3)}
body.v52-budget-selection.v52-budget-has-selection .v52-budget-dock-space{min-height:40px}
}`;
