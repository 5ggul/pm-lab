(() => {
  'use strict';

  const BASELINE_KEY='interior-review-baseline-v49';
  const SOURCES=[
    ['quote','interior-quote-v5','견적 입력'],
    ['compare5','interior-compare-v5','업체 비교(v5)'],
    ['compare6','interior-compare-v6','업체 비교(v6)'],
    ['progress','interior-review-progress-v46','업체 답변 진행'],
    ['reflection','interior-contract-reflection-v48','계약서 반영 기록']
  ];
  const $=(s,r=document)=>r.querySelector(s);

  function readRaw(key){try{return localStorage.getItem(key)}catch{return null}}
  function getJSON(key,fallback){try{const raw=readRaw(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
  function setJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
  function del(key){try{localStorage.removeItem(key);return true}catch{return false}}
  function hashText(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
  function describeRaw(raw){return {present:raw!==null,length:raw?.length||0,hash:hashText(raw||'')}}

  function currentFingerprint(){
    const values={};
    for(const [id,key,label] of SOURCES){values[id]={key,label,...describeRaw(readRaw(key))}}
    return values;
  }

  function loadBaseline(){
    const raw=getJSON(BASELINE_KEY,null);
    return raw&&raw.version===1&&raw.values&&typeof raw.values==='object'?raw:null;
  }

  function saveBaseline(){
    const baseline={version:1,createdAt:new Date().toISOString(),values:currentFingerprint()};
    return setJSON(BASELINE_KEY,baseline)?baseline:null;
  }

  function clearBaseline(){return del(BASELINE_KEY)}

  function compareBaseline(baseline=loadBaseline()){
    const current=currentFingerprint();
    if(!baseline)return {baseline:null,current,changed:[],unchanged:[],state:'none'};
    const changed=[],unchanged=[];
    for(const [id,,label] of SOURCES){
      const before=baseline.values[id]||{present:false,length:0,hash:hashText('')};
      const now=current[id];
      const same=before.present===now.present&&before.length===now.length&&before.hash===now.hash;
      const row={id,label,before,now};
      (same?unchanged:changed).push(row);
    }
    return {baseline,current,changed,unchanged,state:changed.length?'changed':'clean'};
  }

  function summaryText(result=compareBaseline()){
    const lines=['인테리어 검수 기준 변경 확인'];
    if(result.state==='none'){
      lines.push('저장된 검수 기준 스냅샷이 없습니다.');
    }else{
      lines.push(`검수 기준 저장: ${new Date(result.baseline.createdAt).toLocaleString('ko-KR')}`);
      if(result.state==='clean')lines.push('현재 저장값은 검수 기준과 동일합니다.');
      else{
        lines.push(`변경 감지 ${result.changed.length}개 영역`);
        for(const row of result.changed){
          const type=!row.before.present&&row.now.present?'새로 생성':row.before.present&&!row.now.present?'삭제됨':'내용 변경';
          lines.push(`- ${row.label}: ${type}`);
        }
        lines.push('변경된 영역과 연결된 검수·답변·서면 반영 기록을 다시 확인하세요.');
      }
    }
    lines.push('※ 브라우저 저장값의 변경 여부만 비교하며 내용의 적정성이나 계약 효력을 판정하지 않습니다.');
    return lines.join('\n');
  }

  function ensureStyle(){
    if($('#v49-baseline-style'))return;
    const style=document.createElement('style');style.id='v49-baseline-style';style.textContent=`
      .v49-status{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:14px}.v49-status strong{display:block;font-size:18px}.v49-status p{margin:6px 0 0;color:var(--muted,#777168);font-size:13px;line-height:1.55}.v49-status.is-changed{border-width:2px}.v49-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:12px}.v49-item{border:1px solid var(--line,#c9c4b8);background:#fff;padding:10px}.v49-item span{display:block;color:var(--muted,#777168);font-size:11px}.v49-item strong{display:block;margin-top:4px;font-size:13px}.v49-item.is-changed strong{font-weight:800}.v49-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v49-actions button{min-height:40px;flex:1 1 190px}.v49-note{margin:10px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}
      @media(max-width:900px){.v49-grid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.v49-grid{grid-template-columns:1fr}}
      @media print{.v49-actions{display:none!important}.v49-grid{grid-template-columns:1fr 1fr 1fr}.v49-status,.v49-item{break-inside:avoid}}
    `;document.head.append(style);
  }

  function ensureSection(){
    let section=$('[data-v49-baseline-section]');if(section)return section;
    const anchor=$('[data-v48-reflection-section]')||$('[data-v47-final-section]')||$('[data-review-section]');if(!anchor)return null;
    section=document.createElement('section');section.className='tool-stage';section.dataset.v49BaselineSection='';section.innerHTML='<div class="v10-section-head"><div><h2>검수 기준 변경 감지</h2><p>현재 상태를 검수 기준으로 저장한 뒤 견적·비교·업체답변·서면 반영 기록이 바뀌었는지 확인합니다.</p></div></div><div class="v49-status" data-v49-status></div><div class="v49-grid" data-v49-grid></div><div class="v49-actions"><button type="button" data-v49-save>현재 상태를 검수 기준으로 저장</button><button type="button" data-v49-copy>변경 확인본 복사</button><button type="button" data-v49-clear>검수 기준 삭제</button></div><p class="v49-note">스냅샷에는 원문을 복제하지 않고 각 로컬 저장값의 존재 여부·문자 길이·해시만 저장합니다. 기준 저장 키는 <code>interior-review-baseline-v49</code>입니다.</p>';
    anchor.after(section);return section;
  }

  function render(){
    ensureStyle();const section=ensureSection();if(!section)return compareBaseline();const result=compareBaseline();const status=$('[data-v49-status]',section);const grid=$('[data-v49-grid]',section);grid.replaceChildren();status.classList.toggle('is-changed',result.state==='changed');
    if(result.state==='none')status.innerHTML='<strong>아직 검수 기준이 없습니다.</strong><p>계약서 반영 확인까지 끝낸 시점에 현재 상태를 기준으로 저장하면 이후 변경 여부를 감지할 수 있습니다.</p>';
    else if(result.state==='clean')status.innerHTML=`<strong>검수 기준 이후 변경 없음</strong><p>기준 저장 시각: ${new Date(result.baseline.createdAt).toLocaleString('ko-KR')} · 현재 추적 중인 5개 저장 영역이 기준과 동일합니다.</p>`;
    else status.innerHTML=`<strong>검수 기준 이후 ${result.changed.length}개 영역 변경 감지</strong><p>변경된 저장 영역과 연결된 질문·답변·서면 반영 기록을 다시 확인한 뒤 기준을 갱신하세요.</p>`;
    for(const [id,,label] of SOURCES){const current=result.current[id];const changed=result.changed.some(row=>row.id===id);const card=document.createElement('div');card.className=`v49-item${changed?' is-changed':''}`;const span=document.createElement('span');span.textContent=label;const strong=document.createElement('strong');strong.textContent=result.state==='none'?'기준 미저장':changed?(!result.baseline.values[id]?.present&&current.present?'새로 생성':result.baseline.values[id]?.present&&!current.present?'삭제됨':'내용 변경'):'변경 없음';card.append(span,strong);grid.append(card)}
    return result;
  }

  function init(){
    let current=render();
    $('[data-v49-save]')?.addEventListener('click',()=>{if(saveBaseline())current=render()});
    $('[data-v49-clear]')?.addEventListener('click',()=>{if(!confirm('저장한 검수 기준 스냅샷을 삭제할까요?'))return;clearBaseline();current=render()});
    $('[data-v49-copy]')?.addEventListener('click',async()=>{const button=$('[data-v49-copy]');const original=button.textContent;try{await navigator.clipboard.writeText(summaryText(compareBaseline()));button.textContent='변경 확인본 복사됨'}catch{button.textContent='복사 실패'}setTimeout(()=>button.textContent=original,1200)});
    $('[data-refresh-report]')?.addEventListener('click',()=>{current=render()});
    return current;
  }

  window.InteriorQuoteReview49={BASELINE_KEY,currentFingerprint,loadBaseline,saveBaseline,clearBaseline,compareBaseline,summaryText,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
