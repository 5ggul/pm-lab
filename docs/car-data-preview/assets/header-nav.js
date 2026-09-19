(()=>{
 const header=document.querySelector('.db-header'),button=header?.querySelector('.site-nav-toggle'),nav=header?.querySelector('.db-nav');
 if(!header||!button||!nav)return;
 header.classList.add('has-nav-toggle');
 const setOpen=open=>{
  header.classList.toggle('nav-open',open);
  button.setAttribute('aria-expanded',String(open));
  button.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');
 };
 button.addEventListener('click',()=>setOpen(button.getAttribute('aria-expanded')!=='true'));
 nav.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false)});
})();
