(()=>{
  const $$=(s,r=document)=>[...r.querySelectorAll(s)],$=(s,r=document)=>r.querySelector(s);
  function initFilters(){
    $$('[data-v13-filter-root]').forEach(root=>{
      const q=$('[data-v13-q]',root),kind=$('[data-v13-kind]',root),rows=$$('[data-v13-row]',root);
      const apply=()=>{const n=(q?.value||'').trim().toLowerCase(),k=kind?.value||'';for(const row of rows){const okN=!n||(row.dataset.search||'').toLowerCase().includes(n),okK=!k||row.dataset.kind===k;row.hidden=!(okN&&okK)}};
      q?.addEventListener('input',apply);kind?.addEventListener('change',apply);apply();
    });
  }
  document.addEventListener('DOMContentLoaded',initFilters);
})();
