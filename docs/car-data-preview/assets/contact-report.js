(function(){
  const form=document.getElementById('errorReport');if(!form)return;
  const emailLink=document.getElementById('reportEmail'),status=document.getElementById('reportStatus');
  function message(){const data=new FormData(form);return ['오류 주소: '+(data.get('url')||location.href),'항목: '+data.get('type'),'내용: '+data.get('detail')].join('\n');}
  function update(){emailLink.href='mailto:'+form.dataset.contactEmail+'?subject='+encodeURIComponent('내차데이터 오류 신고')+'&body='+encodeURIComponent(message());}
  form.addEventListener('input',update);form.addEventListener('change',update);update();
  emailLink.addEventListener('click',e=>{if(!form.reportValidity()){e.preventDefault();return;}update();status.textContent='메일 앱에서 내용을 확인하고 전송하세요.';});
  form.addEventListener('submit',async e=>{e.preventDefault();try{await navigator.clipboard.writeText(message());status.textContent='제보 내용을 복사했습니다.';}catch{status.textContent='자동 복사가 불가능합니다. 아래 내용을 선택해 복사하세요.';let fallback=document.getElementById('reportCopyFallback');if(!fallback){fallback=document.createElement('textarea');fallback.id='reportCopyFallback';fallback.readOnly=true;fallback.rows=8;fallback.setAttribute('aria-label','복사할 제보 내용');form.append(fallback);}fallback.value=message();fallback.focus();fallback.select();}});
})();
