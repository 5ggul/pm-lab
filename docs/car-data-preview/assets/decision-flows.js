(function(){
 const data=JSON.parse(document.getElementById('decision-data').textContent),params=new URLSearchParams(location.search),$=id=>document.getElementById(id);
 if(data.kind==='recalls'){
  const old=data.aliases.find(n=>n.id===params.get('id'));if(old){location.replace('./'+old.slug+'/');return}
  const q=$('recall-q'),norm=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');q.value=params.get('q')||'';
  function filter(){let found=0;document.querySelectorAll('[data-recall-id]').forEach(el=>{el.hidden=!norm(el.dataset.search).includes(norm(q.value));if(!el.hidden)found++});$('recall-empty').hidden=found>0}
  q.addEventListener('input',filter);filter();return;
 }
 const km=$('decision-km'),price=$('decision-price'),choice=$('decision-pair'),gap=$('decision-gap'),form=$('decision-form');
 const fmt=n=>Math.round(n).toLocaleString('ko-KR')+'원';
 const label=n=>n>0?'오른쪽 차량이 연 '+fmt(n)+' 적음':n<0?'왼쪽 차량이 연 '+fmt(-n)+' 적음':'두 차량의 연간 비용이 같음';
 const years=r=>r.gap<=0?'회수할 추가 구매비 없음':r.years==null?'현재 조건에서는 회수 불가':r.years>30?'30년 초과':r.years<.1?'0.1년 미만':r.years.toFixed(1)+'년';
 function pair(){return data.pairs.find(p=>p.slug===choice?.value)||data.pairs[0]}
 for(const [key,input]of [['km',km],['price',price],['gap',gap]])if(input&&params.has(key))input.value=params.get(key);
 if(choice&&data.pairs.some(p=>p.slug===params.get('pair')))choice.value=params.get('pair');
 function row(values){const tr=document.createElement('tr');values.forEach((value,i)=>{const td=document.createElement(i?'td':'th');td.textContent=value;tr.append(td)});return tr}
 function render(sync=false){
  const p=pair(),valid=km.validity.valid&&price.validity.valid&&Number.isFinite(km.valueAsNumber)&&Number.isFinite(price.valueAsNumber),body=$('decision-scenarios');
  if(choice){$('decision-note').textContent=p.note;$('decision-specs').textContent='가솔린: '+p.left.label+' / 하이브리드: '+p.right.label;const links=$('decision-sources').querySelectorAll('a');links[0].href=p.left.source;links[1].href=p.right.source;links[2].href='../../compare/'+p.slug+'/';}
  if(!valid){$('decision-a').textContent='—';$('decision-b').textContent='—';$('decision-saving').textContent='거리와 단가를 확인하세요';if(gap)$('decision-years').textContent='거리와 단가를 확인하세요';body.replaceChildren(row(['입력값 확인','—','—']));return;}
  const c=CAR_DECISION_MATH.compare(p.left,p.right,km.valueAsNumber,price.valueAsNumber);$('decision-a').textContent=fmt(c.a.total);$('decision-b').textContent=fmt(c.b.total);$('decision-saving').textContent=data.kind==='hybrid'?(c.saving>=0?'하이브리드가 연 '+fmt(c.saving)+' 적음':'하이브리드가 연 '+fmt(-c.saving)+' 더 듦'):label(c.saving);
  const gapValid=gap&&gap.validity.valid&&Number.isFinite(gap.valueAsNumber);if(gap)$('decision-years').textContent=gapValid?years(CAR_DECISION_MATH.payback(p.left,p.right,km.valueAsNumber,price.valueAsNumber,gap.valueAsNumber)):'구매가격 차이를 입력하세요';
  body.replaceChildren(...(gap?[5000,10000,15000,20000,30000]:[10000,20000,30000]).map(k=>{const c=CAR_DECISION_MATH.compare(p.left,p.right,k,price.valueAsNumber);return row(gap?[k.toLocaleString('ko-KR')+'km',fmt(c.saving),gapValid?years(CAR_DECISION_MATH.payback(p.left,p.right,k,price.valueAsNumber,gap.valueAsNumber)):'가격 차이 입력 후 계산']:[k.toLocaleString('ko-KR')+'km',fmt(c.a.total),fmt(c.b.total),fmt(c.saving)])}));
  if(sync){const url=new URL(location.href);url.searchParams.set('km',km.value);url.searchParams.set('price',price.value);if(choice)url.searchParams.set('pair',choice.value);if(gap){if(gapValid)url.searchParams.set('gap',gap.value);else url.searchParams.delete('gap')}history.replaceState(null,'',url)}
 }
 form.addEventListener('input',()=>render(true));form.addEventListener('change',()=>render(true));form.addEventListener('submit',e=>{e.preventDefault();render(true)});render();
})();
