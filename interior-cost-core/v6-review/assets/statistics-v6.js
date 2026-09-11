(()=>{
  const scriptUrl=document.currentScript?.src||location.href;
  const dataUrl=new URL('../data/quote-public-segments.json',scriptUrl);
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const WORK=['철거','폐기물','방수','욕실','주방','도배','바닥','목공','전기','창호','현장관리비','VAT'];
  const FIELDS=['region_level1','pyeong_band','scope','bathroom_count','window_status','vat_status','waste_status'];
  const QUERY={region_level1:'region',pyeong_band:'pyeong',scope:'scope',bathroom_count:'bath',window_status:'window',vat_status:'vat',waste_status:'waste'};
  const LABELS={region_level1:'지역',pyeong_band:'평수',scope:'공사범위',bathroom_count:'욕실 수',window_status:'샷시',vat_status:'VAT',waste_status:'폐기물'};
  const DISPLAY={included:'포함',excluded:'제외',separate:'별도','3+':'3개 이상'};
  let dataset={segments:[],minimum_public_sample:80,status:'no_public_segment'};
  const money=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('ko-KR')+'만원':'—';
  const text=(sel,val)=>{const el=$(sel);if(el)el.textContent=val};
  const display=v=>DISPLAY[String(v)]||String(v||'—');
  const svg=(tag,attrs={})=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));return el};
  const clear=el=>{while(el?.firstChild)el.removeChild(el.firstChild)};
  function selected(){const out={};FIELDS.forEach(k=>out[k]=$(`[data-stat-filter="${k}"]`)?.value||'');return out}
  function same(a,b){return FIELDS.every(k=>String(a[k]??'')===String(b?.[k]??''))}
  function findSegment(){const wanted=selected();return(dataset.segments||[]).find(s=>same(wanted,s.dimensions))||null}
  function applyQuery(){const p=new URLSearchParams(location.search);FIELDS.forEach(k=>{const value=p.get(QUERY[k]),el=$(`[data-stat-filter="${k}"]`);if(!value||!el)return;const ok=[...el.options].some(o=>o.value===value);if(ok)el.value=value})}
  function syncQuery(){const u=new URL(location.href);u.search='';const s=selected();FIELDS.forEach(k=>u.searchParams.set(QUERY[k],s[k]));history.replaceState(null,'',u)}
  function shareUrl(){const u=new URL(location.href);u.search='';const s=selected();FIELDS.forEach(k=>u.searchParams.set(QUERY[k],s[k]));return u.href}
  function renderConditions(){const dl=$('[data-condition-ledger]');if(!dl)return;clear(dl);const s=selected();FIELDS.forEach(k=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=LABELS[k];dd.textContent=display(s[k]);row.append(dt,dd);dl.append(row)})}
  function drawTotal(seg){
    const chart=$('[data-total-range]');if(!chart)return;clear(chart);
    const stats=seg.total_amount_manwon||{},user=Number($('[data-user-total]')?.value||0);
    const base=[Number(stats.p25),Number(stats.median),Number(stats.p75)].filter(Number.isFinite);if(base.length!==3)return;
    const vals=user>0?[...base,user]:base,lo0=Math.min(...vals),hi0=Math.max(...vals),spread=Math.max(500,hi0-lo0),lo=Math.max(0,lo0-spread*.22),hi=hi0+spread*.22;
    const x=v=>64+(Number(v)-lo)/(hi-lo)*672;
    chart.setAttribute('viewBox','0 0 800 160');
    chart.append(svg('line',{x1:64,y1:82,x2:736,y2:82,stroke:'#9d978c','stroke-width':1}));
    [0,.25,.5,.75,1].forEach(t=>{const xx=64+672*t;chart.append(svg('line',{x1:xx,y1:70,x2:xx,y2:94,stroke:'#c9c2b7','stroke-width':1}));const tx=svg('text',{x:xx,y:122,'text-anchor':'middle',fill:'#625e57','font-size':10});tx.textContent=Math.round(lo+(hi-lo)*t).toLocaleString('ko-KR');chart.append(tx)});
    chart.append(svg('rect',{x:x(stats.p25),y:68,width:Math.max(2,x(stats.p75)-x(stats.p25)),height:28,fill:'#ece6da',stroke:'#9d978c','stroke-width':1}));
    chart.append(svg('line',{x1:x(stats.median),y1:54,x2:x(stats.median),y2:106,stroke:'#171816','stroke-width':2}));
    [['P25',stats.p25],['중앙값',stats.median],['P75',stats.p75]].forEach(([label,val])=>{const tx=svg('text',{x:x(val),y:42,'text-anchor':'middle',fill:label==='중앙값'?'#a52b20':'#625e57','font-size':11,'font-weight':label==='중앙값'?700:500});tx.textContent=label;chart.append(tx)});
    if(user>0){chart.append(svg('circle',{cx:x(user),cy:82,r:7,fill:'#a52b20',stroke:'#fbfaf6','stroke-width':2}));const tx=svg('text',{x:x(user),y:151,'text-anchor':'middle',fill:'#a52b20','font-size':10,'font-weight':700});tx.textContent='내 견적';chart.append(tx)}
    text('[data-total-p25]',money(stats.p25));text('[data-total-median]',money(stats.median));text('[data-total-p75]',money(stats.p75));text('[data-total-user]',user>0?money(user):'미입력');
  }
  function renderWork(seg){
    const host=$('[data-work-distribution]'),tbody=$('[data-work-table]');if(!host||!tbody)return;clear(host);clear(tbody);
    const min=Number(dataset.minimum_public_sample||80),stats=seg.work_items||{},visible=WORK.map(k=>stats[k]).filter(s=>s&&Number(s.sample_count)>=min&&Number.isFinite(Number(s.p75))),max=Math.max(1,...visible.map(s=>Number(s.p75)))*1.08;
    WORK.forEach(name=>{
      const s=stats[name],ok=!!s&&Number(s.sample_count)>=min;
      const row=document.createElement('div');row.className='work-dist-row';row.dataset.state=ok?'ready':'hidden';
      const n=document.createElement('div');n.className='work-dist-name';n.textContent=name;
      const track=document.createElement('div');track.className='work-dist-track';
      if(ok){const band=document.createElement('i'),med=document.createElement('i');band.className='work-dist-band';med.className='work-dist-median';const left=Math.max(0,Number(s.p25)/max*100),right=Math.max(left,Number(s.p75)/max*100),m=Math.max(0,Number(s.median)/max*100);band.style.left=left+'%';band.style.width=Math.max(.8,right-left)+'%';med.style.left=m+'%';track.append(band,med)}
      const values=document.createElement('div');values.className='work-dist-values';[ok?`${Number(s.sample_count).toLocaleString('ko-KR')}건`:'표본 미충족',ok?money(s.p25):'—',ok?money(s.median):'—',ok?money(s.p75):'—'].forEach(v=>{const span=document.createElement('span');span.textContent=v;values.append(span)});row.append(n,track,values);host.append(row);
      const tr=document.createElement('tr'),th=document.createElement('th');th.scope='row';th.textContent=name;tr.append(th);[ok?`${Number(s.sample_count).toLocaleString('ko-KR')}건`:'—',ok?money(s.p25):'—',ok?money(s.median):'—',ok?money(s.p75):'—',ok?'공개':'미공개'].forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(!ok&&i===4)td.className='private';tr.append(td)});tbody.append(tr);
    })
  }
  function locked(message='공개 세그먼트 없음'){
    $('[data-stat-empty]')?.removeAttribute('hidden');$$('[data-stat-content]').forEach(el=>el.hidden=true);
    text('[data-stat-state]',message);text('[data-stat-count]','—');text('[data-stat-period]','—');text('[data-stat-outlier]','—');
  }
  function render(){
    renderConditions();const seg=findSegment();if(!seg){locked(dataset.status==='load_error'?'데이터 로드 실패':'공개 기준 미충족');return}
    $('[data-stat-empty]')?.setAttribute('hidden','');$$('[data-stat-content]').forEach(el=>el.hidden=false);
    text('[data-stat-state]','공개 세그먼트');text('[data-stat-count]',`${Number(seg.sample_count||0).toLocaleString('ko-KR')}건`);text('[data-stat-period]',`${seg.period?.from||'—'} ~ ${seg.period?.to||'—'}`);text('[data-stat-outlier]',`${Number(seg.excluded_outlier_count||0).toLocaleString('ko-KR')}건`);
    drawTotal(seg);renderWork(seg);
  }
  async function load(){try{const r=await fetch(dataUrl,{cache:'no-store'});if(!r.ok)throw new Error('dataset');const d=await r.json();if(!Array.isArray(d?.segments)||Number(d?.minimum_public_sample)!==80)throw new Error('contract');dataset=d}catch{dataset={segments:[],minimum_public_sample:80,status:'load_error'}}render()}
  applyQuery();syncQuery();
  $$('[data-stat-filter]').forEach(el=>el.addEventListener('change',()=>{syncQuery();render()}));
  $('[data-user-total]')?.addEventListener('input',()=>{const seg=findSegment();if(seg)drawTotal(seg)});
  $('[data-copy-stat-url]')?.addEventListener('click',async e=>{const b=e.currentTarget,original=b.textContent;try{await navigator.clipboard.writeText(shareUrl());b.textContent='복사됨'}catch{b.textContent='복사 실패'}setTimeout(()=>b.textContent=original,1200)});
  load();
})();
