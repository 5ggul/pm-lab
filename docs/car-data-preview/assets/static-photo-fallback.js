document.addEventListener('error',event=>{
  const img=event.target;if(!(img instanceof HTMLImageElement))return;
  const picture=img.closest('picture[data-optimized-photo]');
  if(event.isTrusted&&picture?.querySelector('source')){
    event.stopImmediatePropagation();picture.querySelectorAll('source').forEach(s=>s.remove());
    img.src=img.getAttribute('src');return;
  }
  if(!img.classList.contains('pilot-photo'))return;
  const note=document.createElement('span');note.className='pilot-photo-failed';note.textContent='사진을 불러오지 못했습니다';note.setAttribute('role','status');img.replaceWith(note);
},true);
