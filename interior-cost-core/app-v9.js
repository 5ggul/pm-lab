(()=>{
  const money=n=>Number.isFinite(n)?`${Math.round(n).toLocaleString('ko-KR')}만원`:'—';
  const text=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
  function rowState(row,vendor){
    const state=row.querySelector(`[data-vendor="${vendor}"][data-state]`)?.value||'missing';
    const amount=Number(row.querySelector(`[data-vendor="${vendor}"][data-amount]`)?.value||0);
    return {state,amount:Number.isFinite(amount)?amount:0};
  }
  function renderMatrix(){
    const host=document.querySelector('[data-v9-compare-matrix]');
    const root=document.querySelector('[data-compare-table]');
    if(!host||!root)return;
    const rows=[...root.querySelectorAll('[data-compare-row]')];
    const vendors=['a','b','c'];
    const summary={a:{included:0,separate:0,missing:0,amount:0},b:{included:0,separate:0,missing:0,amount:0},c:{included:0,separate:0,missing:0,amount:0}};
    const body=host.querySelector('[data-v9-matrix-body]');
    body.innerHTML=rows.map(row=>{
      const label=text(row.querySelector('h3')).replace(/조건 다름|차이/g,'').trim();
      const cells=vendors.map(v=>{
        const s=rowState(row,v);summary[v][s.state]=(summary[v][s.state]||0)+1;summary[v].amount+=s.amount;
        const cls=s.state==='missing'?'missing':s.state==='separate'?'separate':'included';
        const stateLabel=s.state==='included'?'포함':s.state==='separate'?'별도':'미기재';
        return `<td class="${cls}">${stateLabel}${s.amount>0?` · ${money(s.amount)}`:''}</td>`;
      }).join('');
      return `<tr><th>${label}</th>${cells}</tr>`;
    }).join('')||'<tr><td colspan="4">비교 항목 없음</td></tr>';
    vendors.forEach(v=>{
      const box=host.querySelector(`[data-v9-summary="${v}"]`);if(!box)return;
      const s=summary[v];box.querySelector('[data-v9-summary-main]').textContent=`미기재 ${s.missing} · 별도 ${s.separate}`;
      box.querySelector('[data-v9-summary-sub]').textContent=`입력금액 합계 ${money(s.amount)}`;
    });
    const flags=vendors.map(v=>summary[v].missing===0);
    const gate=host.querySelector('[data-v9-condition-gate]');
    if(gate)gate.textContent=flags.every(Boolean)?'A/B/C 조건 기재 완료 · 금액 구성 비교 가능':'미기재 조건 있음 · 최저가/적정가 판단 보류';
  }
  function bindMatrix(){
    if(!document.querySelector('[data-v9-compare-matrix]'))return;
    document.addEventListener('input',e=>{if(e.target.matches('[data-compare-table] input,[data-compare-table] select'))renderMatrix()});
    document.addEventListener('change',e=>{if(e.target.matches('[data-compare-table] input,[data-compare-table] select'))renderMatrix()});
    renderMatrix();
  }
  function bindTopicFilter(){
    const input=document.querySelector('[data-v9-topic-search]');if(!input)return;
    const cards=[...document.querySelectorAll('[data-v9-topic-item]')];
    const run=()=>{const q=input.value.trim().toLowerCase();cards.forEach(c=>c.hidden=q&&!c.dataset.v9TopicItem.toLowerCase().includes(q))};
    input.addEventListener('input',run);
  }
  function boot(){bindMatrix();bindTopicFilter()}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();
