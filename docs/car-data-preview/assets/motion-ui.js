(()=>{
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const selectors=['.home-car','.rank-row','.dossier-section','.pm-panel','.decision-cards','.decision-calculator','.decision-recall','.utility-grid','.analysis-article>section'];
 const targets=[...document.querySelectorAll(selectors.join(','))];
 targets.forEach((el,index)=>{el.classList.add('motion-reveal');el.style.setProperty('--motion-order',String(index%6))});
 if(reduce){targets.forEach(el=>el.classList.add('is-visible'));return}
 document.body.classList.add('motion-ready');
 const visible=el=>el.getBoundingClientRect().top<innerHeight*1.06&&el.getBoundingClientRect().bottom>-20;
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}
 }),{rootMargin:'0px 0px -5% 0px',threshold:.06});
 requestAnimationFrame(()=>targets.forEach(el=>visible(el)?el.classList.add('is-visible'):observer.observe(el)));
})();
