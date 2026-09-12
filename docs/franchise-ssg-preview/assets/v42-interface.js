(()=>{
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wrappers=[...document.querySelectorAll('.table-scroll,.table-wrap,.v39-table-wrap')];
  const markOverflow=()=>wrappers.forEach(w=>w.classList.toggle('v42-scrollable',w.scrollWidth>w.clientWidth+4));
  markOverflow();addEventListener('resize',markOverflow,{passive:true});
  const body=document.body;
  if(!body.classList.contains('v25-home')&&!document.querySelector('.brand-toc')){
    const heads=[...document.querySelectorAll('main h2')].filter(h=>h.textContent.trim()&&!h.closest('footer')).slice(0,6);
    if(heads.length>=2){
      heads.forEach((h,i)=>{if(!h.id)h.id='v42-section-'+(i+1)});
      const nav=document.createElement('nav');nav.className='v42-jump';nav.setAttribute('aria-label','페이지 바로가기');
      const inner=document.createElement('div');
      heads.forEach(h=>{const a=document.createElement('a');a.href='#'+h.id;a.textContent=h.textContent.trim().replace(/\s+/g,' ');inner.appendChild(a)});nav.appendChild(inner);
      const anchor=document.querySelector('.v25-cathead,.page-head,.v34-workspace,.v36-title');
      if(anchor)anchor.insertAdjacentElement('afterend',nav);else{const c=document.querySelector('main .crumbs');if(c)c.insertAdjacentElement('afterend',nav)}
      const links=[...inner.querySelectorAll('a')];
      if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>{const hit=es.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!hit)return;links.forEach(a=>a.classList.toggle('is-active',a.getAttribute('href')==='#'+hit.target.id))},{rootMargin:'-28% 0px -62% 0px',threshold:[0,.2,.6]});heads.forEach(h=>io.observe(h))}
    }
  }
  document.querySelectorAll('.v35-benchmark,.v35-comp-row,.v26-area-row,.v34-workspace,.v36-stage').forEach(el=>el.dataset.v42Data='1');
  if(reduce)document.documentElement.classList.add('v42-reduced-motion');
})();