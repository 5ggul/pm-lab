(()=>{
  const $$=(s,r=document)=>[...r.querySelectorAll(s)],$=(s,r=document)=>r.querySelector(s);
  const fmt=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1});
  const categories=[
    ['demolition','철거',['철거','철거비','철거공사']],['waste','폐기물',['폐기물','폐기','폐기비']],['waterproof','방수',['방수','액체방수','도막방수','시트방수']],['bathroom','욕실',['욕실','화장실','욕실공사']],['kitchen','주방',['주방','싱크','싱크대','상판']],['wallpaper','도배',['도배','벽지']],['flooring','바닥',['바닥','마루','장판','강마루']],['carpentry','목공',['목공','석고','천장','몰딩','걸레받이']],['electrical','전기',['전기','조명','콘센트','스위치']],['window','창호',['샷시','창호','창문','코킹']],['management','관리비',['현장관리','관리비','공과잡비','잡비']],['vat','VAT',['부가세','VAT','vat']]
  ];
  const numFrom=(line)=>{
    const text=String(line);
    const explicit=[...text.matchAll(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*(만원|원)/g)];
    const m=explicit.length?explicit[explicit.length-1]:text.match(/([0-9][0-9,]*(?:\.[0-9]+)?)(?!\s*(?:개|개소|평|㎡|m2|m²|m\^2|회|톤|차량|회로|%))/i);
    if(!m)return null;
    const raw=Number(m[1].replaceAll(',',''));if(!Number.isFinite(raw))return null;
    const unit=m[2]||'만원';return {raw,unit,manwon:unit==='원'?raw/10000:raw};
  };
  function classifyLine(line){
    const text=String(line).trim();if(!text)return null;
    const amount=numFrom(text),hits=categories.filter(([, ,keys])=>keys.some(k=>text.toLowerCase().includes(k.toLowerCase())));
    const selected=hits[0]||['unmatched','미분류',[]];
    return {line:text,key:selected[0],label:selected[1],amount_manwon:amount?Number(amount.manwon.toFixed(2)):null,amount_unit:amount?.unit||null,confidence:hits.length===1?'high':'review',matches:hits.map(x=>x[1])};
  }
  function renderPaste(root,rows){
    const body=$('[data-v10-paste-body]',root),valid=rows.filter(x=>x&&x.key!=='unmatched'),review=rows.filter(x=>x&&x.confidence==='review'),sum=valid.reduce((s,x)=>s+(Number.isFinite(x.amount_manwon)?x.amount_manwon:0),0);
    if(body)body.innerHTML=rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.line.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}</td><td>${r.label}</td><td>${Number.isFinite(r.amount_manwon)?fmt(r.amount_manwon)+'만원':'—'}</td><td class="${r.confidence==='high'?'v10-confidence-high':'v10-confidence-review'}">${r.confidence==='high'?'높음':'검토 필요'}</td></tr>`).join(''):'<tr><td colspan="5">분석 전</td></tr>';
    const set=(s,v)=>{const e=$(s,root);if(e)e.textContent=v};set('[data-v10-lines]',`${rows.length}줄`);set('[data-v10-matched]',`${valid.length}줄`);set('[data-v10-review]',`${review.length}줄`);set('[data-v10-sum]',`${fmt(sum)}만원`);
    root._v10Rows=rows;
    const send=$('[data-v10-send-a]',root),exp=$('[data-v10-export]',root);if(send)send.disabled=!valid.length;if(exp)exp.disabled=!valid.length;
  }
  function initPaste(){
    $$('[data-v10-paste-tool]').forEach(root=>{
      const ta=$('[data-v10-paste]',root),run=$('[data-v10-run]',root),example=$('[data-v10-example]',root),send=$('[data-v10-send-a]',root),exp=$('[data-v10-export]',root);
      const analyze=()=>renderPaste(root,String(ta?.value||'').split(/\r?\n/).map(classifyLine).filter(Boolean));
      run?.addEventListener('click',analyze);
      example?.addEventListener('click',()=>{if(ta)ta.value='철거 320만원\n폐기물 90만원\n욕실 2개 860만원\n주방 싱크대 780만원\n도배 310만원\n강마루 420만원\n전기 조명 210만원\n샷시 1,450만원\n부가세 별도';analyze()});
      exp?.addEventListener('click',()=>{const rows=(root._v10Rows||[]).filter(x=>x.key!=='unmatched');const blob=new Blob([JSON.stringify({version:'10.0.0',rows},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='normalized-quote-lines.json';a.click();URL.revokeObjectURL(a.href)});
      send?.addEventListener('click',()=>{const map={};for(const r of root._v10Rows||[]){if(r.key==='unmatched'||r.key==='vat'||!Number.isFinite(r.amount_manwon))continue;map[r.key]=(map[r.key]||0)+r.amount_manwon}localStorage.setItem('interior-v10-import-a',JSON.stringify(map));location.href='/pm-lab/interior-cost-preview/quote-compare/#v10-import'});
    });
  }
  function hydrateCompareImport(){
    const raw=localStorage.getItem('interior-v10-import-a');if(!raw||!$('[data-compare-table]'))return;
    try{const map=JSON.parse(raw);for(const [key,val] of Object.entries(map)){const row=$(`[data-compare-row="${CSS.escape(key)}"]`);if(!row)continue;const amount=$('[data-vendor="a"][data-amount]',row),state=$('[data-vendor="a"][data-state]',row);if(amount){amount.value=String(Math.round(Number(val)*100)/100);amount.dispatchEvent(new Event('input',{bubbles:true}))}if(state){state.value='included';state.dispatchEvent(new Event('change',{bubbles:true}))}}localStorage.removeItem('interior-v10-import-a');const note=document.createElement('p');note.className='v10-import-note';note.textContent='붙여넣기에서 분류한 공종 금액을 A업체 칸에 반영했습니다. 자동 분류 결과를 원문 견적서와 다시 대조하세요.';const target=$('[data-v9-compare-matrix]')||$('[data-compare-table]');target?.prepend(note)}catch{}
  }
  function initIndexTool(){
    $$('[data-v10-index-tool]').forEach(root=>{
      let series=[];try{series=JSON.parse($('[data-v10-index-series]',root)?.textContent||'[]')}catch{}
      const start=$('[data-v10-index-start]',root),end=$('[data-v10-index-end]',root),res=$('[data-v10-index-result]',root),note=$('[data-v10-index-note]',root);
      const calc=()=>{const a=series.find(x=>x.month===start?.value),b=series.find(x=>x.month===end?.value);if(!a||!b||!res)return;const pct=(Number(b.value)/Number(a.value)-1)*100;res.textContent=`${pct>=0?'+':''}${pct.toFixed(2)}%`;if(note)note.textContent=`${a.month} ${a.value} → ${b.month} ${b.value} · 지수 변화 계산이며 개별 인테리어 견적 상승률이 아닙니다.`};
      start?.addEventListener('change',calc);end?.addEventListener('change',calc);calc();
    });
  }
  function initCombo(){
    $$('[data-v10-combo-tool]').forEach(root=>{
      const out=$('[data-v10-combo-output]',root),count=$('[data-v10-combo-count]',root);
      const render=()=>{const checked=$$('input[data-v10-combo]:checked',root);if(count)count.textContent=`${checked.length}개 공종군 선택`;if(out)out.innerHTML=checked.length?`<ul>${checked.map(x=>`<li><strong>${x.dataset.label}</strong> — ${x.dataset.note}</li>`).join('')}</ul><p>서로 다른 규격·단위의 공공단가를 한 금액으로 합산하지 않습니다. 선택 결과는 견적 범위 누락을 점검하는 용도입니다.</p>`:'<p>공종군을 선택하면 확인할 범위를 정리합니다.</p>'};
      $$('input[data-v10-combo]',root).forEach(x=>x.addEventListener('change',render));render();
    });
  }
  function initAnswerFilter(){
    $$('[data-v10-answer-hub]').forEach(root=>{
      const q=$('[data-v10-answer-q]',root),cat=$('[data-v10-answer-category]',root);const apply=()=>{const needle=String(q?.value||'').trim().toLowerCase(),c=cat?.value||'';$$('[data-v10-answer-card]',root).forEach(card=>{const okText=!needle||String(card.dataset.search||'').toLowerCase().includes(needle),okCat=!c||card.dataset.category===c;card.hidden=!(okText&&okCat)})};q?.addEventListener('input',apply);cat?.addEventListener('change',apply)
    });
  }
  function initRegionFilter(){
    $$('[data-v10-region-index]').forEach(root=>{const q=$('[data-v10-region-q]',root);q?.addEventListener('input',()=>{const n=q.value.trim().toLowerCase();$$('[data-v10-region-card]',root).forEach(x=>x.hidden=n&&!String(x.dataset.search||'').toLowerCase().includes(n))})})
  }
  document.addEventListener('DOMContentLoaded',()=>{initPaste();hydrateCompareImport();initIndexTool();initCombo();initAnswerFilter();initRegionFilter()});
})();
