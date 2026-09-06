document.addEventListener('error',event=>{
  const img=event.target;
  if(!(img instanceof HTMLImageElement)||!img.classList.contains('pilot-photo'))return;
  const note=document.createElement('span');note.className='pilot-photo-failed';
  note.textContent='사진을 불러오지 못했습니다';note.setAttribute('role','status');
  img.replaceWith(note);
},true);
