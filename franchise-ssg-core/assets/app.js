'use strict';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const money=v=>`${Math.round(Number(v)||0).toLocaleString('ko-KR')}만원`;
const value=(form,name)=>{const raw=form.elements[name]?.value;if(raw===''||raw==null)return 0;const n=Number(raw);return Number.isFinite(n)?Math.max(0,n):0};

/* Header disclosure: native Tab order, Escape and responsive focus recovery. */
const header=q('.site-header');
const toggle=header?.querySelector('.nav-toggle');
const primaryNav=header?.querySelector('nav');
if(toggle&&primaryNav){
  let lastHeaderFocus=null;
  header.addEventListener('focusin',event=>{lastHeaderFocus=event.target;});
  const compact=()=>getComputedStyle(toggle).display!=='none';
  const isOpen=()=>primaryNav.classList.contains('is-open');
  const setOpen=(open,restoreFocus=false)=>{
    primaryNav.classList.toggle('is-open',open);
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');
    if(restoreFocus&&compact())toggle.focus();
  };
  toggle.addEventListener('click',()=>setOpen(!isOpen()));
  header.addEventListener('keydown',event=>{if(event.key==='Escape'&&compact()&&isOpen()){event.preventDefault();setOpen(false,true);}});
  header.addEventListener('focusout',event=>{
    if(event.relatedTarget){if(!header.contains(event.relatedTarget))lastHeaderFocus=null;if(compact()&&isOpen()&&!header.contains(event.relatedTarget))setOpen(false);return;}
    setTimeout(()=>{if(compact()&&isOpen()&&!header.contains(document.activeElement))setOpen(false);},0);
  });
  document.addEventListener('pointerdown',event=>{if(!header.contains(event.target)){if(compact()&&isOpen())setOpen(false,primaryNav.contains(document.activeElement));lastHeaderFocus=null;}});
  primaryNav.addEventListener('click',event=>{if(compact()&&event.target.closest('a[href]'))setOpen(false,primaryNav.contains(document.activeElement));});
  addEventListener('resize',()=>{const focused=document.activeElement;const previous=focused===document.body||focused===document.documentElement?lastHeaderFocus:focused;if(!compact()){setOpen(false);if(previous===toggle)primaryNav.querySelector('a[href]')?.focus();}else if(!isOpen()&&primaryNav.contains(previous))toggle.focus();},{passive:true});
  addEventListener('blur',()=>{lastHeaderFocus=null;});
  addEventListener('pageshow',()=>setOpen(false,compact()&&primaryNav.contains(document.activeElement)));
  setOpen(false);
}
/* Header disclosure end. */

function syncQuery(form,names){
  const params=new URLSearchParams(location.search);
  for(const name of names){const el=form.elements[name];if(!el)continue;const v=String(el.value??'').trim();if(v)params.set(name,v);else params.delete(name)}
  const qs=params.toString();history.replaceState(null,'',`${location.pathname}${qs?`?${qs}`:''}${location.hash||''}`);
}
function hydrateQuery(form,names){const params=new URLSearchParams(location.search);for(const name of names){const el=form.elements[name],v=params.get(name);if(el&&v!=null)el.value=v}}

const directory=q('[data-v10-directory]');
if(directory){
  const search=q('#directorySearch',directory),category=q('#directoryCategory',directory),cost=q('#directoryCost',directory),stores=q('#directoryStores',directory),growth=q('#directoryGrowth',directory),sort=q('#directorySort',directory),body=q('#directoryTable tbody',directory),count=q('#directoryCount',directory);
  const rows=body?qa('tr',body):[];
  const params=new URLSearchParams(location.search);
  const controls={q:search,category,cost,stores,growth,sort};
  for(const [name,el] of Object.entries(controls)){const incoming=params.get(name);if(el&&incoming!=null&&[...el.options||[]].some?.(o=>o.value===incoming)!==false)el.value=incoming;}
  const numeric=(raw,fallback)=>raw===''||raw==null||!Number.isFinite(Number(raw))?fallback:Number(raw);
  const sync=()=>{const next=new URLSearchParams(location.search);for(const [name,el] of Object.entries(controls)){if(!el)continue;const v=String(el.value??'').trim();const isDefault=(name==='category'||name==='growth')&&v==='all'||name==='sort'&&v==='name';if(v&&!isDefault)next.set(name,v);else next.delete(name);}const qs=next.toString();history.replaceState(null,'',`${location.pathname}${qs?`?${qs}`:''}${location.hash||''}`);};
  const apply=()=>{
    if(!body)return;
    const term=(search?.value||'').trim().toLocaleLowerCase('ko-KR'),max=Number(cost?.value)||null,min=Number(stores?.value)||null,visible=[];
    for(const r of rows){
      const rc=numeric(r.dataset.cost,null),rs=numeric(r.dataset.stores,null),rg=numeric(r.dataset.growth,null);
      const brand=(r.dataset.name||'').toLocaleLowerCase('ko-KR');
      const categoryText=(r.cells?.[1]?.textContent||'').trim().toLocaleLowerCase('ko-KR');
      const ok=(!term||brand.includes(term)||categoryText.includes(term))&&(!category||category.value==='all'||r.dataset.cat===category.value)&&(!max||(rc!=null&&rc<=max))&&(!min||(rs!=null&&rs>=min))&&(!growth||growth.value==='all'||(growth.value==='up'&&rg!=null&&rg>0)||(growth.value==='down'&&rg!=null&&rg<0));
      r.hidden=!ok;if(ok)visible.push(r);
    }
    visible.sort((a,b)=>{if(sort?.value==='costAsc')return numeric(a.dataset.cost,Infinity)-numeric(b.dataset.cost,Infinity);if(sort?.value==='storesDesc')return numeric(b.dataset.stores,-Infinity)-numeric(a.dataset.stores,-Infinity);if(sort?.value==='growthDesc')return numeric(b.dataset.growth,-Infinity)-numeric(a.dataset.growth,-Infinity);return (a.dataset.name||'').localeCompare(b.dataset.name||'','ko');});
    for(const r of visible)body.appendChild(r);if(count)count.textContent=`${visible.length}개 브랜드`;sync();
  };
  [search,category,cost,stores,growth,sort].filter(Boolean).forEach(el=>el.addEventListener(el===search?'input':'change',apply));apply();
}

qa('form[data-tool="startup-cost-v10"]').forEach(form=>{
  const names=['brand','publicCost','rentDeposit','keyMoney','extraWork','initialGoods','workingCapital'];hydrateQuery(form,names);const brand=form.elements.brand;
  const run=()=>{const publicCost=value(form,'publicCost'),rent=value(form,'rentDeposit'),key=value(form,'keyMoney'),extra=value(form,'extraWork'),goods=value(form,'initialGoods'),working=value(form,'workingCapital'),additional=rent+key+extra+goods+working,total=publicCost+additional;const set=(sel,val)=>{const el=q(sel,form.closest('[data-v10-calculator-page]')||document);if(el)el.textContent=val};set('[data-startup-total]',money(total));set('[data-result-public]',money(publicCost));set('[data-result-site]',money(rent+key));set('[data-result-extra]',money(extra+goods+working));const interpretation=q('[data-result-interpretation]',form.closest('[data-v10-calculator-page]')||document);if(interpretation)interpretation.textContent=additional>0?`입력한 점포·추가비용은 공개 브랜드 비용과 별도입니다. 현재 입력에서는 추가비용이 총 필요자금의 ${total>0?(additional/total*100).toFixed(1):'0.0'}%를 차지합니다.`:'점포 임대보증금·권리금·추가공사·초도물품·운전자금을 입력하면 공개비용과 분리해 보여줍니다.';syncQuery(form,names)};
  if(brand){const applyBrand=()=>{const opt=brand.selectedOptions[0];if(opt?.dataset.cost&&form.elements.publicCost)form.elements.publicCost.value=opt.dataset.cost||'';const basis=q('[data-brand-basis]',form);if(basis)basis.textContent=opt?.dataset.year?`${opt.dataset.year} 정보공개서 기준 공개합계`:'브랜드를 선택하면 공식 기준연도를 표시합니다.';run()};brand.addEventListener('change',applyBrand);if(brand.value)applyBrand()}
  qa('input,select',form).forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',run));run();
});

qa('form[data-tool="monthly-profit-v10"]').forEach(form=>{
  const names=['revenue','materialRate','platformRate','royaltyRate','labor','rent','utilities','other'];hydrateQuery(form,names);
  const run=()=>{const revenue=value(form,'revenue'),materialRate=value(form,'materialRate'),platformRate=value(form,'platformRate'),royaltyRate=value(form,'royaltyRate'),rate=Math.min(100,materialRate+platformRate+royaltyRate),variable=revenue*rate/100,fixed=value(form,'labor')+value(form,'rent')+value(form,'utilities')+value(form,'other'),balance=revenue-variable-fixed,margin=1-rate/100,breakEven=margin>0?fixed/margin:null;const root=form.closest('[data-v10-calculator-page]')||document;const set=(sel,val)=>{const el=q(sel,root);if(el)el.textContent=val};set('[data-profit-balance]',`${balance<0?'-':''}${money(Math.abs(balance))}`);set('[data-profit-revenue]',money(revenue));set('[data-profit-variable]',money(variable));set('[data-profit-fixed]',money(fixed));set('[data-profit-breakeven]',breakEven==null?'계산 불가':money(breakEven));const interpretation=q('[data-result-interpretation]',root);if(interpretation)interpretation.textContent=revenue<=0?'월매출과 비용 가정을 입력하면 결과를 계산합니다.':balance>0?'현재 입력에서는 비용 차감 후 단순 영업잔액이 양수입니다. 세금·감가상각·대출 원리금·점주 인건비·폐기·계절성은 반영하지 않았습니다.':'현재 입력에서는 단순 영업잔액이 0 이하입니다. 매출·변동비율·고정비 가정을 다시 점검하세요.';syncQuery(form,names)};
  qa('input,select',form).forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',run));run();
});

qa('[data-copy-url]').forEach(btn=>btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);const old=btn.textContent;btn.textContent='링크 복사됨';setTimeout(()=>btn.textContent=old,1400)}catch{}}));

/* Compatibility for remaining tools */
qa('[data-tool]').filter(form=>!['startup-cost-v10','monthly-profit-v10'].includes(form.dataset.tool)).forEach(form=>{const run=()=>{const out=q('[data-result]',form);if(!out)return;const type=form.dataset.tool;if(type==='startup-cost')out.textContent=money(value(form,'publicCost')+value(form,'rentDeposit')+value(form,'keyMoney')+value(form,'extra')+value(form,'working'));if(type==='break-even'){const revenue=value(form,'revenue'),material=revenue*value(form,'material')/100,cost=material+value(form,'labor')+value(form,'rent')+value(form,'other'),surplus=revenue-cost,inv=value(form,'investment');out.textContent=surplus>0?`${(inv/surplus).toFixed(1)}개월`:'계산하지 않음 (월 단순잉여 ≤ 0)'}if(type==='open-close'){const base=value(form,'base'),fresh=value(form,'new'),end=value(form,'end'),cancel=value(form,'cancel');out.textContent=base>0?`신규율 ${(fresh/base*100).toFixed(1)}% · 종료·해지율 ${((end+cancel)/base*100).toFixed(1)}%`:'기준 점포 수를 입력하세요'}};qa('input,select',form).forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',run));run()});