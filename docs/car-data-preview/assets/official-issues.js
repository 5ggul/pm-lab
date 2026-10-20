(function(){
 'use strict';
 const tabs=[...document.querySelectorAll('[data-issues-tab]')];
 if(!tabs.length)return;
 const $=id=>document.getElementById(id),panels=[...document.querySelectorAll('[data-issues-panel]')];
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>Number(n).toLocaleString('ko-KR');
 const norm=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]/gu,'');
 const month=s=>/^\d{4}-(?:0[1-9]|1[0-2])$/.test(s||'')?s:'';
 const date=s=>{if(!s)return '확인 기록 없음';const d=new Date(s);return Number.isNaN(d.valueOf())?'확인 기록 없음':d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+' KST'};
 const sourceDate=s=>/^\d{4}-\d{2}-\d{2}/.test(s||'')?s.slice(0,10):'제공되지 않음';
 let index=null,checkStatus=null,loading=null,shown=12,currentTab='recalls';
 let manualRecall=new URLSearchParams(location.search).has('q'),syncingRecall=false;
 let state={family:'',maker:'',query:'',modelYear:'',from:'',to:''};
 const recallContext=document.createElement('p');recallContext.id='issues-recall-context';recallContext.className='issues-filter-caption';recallContext.setAttribute('role','status');recallContext.hidden=true;
 $('recall-search').after(recallContext);
 function recallQuery(value){syncingRecall=true;try{$('recall-q').value=value;$('recall-q').dispatchEvent(new Event('input',{bubbles:true}))}finally{syncingRecall=false}}
 function syncRecall(failed=false){
  if(currentTab!=='recalls')return;
  if(manualRecall){recallContext.hidden=true;return}
  if(!state.family){recallQuery('');recallContext.hidden=true;return}
  recallContext.hidden=false;
  if(!index){recallQuery('');recallContext.textContent=failed?'차종 정보를 불러오지 못해 전체 최근 공지를 표시합니다. 위 검색에 차명을 직접 입력하세요.':'차종 연결을 확인하는 동안 전체 최근 공지를 표시합니다.';return}
  const family=index.families.find(f=>f.family_id===state.family);
  if(!family){recallQuery('');recallContext.textContent='주소에 지정된 차종을 찾을 수 없어 전체 최근 공지를 표시합니다. 위 검색에서 차명을 입력하세요.';return}
  recallQuery(family.name);recallContext.textContent=family.name+' 차명이 포함된 최근 공지를 표시합니다. 생산기간과 대상 사양은 각 공지에서 확인하세요.';
 }
 $('recall-q').addEventListener('input',()=>{if(syncingRecall)return;manualRecall=true;recallContext.hidden=true;const u=new URL(location.href);u.searchParams.set('q',$('recall-q').value);history.replaceState(null,'',u)});
 const urlState=()=>{const p=new URLSearchParams(location.search);return {family:p.get('family')||'',maker:p.get('maker')||'',query:p.get('reportQ')||'',modelYear:p.get('modelYear')||'',from:p.get('from')||'',to:p.get('to')||''}};
 function save(push=false){
  const u=new URL(location.href);u.searchParams.set('tab',currentTab);u.hash='';
  for(const [key,value] of Object.entries({family:state.family,maker:state.maker,reportQ:state.query,modelYear:state.modelYear,from:state.from,to:state.to}))value?u.searchParams.set(key,value):u.searchParams.delete(key);
  (push?history.pushState:history.replaceState).call(history,null,'',u);
 }
 function selectTab(name,push=false){
  currentTab=name==='service'?'free-repairs':['recalls','reports','free-repairs'].includes(name)?name:'recalls';
  tabs.forEach(t=>{const active=t.dataset.issuesTab===currentTab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1});
  panels.forEach(p=>p.hidden=p.dataset.issuesPanel!==currentTab);
  if(push)save(true);
  if(currentTab==='reports')load();
  if(currentTab==='recalls'){syncRecall();if(state.family&&!manualRecall&&!index)load()}
 }
 tabs[0].parentElement.setAttribute('role','tablist');
 tabs.forEach((tab,i)=>{
  tab.setAttribute('role','tab');tab.setAttribute('aria-controls','issues-'+tab.dataset.issuesTab);
  tab.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();selectTab(tab.dataset.issuesTab,true)});
  tab.addEventListener('keydown',e=>{let n=null;if(e.key==='ArrowRight')n=(i+1)%tabs.length;if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;if(e.key==='Home')n=0;if(e.key==='End')n=tabs.length-1;if(e.key===' '){e.preventDefault();selectTab(tab.dataset.issuesTab,true)}if(n!==null){e.preventDefault();tabs[n].focus();selectTab(tabs[n].dataset.issuesTab,true)}});
 });
 panels.forEach(p=>p.setAttribute('role','tabpanel'));
 function sourceSummary(source){
  if(!source?.available)return '공식 신고 자료를 불러오지 못했습니다. 조회 실패를 신고 0건으로 표시하지 않습니다.';
  const period=source.period||{},range=period.from&&period.to?`수록된 접수일 범위 ${sourceDate(period.from)}–${sourceDate(period.to)}`:'접수일 범위가 확인되지 않은 자료';
  const status=checkStatus?.source_states?.reports||checkStatus;
  const checked=Date.parse(status?.checked_at||source.checked_at),late=Number.isFinite(checked)&&Date.now()-checked>30*60*60*1000;
  const failed=status?.ok===false;
  return `${range} · 연간 공개 파일 · 원천 갱신 ${sourceDate(source.provider_updated_at)}${failed?' · 최근 변경 확인 실패: 마지막 정상 자료 표시':late?' · 변경 확인 지연':''}`;
 }
 function method(source){
  const p=source.period||{};
  $('issues-method-content').innerHTML=`<dl class="issues-provenance"><div><dt>공식 제공기관</dt><dd>한국교통안전공단</dd></div><div><dt>수록된 접수일 범위</dt><dd>${escape(p.from&&p.to?`${p.from}–${p.to}`:'확인되지 않음')}</dd></div><div><dt>갱신 주기</dt><dd>공식 파일 연간 갱신 · 파일 변경 확인과 구분</dd></div><div><dt>원천 갱신일</dt><dd>${escape(sourceDate(source.provider_updated_at))}</dd></div><div><dt>파일 변경 확인 시각</dt><dd>${escape(date(checkStatus?.source_states?.reports?.checked_at||checkStatus?.checked_at||source.checked_at))}</dd></div><div><dt>원본 행 수</dt><dd>${Number.isInteger(source.rows)?fmt(source.rows)+'건':'확인되지 않음'}</dd></div><div><dt>차종 연결</dt><dd>${Number.isInteger(source.matched_rows)?fmt(source.matched_rows)+'건 연결':'확인되지 않음'}${Number.isInteger(source.unmatched_rows)?' · '+fmt(source.unmatched_rows)+'건 미연결':''}${Number.isInteger(source.held_rows)?' · '+fmt(source.held_rows)+'건 검토 대기':''}</dd></div></dl><p>공개 파일의 접수일자·제작사·차명·모델연도만 집계합니다. 상세 증상·발생 주행거리·수리비·확정 결함 여부는 포함되지 않습니다. 수록일 범위는 관측된 행의 최소·최대 접수일이며 전체 기간의 완전성을 뜻하지 않습니다. 접수기간은 차량의 생산기간과 다릅니다. 세대를 특정할 수 없는 신고는 특정 세대로 나누지 않습니다.</p>`;
 }
 async function load(){
  if(index){render();syncRecall();return}if(loading)return loading;
  $('issues-source-status').textContent='공식 신고 자료를 불러오고 있습니다.';
  loading=(async()=>{try{
   const response=await fetch('../data/generated/official-issues-index.json',{cache:'no-cache'});
   if(!response.ok)throw new Error('http');const data=await response.json();
   if(data.schema_version!==1||!Array.isArray(data.families)||!data.sources?.reports)throw new Error('schema');
   index=data;const source=index.sources.reports;syncRecall();
   try{const statusResponse=await fetch('../data/generated/official-issues-status.json',{cache:'no-cache'});if(statusResponse.ok){const status=await statusResponse.json();if(typeof status.ok==='boolean')checkStatus=status}}catch{ /* Keep the original file verification record if optional status is unavailable. */ }
   $('issues-source-status').textContent=sourceSummary(source);method(source);
   if(!source.available){$('issues-report-result').innerHTML='<p class="issues-empty">공식 파일 확인 후 집계를 제공하겠습니다. <a href="https://www.data.go.kr/data/15016450/fileData.do" target="_blank" rel="noopener noreferrer">공식 자료 확인 (외부)</a></p>';return}
   const makers=[...new Set(index.families.map(f=>f.maker).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
   $('issues-maker').innerHTML='<option value="">전체 제조사</option>'+makers.map(m=>`<option value="${escape(m)}">${escape(m)}</option>`).join('');
   $('issues-filter').hidden=false;render();
  }catch{
   syncRecall(true);
   $('issues-source-status').textContent='공식 신고 자료를 불러오지 못했습니다. 조회 실패를 신고 0건으로 표시하지 않습니다.';
   $('issues-report-result').innerHTML='<p class="issues-empty">연결을 확인한 뒤 다시 시도해 주세요. <button id="issues-retry" type="button">다시 불러오기</button></p>';
   $('issues-retry').addEventListener('click',()=>{loading=null;load()});
  }finally{loading=null}})();return loading;
 }
 function chart(title,items,label){
  if(!items.length)return `<section class="issues-chart"><h3>${escape(title)}</h3><p class="issues-empty">이 조건에 해당하는 집계가 없습니다.</p></section>`;
  const max=Math.max(...items.map(i=>i.count),1);
  return `<section class="issues-chart"><h3>${escape(title)}</h3><div class="issues-chart-bars">${items.map(i=>`<div class="issues-bar-row"><span>${escape(i.label)}</span><div class="issues-bar-track" aria-hidden="true"><span style="width:${Math.min(100,i.count/max*100).toFixed(3)}%"></span></div><strong>${fmt(i.count)}건</strong></div>`).join('')}</div><details class="issues-chart-table"><summary>수치 표 보기</summary><table><caption>${escape(title)}</caption><thead><tr><th scope="col">${escape(label)}</th><th scope="col">신고 건수</th></tr></thead><tbody>${items.map(i=>`<tr><th scope="row">${escape(i.label)}</th><td>${fmt(i.count)}건</td></tr>`).join('')}</tbody></table></details></section>`;
 }
 function overview(){
  const source=index.sources.reports;
  return `<div class="issues-overview"><h3>차량을 선택하세요</h3><p>선택한 차종의 모델연도별·접수월별 신고 기록을 확인할 수 있습니다.</p><dl><div><dt>공식 파일 전체</dt><dd>${Number.isInteger(source.rows)?fmt(source.rows)+'건':'집계 확인 중'}</dd></div><div><dt>수록 접수기간</dt><dd>${escape(source.period?.from&&source.period?.to?source.period.from+'–'+source.period.to:'확인되지 않음')}</dd></div></dl><p class="issues-filter-caption">전체 신고를 특정 차종에 연결하지 못한 기록도 포함합니다. 차종별 수를 합쳐 전체와 같은 것으로 표시하지 않습니다.</p></div>`;
 }
 function historical(family){
  const rows=family.historical_recalls||[];
  if(!rows.length)return '';
  const source=index.sources.recalls||{};
  return `<details class="issues-history"><summary>공식 파일의 리콜 이력 ${fmt(rows.length)}건</summary><p class="issues-filter-caption">연간 공개 파일의 이력입니다. 위 리콜 탭의 최근 공지와 합산하지 않습니다. 원천 갱신 ${escape(sourceDate(source.provider_updated_at))}</p><ul>${rows.map(r=>`<li><div><strong>${escape(r.model)}</strong><time>${escape(r.recall_start||'개시일 미상')}</time></div><p>${escape(r.reason||'공식 자료에서 조치 내용을 확인하세요.')}</p><p class="issues-filter-caption">생산기간 ${escape(r.production_from||'미상')}–${escape(r.production_to||'미상')}</p></li>`).join('')}</ul><a href="https://www.car.go.kr/ri/stat/list.do" target="_blank" rel="noopener noreferrer">공식 리콜 공지 확인 (외부)</a></details>`;
 }
 function render(){
  if(!index?.sources.reports.available)return;
  const family=index.families.find(f=>f.family_id===state.family),query=norm(state.query);
  if(family&&state.maker&&state.maker!==family.maker){state.maker=family.maker;save()}
  if($('issues-q').value!==state.query)$('issues-q').value=state.query;$('issues-maker').value=state.maker;
  const matches=index.families.filter(f=>(!state.maker||f.maker===state.maker)&&(!query||norm(f.maker+' '+f.name+' '+(f.source_names||[]).join(' ')).includes(query))).sort((a,b)=>Number(b.match_status==='verified')-Number(a.match_status==='verified')||(a.maker+' '+a.name).localeCompare(b.maker+' '+b.name,'ko'));
  $('issues-family-list').hidden=Boolean(family);$('issues-more').hidden=Boolean(family)||matches.length<=shown;
  $('issues-match-count').hidden=Boolean(family);
  $('issues-match-count').textContent=matches.length?`${fmt(matches.length)}개 차종 · 차종을 선택하면 신고 기록을 표시합니다.`:'조건에 맞는 차량이 없습니다. 검색어 또는 제조사를 바꿔 주세요.';
  $('issues-family-list').innerHTML=matches.slice(0,shown).map(f=>`<button type="button" data-issues-family="${escape(f.family_id)}"><span>${escape(f.maker)}</span><strong>${escape(f.name)}</strong><span>${f.match_status==='verified'?'공식 차명 연결 확인':'차명 연결 검토 중'}</span></button>`).join('');
  $('issues-selected').hidden=!family;$('issues-period-fields').hidden=!family;
  $('issues-filter-error').hidden=true;
  if(!family){$('issues-report-result').innerHTML=state.family?'<p class="issues-empty">주소에 지정된 차종을 찾을 수 없습니다. 위 검색에서 차종을 다시 선택하세요.</p>':overview();return}
  $('issues-family-name').textContent=family.maker+' '+family.name;
  const years=(family.by_model_year||[]).map(y=>String(y.year??'')).filter(Boolean).sort((a,b)=>b.localeCompare(a));
  if(state.modelYear&&!years.includes(state.modelYear))years.unshift(state.modelYear);
  $('issues-model-year').innerHTML='<option value="">전체 모델연도</option>'+years.map(y=>`<option value="${escape(y)}">${escape(y)}${/^\d{4}$/.test(y)?'년':' (원문)'}</option>`).join('');
  $('issues-model-year').value=state.modelYear;$('issues-from').value=month(state.from);$('issues-to').value=month(state.to);
  if((state.from&&!month(state.from))||(state.to&&!month(state.to))||(state.from&&state.to&&state.from>state.to)){
   $('issues-filter-error').hidden=false;$('issues-filter-error').textContent='접수월 범위를 확인하세요. 시작월은 종료월보다 늦을 수 없습니다.';$('issues-report-result').innerHTML='';return;
  }
  if(family.match_status!=='verified'){
   $('issues-period-fields').hidden=true;
   $('issues-report-result').innerHTML='<p class="issues-empty">이 차량은 공식 자료의 차명 연결을 검토하고 있습니다. 신고 0건이나 결함 없음으로 판단하지 않습니다.</p>'+historical(family);return;
  }
  const originalYears=(family.by_model_year||[]).map(y=>String(y.year??''));
  if(state.modelYear&&!originalYears.includes(state.modelYear)){
   $('issues-report-result').innerHTML='<p class="issues-empty">선택한 모델연도는 이 차종의 수록 자료에서 확인되지 않았습니다. 해당 연도의 신고가 없다는 뜻은 아닙니다.</p>'+historical(family);return;
  }
  const range=index.sources.reports.period||{},low=month(String(range.from||'').slice(0,7)),high=month(String(range.to||'').slice(0,7));
  if((state.from&&high&&state.from>high)||(state.to&&low&&state.to<low)){
   $('issues-report-result').innerHTML='<p class="issues-empty">선택한 접수기간은 수록된 접수일 범위 밖입니다. 이 기간의 신고 여부를 확인할 수 없습니다.</p>'+historical(family);return;
  }
  const records=family.reports||[];
  const filtered=records.filter(r=>(!state.modelYear||String(r.model_year??'')===state.modelYear)&&(!state.from||(r.received_month&&r.received_month>=state.from))&&(!state.to||(r.received_month&&r.received_month<=state.to)));
  const count=filtered.reduce((n,r)=>n+Number(r.count||0),0);
  const byYear=new Map(),byMonth=new Map();
  filtered.forEach(r=>{const year=r.model_year==null?'모델연도 미상':String(r.model_year)+'년',m=r.received_month||'접수월 미상';byYear.set(year,(byYear.get(year)||0)+r.count);byMonth.set(m,(byMonth.get(m)||0)+r.count)});
  const periods=[state.modelYear?state.modelYear+' 모델연도':'전체 모델연도',state.from||state.to?(state.from||'수록 시작')+'–'+(state.to||'수록 종료')+' 접수':'전체 접수기간'];
  $('issues-report-result').innerHTML=`<div class="issues-report-summary"><div><p>${escape(periods.join(' · '))}</p><h3>${escape(family.name)} 공식 접수 기록</h3></div><p class="issues-report-number">${fmt(count)}<span>건</span></p></div><p class="issues-filter-caption">${count?'수록 자료에서 차종명을 연결한 신고 건수입니다. 같은 이름의 이전 연식·세대가 포함될 수 있습니다.':'수록 자료에서 연결된 신고가 0건입니다. 차량의 결함이나 신고 이력이 없다는 뜻은 아닙니다.'}${state.from||state.to?' 선택 기간 중 공개 파일에 수록된 기록만 집계합니다.':''}</p>${count?'<div class="issues-chart-grid">'+chart('모델연도별',Array.from(byYear,([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label)),'모델연도')+chart('접수월별',Array.from(byMonth,([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label)),'접수월')+'</div>':'<p class="issues-empty">다른 모델연도·접수기간을 선택하거나 공식 자료를 확인하세요.</p>'}${historical(family)}`;
 }
 $('issues-filter').addEventListener('submit',e=>{e.preventDefault();save(true);render()});
 $('issues-q').addEventListener('input',e=>{state.query=e.target.value;state.family='';state.modelYear='';shown=12;save();render()});
 $('issues-maker').addEventListener('change',e=>{state.maker=e.target.value;state.family='';state.modelYear='';shown=12;save(true);render()});
 $('issues-family-list').addEventListener('click',e=>{const b=e.target.closest('[data-issues-family]');if(!b)return;state.family=b.dataset.issuesFamily;state.modelYear='';state.from='';state.to='';save(true);render();($('issues-period-fields').hidden?$('issues-clear'):$('issues-model-year')).focus({preventScroll:true});$('issues-family-name').scrollIntoView({block:'nearest'})});
 $('issues-more').addEventListener('click',()=>{const previous=shown;shown+=12;render();$('issues-family-list').children[previous]?.focus({preventScroll:true})});
 $('issues-clear').addEventListener('click',()=>{state.family='';state.modelYear='';state.from='';state.to='';save(true);render();$('issues-q').focus()});
 for(const [id,key] of [['issues-model-year','modelYear'],['issues-from','from'],['issues-to','to']])$(id).addEventListener('change',e=>{state[key]=e.target.value;save(true);render()});
 addEventListener('popstate',()=>{const p=new URLSearchParams(location.search);state=urlState();manualRecall=p.has('q');if(manualRecall)recallQuery(p.get('q')||'');shown=12;selectTab(p.get('tab'));if(index)render()});
 state=urlState();selectTab(new URLSearchParams(location.search).get('tab'));
})();
