(()=>{
  const fmt=(v,u='')=>Number.isFinite(Number(v))?Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1})+u:'공개값 없음';
  const signed=(v,u='')=>{const n=Number(v);return Number.isFinite(n)?(n>0?'+':'')+n.toLocaleString('ko-KR',{maximumFractionDigits:1})+u:'공개값 없음'};
  const hasBatchim=s=>{const c=[...String(s||'').trim()].at(-1)||'',code=c.charCodeAt(0);return code>=0xAC00&&code<=0xD7A3&&((code-0xAC00)%28)!==0};
  const subject=s=>String(s)+(hasBatchim(s)?'이':'가');
  const init=()=>{
    const workspace=document.querySelector('[data-v34-workspace="static"]'),core=workspace?.querySelector('[data-v34-core]');
    if(!workspace||!core||workspace.dataset.v52StaticCompare)return;
    const brands={},order=[];
    for(const metric of core.querySelectorAll('[data-v34-core-metric]')){
      const key=metric.dataset.v34CoreMetric;if(!key)continue;
      for(const bar of metric.querySelectorAll('[data-v34-bar]')){
        const slug=bar.dataset.v34Slug,name=bar.querySelector('.v34-bar-label strong')?.textContent.trim()||slug;if(!slug)continue;
        if(!brands[slug]){brands[slug]={slug,name};order.push(slug)}
        const n=Number(bar.dataset.v34Value);if(Number.isFinite(n))brands[slug][key]=n;
      }
    }
    if(order.length!==2)return;
    workspace.dataset.v52StaticCompare='1';document.body.classList.add('v52-static-compare');
    const zones=[...workspace.querySelectorAll('.v34-zone')],zone=t=>zones.find(z=>z.querySelector(':scope > h2')?.textContent.trim()===t);
    const costZone=zone('비용구성'),salesZone=zone('매출위치'),diffZone=zone('차이표');
    if(costZone){costZone.dataset.v52StaticSection='cost';costZone.querySelector('.v34-rings')?.setAttribute('data-v52-static-cost-cards','1')}
    if(salesZone){salesZone.dataset.v52StaticSection='sales';for(const group of salesZone.querySelectorAll('.v34-benchmark-group')){if(group.querySelector('[data-v52-static-benchmark-reference]'))continue;const first=group.querySelector('[data-v34-benchmark]');if(!first)continue;const ref=document.createElement('div');ref.className='v52-static-benchmark-reference';ref.dataset.v52StaticBenchmarkReference='1';const c=document.createElement('span'),g=document.createElement('span');c.textContent='업종 기준 '+fmt(first.dataset.v34Category,'만원');g.textContent='전체 기준 '+fmt(first.dataset.v34Global,'만원');ref.append(c,g);group.querySelector(':scope > h3')?.after(ref)}}
    if(diffZone){diffZone.dataset.v52StaticSection='diff';const scroll=diffZone.querySelector('.v34-diff-scroll');if(scroll){scroll.dataset.v52StaticDiff='1';scroll.setAttribute('aria-label','비교 차이표, 좌우로 스크롤 가능')}}
    const article=workspace.closest('article')||document.querySelector('article'),blocks=[...article.querySelectorAll(':scope > section.block')],block=t=>blocks.find(s=>s.querySelector(':scope > h2')?.textContent.trim()===t);
    const head=article.querySelector('.compare-head'),answer=article.querySelector('.v47-direct-answer'),basis=head?.querySelector('.v34-basis'),history=article.querySelector('.v34-history'),trend=block('점포추이'),warning=block('확인사항'),source=block('출처'),related=block('관련');
    if(head)head.dataset.v52StaticHead='1';
    if(answer){answer.dataset.v52StaticAnswer='1';const p=answer.querySelector('p');if(p){let text=p.textContent;for(const slug of order){const name=brands[slug].name;text=text.replaceAll(name+'이 ',subject(name)+' ')}p.textContent=text}}
    if(basis){basis.dataset.v52StaticBasis='1';basis.querySelector('summary')?.setAttribute('aria-label','비교 기준 펼쳐보기')}
    if(history){history.dataset.v52StaticHistory='1';history.querySelector('summary')?.setAttribute('aria-label','공개 이력 펼쳐보기')}
    if(trend){trend.dataset.v52StaticTrend='1';const svg=trend.querySelector(':scope > svg.chart-svg');if(svg&&!svg.closest('[data-v52-static-trend-scroll]')){const wrap=document.createElement('div');wrap.className='v52-static-trend-scroll';wrap.dataset.v52StaticTrendScroll='1';wrap.tabIndex=0;wrap.setAttribute('aria-label','연도별 가맹점 추이, 좌우로 스크롤 가능');svg.before(wrap);wrap.append(svg)}}
    if(warning)warning.dataset.v52StaticWarning='1';if(source)source.dataset.v52StaticSource='1';
    if(related){related.dataset.v52StaticRelated='1';const links=related.querySelector('.compare-next-links');if(links){links.setAttribute('aria-label','비교 후 다음 단계');[...links.children].forEach(a=>a.dataset.v52StaticRelatedCard='1')}}
    const decision=document.createElement('section');decision.className='v52-static-decision';decision.dataset.v52StaticDecision='1';decision.setAttribute('aria-label','검증 브랜드 핵심 비교 요약');decision.innerHTML='<div class="v52-static-decision-head"><div><span>검증 비교</span><strong>핵심 차이만 먼저 확인</strong></div><p>공개비용·가맹점·평균매출·점포증감은 서로 다른 지표이며 수익성을 뜻하지 않습니다.</p></div><div class="v52-static-decision-grid" data-v52-static-decision-grid></div>';
    const grid=decision.querySelector('[data-v52-static-decision-grid]'),selected=order.map(s=>brands[s]);
    const metrics=[['cost','공개 창업비용','만원','만원'],['stores','가맹점','개','개'],['sales','평균매출 공개값','만원','만원'],['growth','점포 증감','%','%p']];
    for(const[key,label,unit,diffUnit]of metrics){const card=document.createElement('article');card.className='v52-static-decision-card';card.dataset.v52StaticMetric=key;const h=document.createElement('h3');h.textContent=label;card.append(h);const values=document.createElement('div');values.className='v52-static-decision-values';const valid=[];for(const brand of selected){const row=document.createElement('div'),name=document.createElement('span'),value=document.createElement('strong');name.textContent=brand.name;value.textContent=key==='growth'?signed(brand[key],unit):fmt(brand[key],unit);row.append(name,value);values.append(row);if(Number.isFinite(Number(brand[key])))valid.push(Number(brand[key]))}card.append(values);if(valid.length===2){const d=document.createElement('p');d.className='v52-static-decision-diff';d.textContent='두 값 차이 '+fmt(Math.abs(valid[0]-valid[1]),diffUnit);card.append(d)}grid.append(card)}
    core.closest('.v34-zone')?.before(decision);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
