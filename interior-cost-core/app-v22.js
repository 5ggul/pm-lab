(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const fmt=n=>Number(n||0).toLocaleString('ko-KR',{maximumFractionDigits:0});
  const money=n=>Number.isFinite(Number(n))?`${fmt(Math.round(Number(n)))}원`:'-';
  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const parse=(sel,root=document)=>{try{return JSON.parse($(sel,root)?.textContent||'null')}catch{return null}};

  function initQuoteLines(){
    const root=$('[data-v22-tool]');if(!root)return;
    const config=parse('[data-v22-config]',root)||{};
    const refs=config.references||{},trades=config.trades||[],max=Number(config.rules?.max_lines||12);
    const tradeMap=new Map(trades.map(t=>[t.id,t]));
    const linesHost=$('[data-v22-lines]',root),pyeong=$('[data-v22-pyeong]',root),addBtn=$('[data-v22-add-line]',root);
    let seq=0;
    const sourceMeta={material:['시설공통자재','material'],market:['시장시공가격','market'],standard:['표준시장단가','standard']};

    const refLabel=r=>{
      const detail=r.detail?` · ${r.detail}`:'';
      return `${r.label}${detail} · 중앙 ${money(r.median_krw)}/${r.unit_key} · N=${Number(r.record_count||0).toLocaleString('ko-KR')}`;
    };
    const tradeOptions=()=>'<option value="">공종 선택</option>'+trades.map(t=>`<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('');
    const lineHtml=id=>`<article class="v22-line" data-v22-line data-line-id="${id}">
      <div class="v22-line-head"><div><span>견적 항목</span><strong data-v22-line-title>공종을 선택하세요.</strong></div><button type="button" data-v22-remove-line aria-label="이 항목 삭제">삭제</button></div>
      <div class="v22-line-grid">
        <label>항목명<input data-v22-item-name type="text" maxlength="80" placeholder="예: 거실 실크벽지"></label>
        <label>공종<select data-v22-trade>${tradeOptions()}</select></label>
        <label>단위<select data-v22-unit disabled><option value="">공종 선택</option></select></label>
        <label>수량<input data-v22-qty type="number" min="0" step="0.01" inputmode="decimal" placeholder="예: 42.5"></label>
        <label>내 견적 단가<input data-v22-price type="number" min="0" step="1" inputmode="numeric" placeholder="원 / 단위"></label>
        <label class="v22-confirm"><input data-v22-confirm type="checkbox"> 범위·규격·포함조건 확인</label>
      </div>
      <div class="v22-source-selects">
        <label><span>시설공통자재</span><select data-v22-ref-material disabled><option value="">공종·단위 선택</option></select></label>
        <label><span>건축 시장시공가격</span><select data-v22-ref-market disabled><option value="">공종·단위 선택</option></select></label>
        <label><span>건축공사 표준시장단가</span><select data-v22-ref-standard disabled><option value="">공종·단위 선택</option></select></label>
      </div>
      <div class="v22-line-result" data-v22-line-result><p>공종과 단위를 선택하면 관련 공식 후보를 같은 단위 안에서 좁힙니다.</p></div>
      <div class="v22-line-route" data-v22-line-route></div>
    </article>`;

    const candidates=(tradeId,source,unit)=>{
      const t=tradeMap.get(tradeId);if(!t)return[];
      return (t.candidate_ids?.[source]||[]).map(id=>refs[id]).filter(r=>r&&(!unit||r.unit_key===unit));
    };
    function fillUnits(line){
      const tradeId=$('[data-v22-trade]',line)?.value||'',sel=$('[data-v22-unit]',line),t=tradeMap.get(tradeId);
      if(!sel)return;
      const units=t?.units||[];
      sel.disabled=!units.length;
      sel.innerHTML=units.length?units.map((u,i)=>`<option value="${esc(u)}"${u==='㎡'||(i===0&&!units.includes('㎡'))?' selected':''}>${esc(u)}</option>`).join(''):'<option value="">후보 없음</option>';
      fillRefs(line);updateLine(line);
    }
    function fillRefSelect(line,source){
      const tradeId=$('[data-v22-trade]',line)?.value||'',unit=$('[data-v22-unit]',line)?.value||'',sel=$(`[data-v22-ref-${source}]`,line);if(!sel)return;
      const list=candidates(tradeId,source,unit);sel.disabled=!list.length;
      const label=sourceMeta[source]?.[0]||source;
      sel.innerHTML=`<option value="">${list.length?`${label} 후보 ${list.length}개 · 직접 선택`:`${label} 관련 후보 없음`}</option>`+list.map(r=>`<option value="${esc(r.id)}">${esc(refLabel(r))}</option>`).join('');
    }
    function fillRefs(line){for(const s of Object.keys(sourceMeta))fillRefSelect(line,s)}
    function selectedRef(line,source){const id=$(`[data-v22-ref-${source}]`,line)?.value||'';return refs[id]||null}
    function routeFor(line){
      const p=pyeong?.value||'',t=$('[data-v22-trade]',line)?.value||'',host=$('[data-v22-line-route]',line);if(!host)return;
      const href=config.routes?.[`${p}:${t}`];const trade=tradeMap.get(t);
      host.innerHTML=href&&trade?`<a href="${esc(href)}">${esc(p)}평 ${esc(trade.label)} 데이터 경로 보기</a><span>평수는 작업수량으로 자동 변환하지 않습니다.</span>`:'';
    }
    function resultBlock(source,r,q,userTotal,confirmed){
      if(!r)return'';
      const total=q>0?r.median_krw*q:null,low=q>0&&Number.isFinite(Number(r.low_krw))?r.low_krw*q:null,high=q>0&&Number.isFinite(Number(r.high_krw))?r.high_krw*q:null;
      let delta='조건 확인 전';
      if(confirmed&&userTotal!==null&&total!==null){const d=total-userTotal;delta=`${d>=0?'+':''}${money(d)} 참고−견적`;}
      return `<div class="v22-result-card" data-source="${source}"><span>${esc(sourceMeta[source][0])}</span><strong>${esc(r.label)}</strong><small>${esc(r.detail||'')} · ${esc(r.unit_key)} · N=${fmt(r.record_count)}</small><div><b>중앙 ${money(r.median_krw)}</b><b>${q>0?`합계 ${money(total)}`:'수량 입력'}</b></div><p>${r.range_label}: ${money(r.low_krw)} ~ ${money(r.high_krw)}${q>0&&low!==null&&high!==null?` · 수량합 ${money(low)} ~ ${money(high)}`:''}</p><em>${esc(delta)}</em></div>`;
    }
    function updateLine(line){
      const tradeId=$('[data-v22-trade]',line)?.value||'',trade=tradeMap.get(tradeId),name=$('[data-v22-item-name]',line)?.value.trim()||'',unit=$('[data-v22-unit]',line)?.value||'',q=Number($('[data-v22-qty]',line)?.value||0),price=Number($('[data-v22-price]',line)?.value||0),confirmed=Boolean($('[data-v22-confirm]',line)?.checked),host=$('[data-v22-line-result]',line),title=$('[data-v22-line-title]',line);
      if(title)title.textContent=name||trade?.label||'공종을 선택하세요.';
      const userTotal=q>0&&price>0?q*price:null;
      const cards=Object.keys(sourceMeta).map(s=>resultBlock(s,selectedRef(line,s),q,userTotal,confirmed)).filter(Boolean);
      if(host){
        const user=`<div class="v22-user-total"><span>내 견적</span><strong>${price>0?`${money(price)} / ${esc(unit||'-')}`:'단가 입력'}</strong><b>${userTotal!==null?money(userTotal):'수량·단가 입력'}</b></div>`;
        const note=!trade?'공종을 선택하세요.':!unit?'비교 단위를 선택하세요.':cards.length?'':'공식 후보를 직접 선택하면 비교값이 표시됩니다.';
        host.innerHTML=user+(cards.length?`<div class="v22-result-cards">${cards.join('')}</div>`:`<p>${esc(note)}</p>`);
      }
      routeFor(line);updateSummary();
    }
    function updateSummary(){
      const lines=$$('[data-v22-line]',root),summary={user:{sum:0,n:0},material:{sum:0,n:0},market:{sum:0,n:0},standard:{sum:0,n:0}},usedTrades=new Set();
      for(const line of lines){
        const t=$('[data-v22-trade]',line)?.value||'',q=Number($('[data-v22-qty]',line)?.value||0),price=Number($('[data-v22-price]',line)?.value||0);if(t)usedTrades.add(t);
        if(q>0&&price>0){summary.user.sum+=q*price;summary.user.n++;}
        for(const s of ['material','market','standard']){const r=selectedRef(line,s);if(r&&q>0){summary[s].sum+=r.median_krw*q;summary[s].n++;}}
      }
      const set=(sel,val)=>{const el=$(sel,root);if(el)el.textContent=val};
      set('[data-v22-user-sum]',summary.user.n?money(summary.user.sum):'0원');set('[data-v22-user-coverage]',`${summary.user.n}개 행`);
      for(const s of ['material','market','standard']){set(`[data-v22-${s}-sum]`,summary[s].n?money(summary[s].sum):'-');set(`[data-v22-${s}-coverage]`,`${summary[s].n}개 행 선택`);}
      set('[data-v22-line-count]',`${lines.length} / ${max}`);
      if(addBtn)addBtn.disabled=lines.length>=max;
      const linkHost=$('[data-v22-context-links]',root),p=pyeong?.value||'';
      if(linkHost){const links=[...usedTrades].map(t=>{const href=config.routes?.[`${p}:${t}`],trade=tradeMap.get(t);return href&&trade?`<a href="${esc(href)}">${esc(p)}평 ${esc(trade.label)}</a>`:''}).filter(Boolean);linkHost.innerHTML=p&&links.length?`<span>${esc(p)}평 관련 경로</span>${links.join('')}`:'';}
    }
    function wireLine(line){
      const trade=$('[data-v22-trade]',line),unit=$('[data-v22-unit]',line);
      trade?.addEventListener('change',()=>fillUnits(line));
      unit?.addEventListener('change',()=>{fillRefs(line);updateLine(line)});
      for(const el of $$('input,select',line))if(el!==trade&&el!==unit)el.addEventListener(el.type==='checkbox'||el.tagName==='SELECT'?'change':'input',()=>updateLine(line));
      $('[data-v22-remove-line]',line)?.addEventListener('click',()=>{line.remove();updateSummary()});
      updateLine(line);
    }
    function addLine(){
      if($$('[data-v22-line]',root).length>=max)return;
      const wrap=document.createElement('div');wrap.innerHTML=lineHtml(++seq);const line=wrap.firstElementChild;linesHost?.appendChild(line);wireLine(line);updateSummary();
    }
    addBtn?.addEventListener('click',addLine);pyeong?.addEventListener('change',()=>{for(const line of $$('[data-v22-line]',root))routeFor(line);updateSummary()});
    addLine();addLine();addLine();
  }

  function markReady(){if(document.body)document.body.dataset.v22Ready='1'}
  function init(){initQuoteLines();markReady()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
