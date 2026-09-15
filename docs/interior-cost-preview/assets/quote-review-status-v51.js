(() => {
  'use strict';

  const QUOTE_URL=window.INTERIOR_STATUS_QUOTE_URL||'/pm-lab/interior-cost-preview/quote-check/';
  const COMPARE_URL=window.INTERIOR_STATUS_COMPARE_URL||'/pm-lab/interior-cost-preview/quote-compare/';
  const $=(s,r=document)=>r.querySelector(s);

  function raw(key){try{return localStorage.getItem(key)}catch{return null}}
  function safeCall(fn,fallback){try{return fn()}catch{return fallback}}

  function buildModel(){
    const quote=raw('interior-quote-v5');
    const compare5=raw('interior-compare-v5');
    const compare6=raw('interior-compare-v6');

    const progressApi=window.InteriorQuoteReview46;
    const groups=progressApi?.currentGroups?safeCall(()=>progressApi.currentGroups(),[]):[];
    const questionRows=progressApi?.rowsFrom?safeCall(()=>progressApi.rowsFrom(groups),[]):[];
    const progress=progressApi?.loadProgress?safeCall(()=>progressApi.loadProgress(),{entries:{}}):{entries:{}};
    const questionDone=questionRows.filter(row=>progress.entries?.[row.key]?.done).length;

    const reflectionApi=window.InteriorQuoteReview48;
    const candidates=reflectionApi?.buildCandidates?safeCall(()=>reflectionApi.buildCandidates(),[]):[];
    const reflection=reflectionApi?.loadReflection?safeCall(()=>reflectionApi.loadReflection(),{entries:{}}):{entries:{}};
    const reflected=candidates.filter(row=>reflection.entries?.[row.key]?.reflected).length;

    const baselineApi=window.InteriorQuoteReview49;
    const baselineResult=baselineApi?.compareBaseline?safeCall(()=>baselineApi.compareBaseline(),{state:'none',changed:[]}):{state:'none',changed:[]};

    const revalidationApi=window.InteriorQuoteReview50;
    const revalidationModel=revalidationApi?.buildTasks?safeCall(()=>revalidationApi.buildTasks(),{state:baselineResult.state,tasks:[]}):{state:baselineResult.state,tasks:[]};
    const revalidationState=revalidationApi?.loadState?safeCall(()=>revalidationApi.loadState(),{entries:{}}):{entries:{}};
    const revalidationStats=revalidationApi?.taskStats?safeCall(()=>revalidationApi.taskStats(revalidationModel.tasks||[],revalidationState),{done:0,total:0,pending:0}):{done:0,total:0,pending:0};

    const comparePresent=!!(compare5||compare6);
    const compareSynced=!!compare5&&!!compare6&&compare5===compare6;
    const stages=[
      {id:'quote',label:'견적',status:quote?'complete':'todo',summary:quote?'저장됨':'미저장'},
      {id:'compare',label:'업체 비교',status:comparePresent?'complete':'todo',summary:comparePresent?(compareSynced?'저장됨 · v5/v6 일치':'저장됨'):'미저장'},
      {id:'answers',label:'업체 답변',status:questionRows.length?(questionDone===questionRows.length?'complete':'progress'):'complete',summary:questionRows.length?`${questionDone} / ${questionRows.length} 확인`:'현재 질문 없음'},
      {id:'reflection',label:'서면 반영',status:candidates.length?(reflected===candidates.length?'complete':'progress'):'complete',summary:candidates.length?`${reflected} / ${candidates.length} 반영 확인`:'현재 반영 후보 없음'},
      {id:'baseline',label:'검수 기준',status:baselineResult.state==='none'?'todo':baselineResult.state==='changed'?'changed':'complete',summary:baselineResult.state==='none'?'미저장':baselineResult.state==='changed'?`${baselineResult.changed?.length||0}개 영역 변경`:'변경 없음'},
      {id:'revalidation',label:'재검수',status:baselineResult.state==='changed'?(revalidationStats.pending?'progress':'complete'):'complete',summary:baselineResult.state==='changed'?`${revalidationStats.done} / ${revalidationStats.total} 완료`:'현재 대상 없음'}
    ];

    let next={id:'done',title:'현재 저장 기준에서 추가 재검수 없음',description:'검수 기준 이후 변경이 감지되지 않았습니다.',kind:'none'};
    if(!quote)next={id:'quote',title:'견적 입력부터 저장',description:'검수 리포트를 만들 원본 견적 저장값이 없습니다.',kind:'route',route:QUOTE_URL};
    else if(!comparePresent)next={id:'compare',title:'A/B/C 비교 입력',description:'저장 견적을 기준으로 업체 비교값을 입력해 주세요.',kind:'route',route:COMPARE_URL};
    else if(questionRows.length&&questionDone<questionRows.length)next={id:'answers',title:'업체 답변 확인 계속',description:`아직 ${questionRows.length-questionDone}개 질문이 미확인 상태입니다.`,kind:'target',target:'[data-v46-progress-section]'};
    else if(candidates.length&&reflected<candidates.length)next={id:'reflection',title:'서면 반영 확인 계속',description:`업체 답변 중 ${candidates.length-reflected}개가 서면 반영 미확인 상태입니다.`,kind:'target',target:'[data-v48-reflection-section]'};
    else if(baselineResult.state==='none')next={id:'baseline',title:'현재 상태를 검수 기준으로 저장',description:'현재까지 확인한 상태를 기준점으로 저장하면 이후 변경을 감지할 수 있습니다.',kind:'target',target:'[data-v49-baseline-section]'};
    else if(baselineResult.state==='changed'&&revalidationStats.pending>0)next={id:'revalidation',title:'변경 후 재검수 진행',description:`변경으로 생성된 재검수 작업 ${revalidationStats.pending}개가 남아 있습니다.`,kind:'target',target:'[data-v50-revalidation-section]'};
    else if(baselineResult.state==='changed'&&revalidationStats.total>0&&revalidationStats.pending===0)next={id:'baseline-refresh',title:'재검수 후 새 검수 기준 저장',description:'재검수는 완료됐지만 기존 기준과 현재 값은 다릅니다. 확인 후 새 기준을 저장하세요.',kind:'target',target:'[data-v49-baseline-section]'};

    return {quotePresent:!!quote,comparePresent,compareSynced,questionTotal:questionRows.length,questionDone,candidateTotal:candidates.length,reflected,baselineState:baselineResult.state,changedCount:baselineResult.changed?.length||0,revalidationStats,stages,next};
  }

  function ensureStyle(){
    if($('#v51-review-status-style'))return;
    const style=document.createElement('style');
    style.id='v51-review-status-style';
    style.textContent=`
      .v51-stage{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7)}.v51-stage .v10-section-head{margin-bottom:12px}.v51-next{border:1px solid var(--line,#c9c4b8);background:#fff;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px}.v51-next strong{display:block;font-size:18px}.v51-next p{margin:5px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}.v51-next a,.v51-next button{min-height:42px;white-space:nowrap}.v51-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:12px}.v51-step{border:1px solid var(--line,#c9c4b8);background:#fff;padding:10px;min-width:0}.v51-step span{display:block;color:var(--muted,#777168);font-size:11px}.v51-step strong{display:block;margin-top:4px;font-size:13px;line-height:1.4}.v51-step[data-status="progress"],.v51-step[data-status="changed"]{border-width:2px}.v51-step[data-status="todo"] strong,.v51-step[data-status="changed"] strong{font-weight:800}.v51-note{margin:10px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}
      @media(max-width:980px){.v51-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:620px){.v51-next{align-items:stretch;flex-direction:column}.v51-next a,.v51-next button{width:100%}.v51-grid{grid-template-columns:1fr 1fr}}@media print{.v51-next a,.v51-next button{display:none!important}.v51-grid{grid-template-columns:repeat(3,1fr)}.v51-stage{break-inside:avoid}}
    `;
    document.head.append(style);
  }

  function ensureSection(){
    let section=$('[data-v51-status-section]');
    if(section)return section;
    const host=$('.tool-page.site-shell')||$('.tool-page');
    if(!host)return null;
    section=document.createElement('section');
    section.className='tool-stage v51-stage';
    section.dataset.v51StatusSection='';
    section.innerHTML='<div class="v10-section-head"><div><h2>현재 검수 상태</h2><p>저장된 견적·비교·업체답변·서면반영·검수기준·재검수 상태를 한 번에 요약합니다.</p></div></div><div class="v51-next" data-v51-next></div><div class="v51-grid" data-v51-grid></div><p class="v51-note">이 상태판은 기존 로컬 저장값을 읽기만 합니다. 가격 적정성, 업체 우열, 계약 효력 또는 법률 판단을 하지 않습니다.</p>';
    const firstStage=$(':scope > .tool-stage',host);
    if(firstStage)host.insertBefore(section,firstStage);else host.prepend(section);
    return section;
  }

  function render(){
    ensureStyle();
    const section=ensureSection();
    const model=buildModel();
    if(!section)return model;
    const nextHost=$('[data-v51-next]',section);const grid=$('[data-v51-grid]',section);grid.replaceChildren();nextHost.replaceChildren();
    const text=document.createElement('div');const strong=document.createElement('strong');strong.textContent=model.next.title;const p=document.createElement('p');p.textContent=model.next.description;text.append(strong,p);nextHost.append(text);
    if(model.next.kind==='route'){
      const a=document.createElement('a');a.href=model.next.route;a.textContent='다음 확인';nextHost.append(a);
    }else if(model.next.kind==='target'){
      const button=document.createElement('button');button.type='button';button.textContent='다음 확인';button.addEventListener('click',()=>$(model.next.target)?.scrollIntoView({behavior:'smooth',block:'start'}));nextHost.append(button);
    }
    for(const stage of model.stages){const card=document.createElement('div');card.className='v51-step';card.dataset.status=stage.status;const label=document.createElement('span');label.textContent=stage.label;const value=document.createElement('strong');value.textContent=stage.summary;card.append(label,value);grid.append(card)}
    return model;
  }

  function init(){
    let current=render();
    const rerender=()=>setTimeout(()=>{current=render()},0);
    $('[data-refresh-report]')?.addEventListener('click',rerender);
    $('[data-v49-save]')?.addEventListener('click',rerender);
    $('[data-v49-clear]')?.addEventListener('click',rerender);
    document.addEventListener('change',event=>{if(event.target?.matches?.('[data-v46-done],[data-v48-reflect],[data-v50-check]'))rerender()});
    return current;
  }

  window.InteriorQuoteReview51={buildModel,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
