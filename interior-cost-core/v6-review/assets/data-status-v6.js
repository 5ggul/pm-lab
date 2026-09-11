const fmt=v=>v===null||v===undefined||v===''?'—':Number.isFinite(Number(v))?Number(v).toLocaleString('ko-KR'):String(v);
const $=(s,r=document)=>r.querySelector(s);
function statusLabel(type,data){
  if(type==='index')return data?.latest?.index?'정상':'확인 필요';
  if(type==='public')return data?.status==='ready'&&Array.isArray(data?.rows)&&data.rows.length?'수집 완료':'수집 전';
  if(type==='quote')return data?.status==='published_segments_available'&&Array.isArray(data?.segments)&&data.segments.length?'공개 가능':'공개 기준 미충족';
  return '확인 필요';
}
function setRow(id,{status,count,date,detail}){const row=$(`[data-status-row="${id}"]`);if(!row)return;row.dataset.state=status==='정상'||status==='수집 완료'||status==='공개 가능'?'ready':'pending';$('[data-status-state]',row).textContent=status;$('[data-status-count]',row).textContent=count;$('[data-status-date]',row).textContent=date;$('[data-status-detail]',row).textContent=detail}
async function get(url){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(String(r.status));return await r.json()}catch{return null}}
async function load(){
  const root=new URL('../',import.meta.url),[index,publicPrices,quotes]=await Promise.all([
    get(new URL('data/construction-cost-index.json',root)),get(new URL('data/public-unit-prices.json',root)),get(new URL('data/quote-public-segments.json',root))
  ]);
  setRow('construction',{status:statusLabel('index',index),count:index?.series?.length?`${fmt(index.series.length)}개 시점`:'—',date:index?.latest?.date||index?.reviewed_on||'—',detail:index?.latest?.index?`최근 지수 ${fmt(index.latest.index)} · 민간 견적 평균과 분리`:'공식 지표 파일 확인 필요'});
  setRow('public',{status:statusLabel('public',publicPrices),count:publicPrices?.status==='ready'?`${fmt(publicPrices.rows?.length||0)}행`:'0행',date:publicPrices?.source?.latest_published_date||'—',detail:publicPrices?.status==='ready'?`조달청 ${publicPrices.source?.public_data_id||'—'} · ${publicPrices.source?.api_operation||'—'}`:'공식 API 수집 전 · 임의 숫자 표시 안 함'});
  setRow('quote',{status:statusLabel('quote',quotes),count:`${fmt(quotes?.segments?.length||0)}개 세그먼트`,date:quotes?.generated_at?String(quotes.generated_at).slice(0,10):'—',detail:quotes?.status==='published_segments_available'?`세그먼트별 최소 ${fmt(quotes.minimum_public_sample)}건 충족`:`세그먼트별 최소 ${fmt(quotes?.minimum_public_sample||80)}건 전에는 P25·중앙값·P75 비공개`});
  const ready=[index?.latest?.index,publicPrices?.status==='ready',quotes?.status==='published_segments_available'].filter(Boolean).length;
  $('[data-status-ready-count]').textContent=`${ready} / 3`;
  $('[data-status-reviewed]').textContent=new Date().toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'});
}
load();
