(()=>{
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function injectStyle(){
    if($('#quote-check-allrows-style-v1')) return;
    const style=document.createElement('style');
    style.id='quote-check-allrows-style-v1';
    style.textContent=`
      .quote-check-mode-switch{
        display:none;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin:0 0 10px;
        padding:10px 0;
        border-top:1px solid var(--line,#d8d3c8);
        border-bottom:1px solid var(--line,#d8d3c8);
      }
      .quote-check-mode-switch>strong{font-size:12px}
      .quote-check-mode-buttons{display:flex;gap:6px}
      .quote-check-mode-buttons button{
        min-height:44px;
        padding:8px 11px;
        border:1px solid var(--ink,#111);
        background:transparent;
        color:var(--ink,#111);
        font-weight:800;
        font-size:12px;
      }
      .quote-check-mode-buttons button[aria-pressed="true"]{
        background:var(--ink,#111);
        color:var(--paper,#fff);
      }

      @media(max-width:700px){
        .quote-check-mode-switch{display:flex}

        [data-quote-form][data-quote-check-mode="all"] .wizard-head,
        [data-quote-form][data-quote-check-mode="all"] .wizard-actions{
          display:none!important;
        }

        [data-quote-form][data-quote-check-mode="all"] .quote-check-table{
          border-top:2px solid var(--ink,#111);
        }

        [data-quote-form][data-quote-check-mode="all"] .quote-check-table .qrow{
          display:grid!important;
          grid-template-columns:58px minmax(0,1fr)!important;
          grid-template-areas:
            "title state"
            "title fields";
          gap:0!important;
          align-items:stretch!important;
          padding:0!important;
          border-bottom:1px solid var(--line,#d8d3c8)!important;
        }

        [data-quote-form][data-quote-check-mode="all"] .qrow-title{
          grid-area:title;
          display:flex!important;
          flex-direction:column;
          justify-content:flex-start;
          align-items:flex-start;
          gap:3px;
          min-width:0;
          padding:10px 6px!important;
          border:0!important;
          border-right:1px solid var(--line,#d8d3c8)!important;
          background:var(--paper-soft,#f7f4ee);
        }
        [data-quote-form][data-quote-check-mode="all"] .qrow-title span{font-size:10px}
        [data-quote-form][data-quote-check-mode="all"] .qrow-title strong{
          font-size:12px!important;
          line-height:1.25;
          word-break:keep-all;
        }

        [data-quote-form][data-quote-check-mode="all"] .state-radios{
          grid-area:state;
          display:grid!important;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:4px!important;
          min-width:0;
          padding:7px!important;
          border:0!important;
          border-bottom:1px solid var(--line,#d8d3c8)!important;
        }
        [data-quote-form][data-quote-check-mode="all"] .state-radios label{
          display:flex;
          align-items:center;
          justify-content:center;
          min-height:40px;
          min-width:0;
          padding:5px 4px!important;
          font-size:11px!important;
          text-align:center;
        }

        [data-quote-form][data-quote-check-mode="all"] .q-fields{
          grid-area:fields;
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:6px!important;
          min-width:0;
          padding:7px!important;
          border:0!important;
        }
        [data-quote-form][data-quote-check-mode="all"] .q-fields label{
          min-width:0;
          margin:0!important;
          font-size:11px!important;
        }
        [data-quote-form][data-quote-check-mode="all"] .q-fields input{
          min-height:44px!important;
          min-width:0!important;
          width:100%!important;
          margin-top:3px!important;
          padding:7px 8px!important;
          font-size:13px!important;
        }
        [data-quote-form][data-quote-check-mode="all"] .q-fields .wide{
          grid-column:1/-1!important;
        }

        [data-quote-form][data-quote-check-mode="wizard"] .wizard-head{
          display:flex!important;
        }
        [data-quote-form][data-quote-check-mode="wizard"] .wizard-actions{
          display:flex!important;
        }
      }

      @media(max-width:390px){
        .quote-check-mode-switch{
          align-items:stretch;
          flex-direction:column;
        }
        .quote-check-mode-buttons{
          display:grid;
          grid-template-columns:1fr 1fr;
        }
        [data-quote-form][data-quote-check-mode="all"] .q-fields{
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
        }
      }

      @media print{
        .quote-check-mode-switch{display:none!important}
        [data-quote-form] .quote-check-table .qrow{display:grid!important}
      }
    `;
    document.head.append(style);
  }

  function createSwitch(){
    const wrap=document.createElement('div');
    wrap.className='quote-check-mode-switch';
    wrap.dataset.quoteCheckModeSwitch='';
    wrap.setAttribute('role','group');
    wrap.setAttribute('aria-label','견적 항목 입력 방식');

    const title=document.createElement('strong');
    title.textContent='입력 방식';

    const buttons=document.createElement('div');
    buttons.className='quote-check-mode-buttons';

    const all=document.createElement('button');
    all.type='button';
    all.dataset.quoteCheckModeButton='all';
    all.textContent='12개 한 번에';
    all.setAttribute('aria-pressed','true');

    const wizard=document.createElement('button');
    wizard.type='button';
    wizard.dataset.quoteCheckModeButton='wizard';
    wizard.textContent='한 항목씩 보기';
    wizard.setAttribute('aria-pressed','false');

    buttons.append(all,wizard);
    wrap.append(title,buttons);
    return wrap;
  }

  function init(){
    const form=$('[data-quote-form]');
    const table=$('.quote-check-table',form||document);
    if(!form||!table||form.dataset.quoteCheckAllrowsInit==='1') return;
    form.dataset.quoteCheckAllrowsInit='1';
    injectStyle();

    const wizardHead=$('.wizard-head',form);
    const switcher=createSwitch();
    if(wizardHead) wizardHead.before(switcher);
    else table.before(switcher);

    const rows=$$('.qrow',table);
    if(rows.length && !rows.some(r=>r.classList.contains('is-current'))){
      rows[0].classList.add('is-current');
    }

    const buttons=$$('[data-quote-check-mode-button]',switcher);
    const setMode=mode=>{
      const next=mode==='wizard'?'wizard':'all';
      form.dataset.quoteCheckMode=next;
      table.classList.toggle('mobile-wizard',next==='wizard');
      buttons.forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.quoteCheckModeButton===next)));
      if(next==='wizard' && rows.length && !rows.some(r=>r.classList.contains('is-current'))){
        rows[0].classList.add('is-current');
      }
    };

    buttons.forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.quoteCheckModeButton)));

    // The legacy bundle initializes mobile wizard first. Override it after initialization:
    // default is always the full 12-row view; wizard remains an explicit user option.
    setMode('all');
  }

  window.InteriorQuoteCheckAllRowsV1={init};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();