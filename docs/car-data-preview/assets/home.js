(function(){
  const tabs=[...document.querySelectorAll('[data-home-tab]')];
  if(!tabs.length)return;
  function activate(button){
    for(const tab of tabs){
      const selected=tab===button;
      tab.setAttribute('aria-selected',String(selected));
      const panel=document.getElementById(tab.getAttribute('aria-controls'));
      if(panel)panel.hidden=!selected;
    }
  }
  for(const tab of tabs){
    tab.addEventListener('click',()=>activate(tab));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();
      const direction=event.key==='ArrowRight'?1:-1,index=tabs.indexOf(tab),next=tabs[(index+direction+tabs.length)%tabs.length];
      activate(next);next.focus();
    });
  }
})();
