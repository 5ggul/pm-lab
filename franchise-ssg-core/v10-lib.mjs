export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
export const num=v=>finite(v)?Math.round(Number(v)).toLocaleString('ko-KR'):'정보 없음';
export const won=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'정보 없음';
export const signedWon=v=>finite(v)?`${Number(v)>0?'+':Number(v)<0?'-':''}${Math.round(Math.abs(Number(v))).toLocaleString('ko-KR')}만원`:'정보 없음';
export const count=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}개`:'정보 없음';
export const pct=v=>finite(v)?`${Number(v)>0?'+':''}${Number(v).toFixed(1)}%`:'정보 없음';
export const plainPct=v=>finite(v)?`${Number(v).toFixed(1)}%`:'정보 없음';
export const dateOnly=v=>v?String(v).slice(0,10):'정보 없음';
export const growthPct=b=>finite(b?.stores)&&finite(b?.lastStores)&&Number(b.lastStores)>0?(Number(b.stores)-Number(b.lastStores))/Number(b.lastStores)*100:null;
export const growthAbs=b=>finite(b?.stores)&&finite(b?.lastStores)?Number(b.stores)-Number(b.lastStores):null;
export function median(values){const a=values.filter(finite).map(Number).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
export function percentile(values,value){if(!finite(value))return null;const a=values.filter(finite).map(Number).sort((x,y)=>x-y);if(a.length<3)return null;let less=0,equal=0;for(const v of a){if(v<Number(value))less++;else if(v===Number(value))equal++}return (less+equal*.5)/a.length*100}
export function meaningfulStoreHistory(record){const rows=Array.isArray(record?.storeHistory)?record.storeHistory:[];const current=Number(record?.stores||0);return rows.filter(r=>{if(!finite(r?.stores))return false;if(current===0)return true;return Number(r.stores)>0||Number(r.newStores||0)>0||Number(r.contractEnd||0)>0||Number(r.contractCancel||0)>0||Number(r.averageSales10k||0)>0})}
export function qualityForOfficial(record){
  if(!record)return {score:10,indexCandidate:false,reasons:['OFFICIAL_MATCH_MISSING']};
  let score=20;const reasons=[];
  if(record.sourceUrl||record.source?.statsUrl||record.source?.costUrl)score+=10;else reasons.push('SOURCE_MISSING');
  if(record.referenceYear)score+=10;else reasons.push('REFERENCE_YEAR_MISSING');
  if(finite(record.startupCost10k))score+=15;else reasons.push('COST_MISSING');
  if(finite(record.stores))score+=15;else reasons.push('STORES_MISSING');
  if(finite(record.averageSales10k))score+=10;else reasons.push('SALES_MISSING');
  const c=record.costComponents||{},componentCount=['franchiseFee10k','education10k','deposit10k','etc10k'].filter(k=>finite(c[k])).length;
  if(componentCount>=3)score+=5;else reasons.push('COST_COMPONENTS_THIN');
  const history=meaningfulStoreHistory(record);if(history.length>=2)score+=10;else reasons.push('STORE_HISTORY_THIN');
  const oc=record.openClose||{};if(['newStores','ended','cancelled'].some(k=>finite(oc[k])))score+=5;else reasons.push('OPEN_CLOSE_MISSING');
  return {score,indexCandidate:score>=70,reasons,componentCount,storeHistoryYears:history.map(x=>x.year)};
}
export function officialView(brand,hit){
  if(!hit)return {...brand,cost:null,stores:null,lastStores:null,direct:null,sales:null,fee:null,education:null,deposit:null,interior:null,other:null,dataMode:'OFFICIAL_UNMATCHED',official:null,matchMethod:null,quality:qualityForOfficial(null)};
  const r=hit.record,c=r.costComponents||{};
  return {...brand,
    cost:finite(r.startupCost10k)?Number(r.startupCost10k):null,
    stores:finite(r.stores)?Number(r.stores):null,
    lastStores:finite(r.previousStores)?Number(r.previousStores):null,
    direct:finite(r.directStores)?Number(r.directStores):null,
    sales:finite(r.averageSales10k)?Number(r.averageSales10k):null,
    fee:finite(r.startupFee10k??c.franchiseFee10k)?Number(r.startupFee10k??c.franchiseFee10k):null,
    education:finite(r.startupEducation10k??c.education10k)?Number(r.startupEducation10k??c.education10k):null,
    deposit:finite(r.startupDeposit10k??c.deposit10k)?Number(r.startupDeposit10k??c.deposit10k):null,
    interior:finite(r.startupInterior10k)?Number(r.startupInterior10k):null,
    other:finite(r.startupEtc10k??c.etc10k)?Number(r.startupEtc10k??c.etc10k):null,
    dataMode:'FTC_OFFICIAL',matchMethod:hit.method,quality:qualityForOfficial(r),
    official:{referenceYear:r.referenceYear??null,previousReferenceYear:r.previousReferenceYear??null,sourceUrl:r.sourceUrl||null,source:r.source||{},storeHistory:meaningfulStoreHistory(r),costHistory:Array.isArray(r.costHistory)?r.costHistory:[],costComponents:c,openClose:r.openClose||{},newStores:finite(r.newStores)?Number(r.newStores):null,contractEnd:finite(r.contractEnd)?Number(r.contractEnd):null,contractCancel:finite(r.contractCancel)?Number(r.contractCancel):null,averageSalesPerArea10k:finite(r.averageSalesPerArea10k)?Number(r.averageSalesPerArea10k):null,officialName:r.name||r.brandName||brand.name,corp:r.corp||null}
  };
}
export function costComponents(view){const rows=[['가맹비',view.fee],['교육비',view.education],['보증금',view.deposit],['인테리어',view.interior],['기타',view.other]].filter(([,v])=>finite(v));return rows.map(([label,value])=>({label,value:Number(value)}))}
export function renderStackedBar(components,{title='비용 구성',desc='공개 비용 항목의 구성 비중'}={}){
  const vals=components.filter(x=>finite(x.value)&&Number(x.value)>=0),total=vals.reduce((s,x)=>s+Number(x.value),0);if(!vals.length||total<=0)return '';
  const colors=['#2457D6','#5D7FE0','#8EA5EB','#B8C7F3','#D9E1F8'];let x=0;const rects=[];for(let i=0;i<vals.length;i++){const w=Number(vals[i].value)/total*800;rects.push(`<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="42" fill="${colors[i%colors.length]}"/><title>${esc(vals[i].label)} ${won(vals[i].value)}</title>`);x+=w}
  return `<svg class="chart-svg" viewBox="0 0 800 42" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><desc>${esc(desc)}</desc>${rects.join('')}</svg>`;
}
export function renderLineChart(points,{title='가맹점 추이',desc='연도별 가맹점 수',unit='개'}={}){
  const rows=points.filter(p=>finite(p.value));if(rows.length<2)return '';const w=800,h=270,padL=70,padR=30,padT=28,padB=48,innerW=w-padL-padR,innerH=h-padT-padB,max=Math.max(...rows.map(r=>Number(r.value)),1),min=Math.min(...rows.map(r=>Number(r.value)),0),range=Math.max(1,max-min);const coords=rows.map((r,i)=>{const x=padL+(rows.length===1?0:i/(rows.length-1)*innerW),y=padT+(max-Number(r.value))/range*innerH;return {...r,x,y}});const grid=[0,.25,.5,.75,1].map(t=>{const y=padT+t*innerH,val=max-t*range;return `<line x1="${padL}" y1="${y}" x2="${w-padR}" y2="${y}" stroke="#E6DFD4"/><text x="${padL-10}" y="${y+4}" text-anchor="end" font-size="11" fill="#6B645C">${Math.round(val).toLocaleString('ko-KR')}</text>`}).join('');const path=coords.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');const pointsSvg=coords.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4" fill="#2457D6"/><text x="${p.x}" y="${h-17}" text-anchor="middle" font-size="12" fill="#6B645C">${esc(p.label)}</text><text x="${p.x}" y="${Math.max(14,p.y-9)}" text-anchor="middle" font-size="11" font-weight="700" fill="#1C1916">${Math.round(Number(p.value)).toLocaleString('ko-KR')}${esc(unit)}</text>`).join('');return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><desc>${esc(desc)}</desc>${grid}<path d="${path}" fill="none" stroke="#2457D6" stroke-width="3"/>${pointsSvg}</svg>`}
export function renderHorizontalBars(items,{title='비교 차트',desc='항목별 값 비교',unit='만원'}={}){
  const rows=items.filter(x=>finite(x.value));if(!rows.length)return '';const w=820,rowH=48,h=22+rows.length*rowH,max=Math.max(...rows.map(x=>Number(x.value)),1),labelW=170,barX=190,barW=470;const body=rows.map((r,i)=>{const y=20+i*rowH,bw=Math.max(2,Number(r.value)/max*barW);return `<text x="8" y="${y+17}" font-size="13" font-weight="700" fill="#1C1916">${esc(r.label)}</text><rect x="${barX}" y="${y+4}" width="${barW}" height="18" fill="#EEE8DE"/><rect x="${barX}" y="${y+4}" width="${bw.toFixed(1)}" height="18" fill="#2457D6"/><text x="${barX+barW+12}" y="${y+18}" font-size="12" fill="#1C1916">${Math.round(Number(r.value)).toLocaleString('ko-KR')}${esc(unit)}</text>`}).join('');return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><desc>${esc(desc)}</desc>${body}</svg>`}
export function renderGroupedBars(rows,{title='브랜드 비교',desc='두 브랜드 값 비교',aLabel='A',bLabel='B',unit='만원'}={}){
  const valid=rows.filter(r=>finite(r.a)||finite(r.b));if(!valid.length)return '';const w=820,rowH=66,h=28+valid.length*rowH,max=Math.max(...valid.flatMap(r=>[finite(r.a)?Number(r.a):0,finite(r.b)?Number(r.b):0]),1),labelW=160,barX=180,barW=480;const body=valid.map((r,i)=>{const y=20+i*rowH,aw=finite(r.a)?Number(r.a)/max*barW:0,bw=finite(r.b)?Number(r.b)/max*barW:0;return `<text x="8" y="${y+24}" font-size="13" font-weight="700" fill="#1C1916">${esc(r.label)}</text><rect x="${barX}" y="${y+5}" width="${aw.toFixed(1)}" height="18" fill="#2457D6"/><rect x="${barX}" y="${y+29}" width="${bw.toFixed(1)}" height="18" fill="#0F7B4A"/><text x="${barX+Math.max(aw,2)+8}" y="${y+18}" font-size="11" fill="#1C1916">${finite(r.a)?`${Math.round(Number(r.a)).toLocaleString('ko-KR')}${esc(unit)}`:'정보 없음'}</text><text x="${barX+Math.max(bw,2)+8}" y="${y+42}" font-size="11" fill="#1C1916">${finite(r.b)?`${Math.round(Number(r.b)).toLocaleString('ko-KR')}${esc(unit)}`:'정보 없음'}</text>`}).join('');return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><desc>${esc(desc)}</desc><text x="${barX}" y="14" font-size="11" fill="#2457D6">${esc(aLabel)}</text><text x="${barX+110}" y="14" font-size="11" fill="#0F7B4A">${esc(bLabel)}</text>${body}</svg>`}
