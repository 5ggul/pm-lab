const WORK_TO_CHECKER_ID={
  '철거':'demolition','폐기물':'waste','방수':'waterproof','욕실':'bathroom','주방':'kitchen','도배':'wallpaper','바닥':'flooring','목공':'carpentry','전기':'electrical','창호':'windows','현장관리비':'management','VAT':'vat'
};
const ALLOWED_IDS=new Set(Object.values(WORK_TO_CHECKER_ID));

export function buildCheckerPreset(entries=[]){
  const grouped=new Map();
  for(const entry of entries){
    const id=WORK_TO_CHECKER_ID[String(entry?.standard_work||'').trim()];
    if(!id||!ALLOWED_IDS.has(id))continue;
    const state=entry?.separate&&entry?.included?'missing':entry?.separate?'separate':'included';
    const notation=entry?.bundled?'one':'missing';
    const current=grouped.get(id)||{id,states:new Set(),notations:new Set()};
    current.states.add(state);current.notations.add(notation);grouped.set(id,current);
  }
  return [...grouped.values()].map(item=>({
    id:item.id,
    state:item.states.size===1?[...item.states][0]:'missing',
    notation:item.notations.has('one')?'one':'missing'
  }));
}

export function encodeCheckerPreset(items=[]){
  return items.filter(x=>ALLOWED_IDS.has(x?.id)&&['included','separate','missing'].includes(x?.state)&&['one','missing'].includes(x?.notation)).map(x=>`${x.id}.${x.state}.${x.notation}`).join(',');
}

function readSelectedEntries(){
  return [...document.querySelectorAll('.match-candidate .match-check input[type="checkbox"]:checked')].map(input=>{
    const row=input.closest('.match-candidate'),line=input.closest('.match-line');
    const standard_work=row?.querySelector('.match-work strong')?.textContent?.trim()||'';
    const flags=[...(line?.querySelectorAll('.match-flags span')||[])].map(x=>x.textContent?.trim()||'');
    return {
      standard_work,
      bundled:flags.some(x=>x.includes('1식')),
      included:flags.some(x=>x==='포함'),
      separate:flags.some(x=>x.includes('별도/제외'))
    };
  });
}

function updateButton(button){
  if(!button)return;
  const count=buildCheckerPreset(readSelectedEntries()).length;
  button.disabled=count===0;
  button.textContent=count?`견적 검사로 보내기 · ${count}`:'견적 검사로 보내기';
}

function goToChecker(button){
  const items=buildCheckerPreset(readSelectedEntries());
  if(!items.length){updateButton(button);return;}
  const url=new URL('../quote-check/',import.meta.url);
  url.searchParams.set('from','work-match');
  url.searchParams.set('items',encodeCheckerPreset(items));
  location.href=url.href;
}

if(typeof document!=='undefined'){
  const button=document.querySelector('[data-match-to-checker]');
  updateButton(button);
  document.querySelector('[data-work-match]')?.addEventListener('change',()=>updateButton(button));
  document.querySelector('[data-match-analyze]')?.addEventListener('click',()=>queueMicrotask(()=>updateButton(button)));
  document.querySelector('[data-match-reset]')?.addEventListener('click',()=>queueMicrotask(()=>updateButton(button)));
  button?.addEventListener('click',()=>goToChecker(button));
}
