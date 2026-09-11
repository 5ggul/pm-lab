(()=>{
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  function initSnippetFilter(){
    const root=$('[data-v18-snippet-search]');if(!root)return;
    const input=$('input',root),button=$('button',root),rows=$$('[data-v18-snippet]');
    const run=()=>{
      const q=(input?.value||'').trim().toLowerCase();
      let shown=0;
      rows.forEach(row=>{
        const ok=!q||(row.dataset.search||row.textContent||'').toLowerCase().includes(q);
        row.hidden=!ok;if(ok)shown++;
      });
      const out=$('[data-v18-snippet-count]');if(out)out.textContent=String(shown);
    };
    input?.addEventListener('input',run);button?.addEventListener('click',run);run();
  }
  function initAuditTabs(){
    $$('[data-v18-role-filter]').forEach(btn=>btn.addEventListener('click',()=>{
      const role=btn.dataset.v18RoleFilter||'all';
      $$('[data-v18-role]').forEach(row=>row.hidden=role!=='all'&&row.dataset.v18Role!==role);
      $$('[data-v18-role-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));
    }));
  }
  function initCopy(){
    $$('[data-v18-copy]').forEach(btn=>btn.addEventListener('click',async()=>{
      const target=$(btn.dataset.v18Copy);if(!target)return;
      try{await navigator.clipboard.writeText(target.textContent||'');btn.textContent='복사됨';setTimeout(()=>btn.textContent='복사',1200)}catch{}
    }));
  }
  initSnippetFilter();initAuditTabs();initCopy();
})();
