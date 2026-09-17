(() => {
  'use strict';
  const PROD_PREFIX='/pm-lab/interior-cost-preview/';
  const isShell=()=>{try{return location.pathname.includes('/production-shell/');}catch{return false;}};
  if(!isShell()) return;

  function ensureStatus(){
    let el=document.querySelector('[data-v41-shell-nav-status]');
    if(el) return el;
    el=document.createElement('div');
    el.dataset.v41ShellNavStatus='';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:720px;margin:auto;padding:10px 12px;background:#171a18;color:#fff;font:12px/1.4 system-ui;display:none';
    document.body.append(el);
    return el;
  }
  function announce(text){
    const el=ensureStatus();
    el.textContent=text;
    el.style.display='block';
    clearTimeout(el._timer);
    el._timer=setTimeout(()=>{el.style.display='none';},2200);
  }

  document.addEventListener('submit',e=>{
    if(!e.target.closest?.('[data-site-search]')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    announce('production-shell 검수에서는 사이트 검색 이동을 차단했습니다.');
  },true);

  document.addEventListener('click',e=>{
    const link=e.target.closest?.('a[href]');
    if(!link) return;
    const raw=link.getAttribute('href')||'';
    if(!raw.startsWith(PROD_PREFIX)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    announce('production-shell 범위를 벗어나는 운영 경로 이동을 차단했습니다.');
  },true);

  window.InteriorProductionShellGuard41={isShell,PROD_PREFIX};
})();
