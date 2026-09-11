const ALLOWED_IDS=new Set(['demolition','waste','waterproof','bathroom','kitchen','wallpaper','flooring','carpentry','electrical','windows','management','vat']);
const ALLOWED_STATES=new Set(['included','separate','missing']);
const ALLOWED_NOTATIONS=new Set(['one','missing']);

export function parseWorkMatchPreset(search=''){
  const params=new URLSearchParams(String(search).replace(/^\?/,''));
  if(params.get('from')!=='work-match')return[];
  const raw=params.get('items')||'';
  const out=[],seen=new Set();
  for(const chunk of raw.split(',').filter(Boolean)){
    const [id,state,notation]=chunk.split('.');
    if(!ALLOWED_IDS.has(id)||!ALLOWED_STATES.has(state)||!ALLOWED_NOTATIONS.has(notation)||seen.has(id))continue;
    seen.add(id);out.push({id,state,notation});
  }
  return out;
}

function applyPreset(items){
  let applied=0;
  for(const item of items){
    const row=document.querySelector(`[data-qc-row="${item.id}"]`);
    if(!row)continue;
    const state=row.querySelector('[data-qc-state]'),notation=row.querySelector('[data-qc-notation]');
    if(state)state.value=item.state;
    if(notation)notation.value=item.notation;
    applied++;
  }
  if(items.some(x=>x.id==='windows')){
    const windows=document.querySelector('[data-qc-windows]');
    if(windows)windows.value='include';
  }
  if(applied){
    const root=document.querySelector('[data-quote-checker]');
    root?.dispatchEvent(new Event('change',{bubbles:true}));
  }
  return applied;
}

function addNotice(applied,items){
  if(!applied)return;
  const main=document.querySelector('.checker-main');
  if(!main||main.querySelector('[data-work-match-handoff-note]'))return;
  const oneCount=items.filter(x=>x.notation==='one').length;
  const separateCount=items.filter(x=>x.state==='separate').length;
  const note=document.createElement('div');
  note.className='data-note';note.dataset.workMatchHandoffNote='';
  const extra=[oneCount?`1식 ${oneCount}개`:null,separateCount?`별도/제외 ${separateCount}개`:null].filter(Boolean).join(' · ');
  note.innerHTML=`<span class="type-tag">공종 매칭 반영</span><p>사용자가 확정한 ${applied}개 표준 공종을 검사표에 옮겼습니다.${extra?` ${extra}.`:''} 금액과 실제 포함 범위는 원 견적서를 보고 다시 확인하세요.</p>`;
  main.insertBefore(note,main.firstChild);
}

function cleanHandoffQuery(){
  const url=new URL(location.href);
  if(!url.searchParams.has('from')&&!url.searchParams.has('items'))return;
  url.searchParams.delete('from');url.searchParams.delete('items');
  history.replaceState(history.state,'',url.href);
}

if(typeof document!=='undefined'){
  const items=parseWorkMatchPreset(location.search);
  if(items.length){
    const applied=applyPreset(items);
    addNotice(applied,items);
    cleanHandoffQuery();
  }
}
