/* Progressive controls: all specification rows remain readable without JavaScript. */
document.querySelectorAll('.reference-specs').forEach(section=>{
 const control=section.querySelector('[data-differences]'),rows=[...section.querySelectorAll('tbody tr')];
 if(!control||!rows.length)return;
 control.closest('label').hidden=false;
 control.addEventListener('change',()=>{
  rows.forEach(row=>row.hidden=control.checked&&row.dataset.equal==='true');
  section.querySelector('.reference-no-difference').hidden=rows.some(row=>!row.hidden);
 });
});
document.querySelectorAll('.reference-section-nav').forEach(nav=>{
 const links=[...nav.querySelectorAll('a')];
 links.forEach(link=>link.addEventListener('click',()=>{links.forEach(a=>a.removeAttribute('aria-current'));link.setAttribute('aria-current','location');}));
});
