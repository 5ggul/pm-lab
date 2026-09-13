(()=>{const ready=()=>{const money=v=>Number.isFinite(Number(v))?Math.round(Number(v)).toLocaleString('ko-KR')+'만원':'—';const params=new URLSearchParams(location.search);

const compare=document.querySelector('[data-v34-workspace="hub"]');
if(compare){
  const picks=[...compare.querySelectorAll('[data-v34-pick]')];
  const note=compare.querySelector('[data-v46-compare-note]');
  const status=compare.querySelector('[data-v34-status]');
  let data={brands:{}};try{data=JSON.parse(compare.querySelector('[data-v34-comparedata]')?.textContent||'{}')}catch{}
  const brands=Object.values(data.brands||{});
  const byName=new Map(brands.map(b=>[String(b.name||'').trim().toLowerCase(),b]));
  const list=compare.querySelector('#v46-brand-options');
  if(list){list.innerHTML=brands.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko')).map(b=>'<option value="'+String(b.name||'').replace(/"/g,'&quot;')+'">'+String(b.categoryName||b.category?.name||'')+'</option>').join('')}
  const current=()=>picks.map(s=>s.value).filter(Boolean);
  const show=msg=>{if(note)note.textContent=msg||''};
  const syncDisabled=()=>{const selected=current();picks.forEach(sel=>{[...sel.options].forEach(opt=>{if(!opt.value)return;opt.disabled=selected.includes(opt.value)&&sel.value!==opt.value})})};
  const syncUrl=()=>{const p=new URLSearchParams(location.search);['a','b','c','d'].forEach(k=>p.delete(k));current().slice(0,4).forEach((v,i)=>p.set(['a','b','c','d'][i],v));history.replaceState(null,'',location.pathname+(p.size?'?'+p.toString():'')+location.hash)};
  const normalizeDuplicates=changed=>{const vals=current();if(changed?.value&&vals.filter(v=>v===changed.value).length>1){changed.value='';show('이미 선택한 브랜드입니다.');changed.dispatchEvent(new Event('change',{bubbles:true}));return false}return true};
  picks.forEach(sel=>sel.addEventListener('change',()=>{if(!normalizeDuplicates(sel))return;syncDisabled();syncUrl();if(status)status.classList.remove('is-v46-error')}));
  const incoming=['a','b','c','d'].map(k=>params.get(k)).filter(v=>v&&data.brands?.[v]);
  if(!incoming.length&&params.get('brand')&&data.brands?.[params.get('brand')])incoming.push(params.get('brand'));
  if(incoming.length){picks.forEach(s=>s.value='');incoming.slice(0,4).forEach((v,i)=>{if(picks[i])picks[i].value=v});if(incoming.length<2){const fallback=['mega-mgc-coffee','compose-coffee',...Object.keys(data.brands||{})].find(v=>v&&!incoming.includes(v)&&data.brands?.[v]);if(fallback&&picks[1])picks[1].value=fallback}picks.forEach(s=>s.dispatchEvent(new Event('change',{bubbles:true})));show('링크의 브랜드 선택을 불러왔습니다.')}
  syncDisabled();
  const search=compare.querySelector('[data-v46-compare-search]'),add=compare.querySelector('[data-v46-compare-add-button]');
  const addBrand=()=>{const term=String(search?.value||'').trim().toLowerCase();if(!term){show('브랜드명을 입력하세요.');return}let b=byName.get(term);if(!b){const hits=brands.filter(x=>String(x.name||'').toLowerCase().includes(term));if(hits.length===1)b=hits[0];else{show(hits.length?'검색 결과가 여러 개입니다. 브랜드명을 더 입력하세요.':'일치하는 브랜드가 없습니다.');return}}if(current().includes(b.slug)){show('이미 선택한 브랜드입니다.');return}const empty=picks.find(s=>!s.value);if(!empty){show('최대 4개까지 비교할 수 있습니다.');return}empty.value=b.slug;empty.dispatchEvent(new Event('change',{bubbles:true}));if(search)search.value='';show(b.name+' 추가됨')};
  add?.addEventListener('click',addBrand);search?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addBrand()}});
}

const startup=document.querySelector('[data-v36-startup="1"]');
if(startup){
  let data={};try{data=JSON.parse(startup.querySelector('[data-v36-startdata]')?.textContent||'{}')}catch{}
  const brand=startup.querySelector('[data-v36-brand]');
  const fields=['lease','premium','construction','inventory','working'];
  const num=name=>{const el=startup.querySelector('[name="'+name+'"]');const n=Number(el?.value||0);return Number.isFinite(n)&&n>0?n:0};
  const render=()=>{const b=data?.[brand?.value]||null;const base=Number.isFinite(Number(b?.cost))?Number(b.cost):Number(startup.dataset.v36DefaultCost)||0;const extra=fields.reduce((s,n)=>s+num(n),0);const set=(sel,val)=>{const el=startup.querySelector(sel);if(el)el.textContent=val};set('[data-v46-public]',money(base));set('[data-v46-extra]',money(extra));set('[data-v46-total]',money(base+extra))};
  const incoming=params.get('brand');if(incoming&&brand&&data?.[incoming]){brand.value=incoming;brand.dispatchEvent(new Event('change',{bubbles:true}))}
  brand?.addEventListener('change',()=>{const p=new URLSearchParams(location.search);if(brand.value)p.set('brand',brand.value);else p.delete('brand');history.replaceState(null,'',location.pathname+(p.size?'?'+p.toString():'')+location.hash);render()});
  fields.forEach(n=>startup.querySelector('[name="'+n+'"]')?.addEventListener('input',render));
  startup.querySelector('[data-v46-input-reset]')?.addEventListener('click',()=>{fields.forEach(n=>{const el=startup.querySelector('[name="'+n+'"]');if(el){el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}))}});const profit=startup.querySelector('[name="profit"]');if(profit){profit.value='';profit.dispatchEvent(new Event('input',{bubbles:true}))}render()});
  render();
}
};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready()})();