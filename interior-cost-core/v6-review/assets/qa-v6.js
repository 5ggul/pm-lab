(()=>{
  const script=document.currentScript;
  const root=new URL('../',script?.src||location.href);
  if(!document.querySelector('link[data-v6-qa]')){const l=document.createElement('link');l.rel='stylesheet';l.href=new URL('assets/qa-v6.css',root).href;l.dataset.v6Qa='';document.head.append(l)}
  const addBar=({label,statusEl,detailEl,target})=>{
    if(!statusEl||!target)return;
    if(!target.id)target.id='mobile-result-target-'+Math.random().toString(36).slice(2,7);
    const bar=document.createElement('div');bar.className='mobile-result-bar';bar.innerHTML=`<div><span>${label}</span><strong></strong><small></small></div><a href="#${target.id}">결과보기</a>`;
    const strong=bar.querySelector('strong'),small=bar.querySelector('small');
    const sync=()=>{strong.textContent=statusEl.textContent.trim();small.textContent=detailEl?.textContent.trim()||''};
    sync();new MutationObserver(sync).observe(statusEl,{subtree:true,childList:true,characterData:true});if(detailEl)new MutationObserver(sync).observe(detailEl,{subtree:true,childList:true,characterData:true});
    document.body.append(bar);
  };
  const checker=document.querySelector('[data-quote-checker]');
  if(checker){const target=document.querySelector('.checker-side .result-sticky')||document.querySelector('.checker-side');if(target)target.id='checker-result';addBar({label:'검사 결과',statusEl:document.querySelector('[data-qc-status]'),detailEl:document.querySelector('[data-qc-coverage]'),target})}
  const compare=document.querySelector('#compare-rows');
  if(compare){const target=document.querySelector('.compare-result');if(target)target.id='compare-result';addBar({label:'비교 판정',statusEl:document.querySelector('#compare-status'),detailEl:document.querySelector('#compare-reason'),target})}
})();
