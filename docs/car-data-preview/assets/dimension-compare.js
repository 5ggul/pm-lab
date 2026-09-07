import {dimensionSvg} from './dimension-math.mjs';
const data=JSON.parse(document.querySelector('#dimension-data').textContent),rows=data.records;
const q=s=>document.querySelector(s),params=new URLSearchParams(location.search);
const state={a:rows.find(r=>r.id===params.get('a'))||rows.find(r=>r.id==='kia-carnival-gasoline'),b:rows.find(r=>r.id===params.get('b'))||rows.find(r=>r.id==='hyundai-grandeur'),view:['front','side','back'].includes(params.get('view'))?params.get('view'):'side',layout:params.get('layout')==='beside'?'beside':'overlay'};
const missing=['a','b'].some(k=>params.has(k)&&!rows.some(r=>r.id===params.get(k)));
if(missing){const notice=document.createElement('p');notice.className='size-query-notice';notice.setAttribute('role','status');notice.textContent='요청한 차량의 크기 정보가 없어 기본 차량을 표시합니다. 비교할 차량을 선택해 주세요.';q('.size-selectors').before(notice)}
function render(){
 q('#sizeA').value=state.a.id;q('#sizeB').value=state.b.id;
 q('#dimensionCanvas').innerHTML=dimensionSvg(state.a,state.b,state.view,state.layout,Number(q('#sizeOpacity').value)/100);
 q('#sizeViewTitle').textContent={front:'앞에서',side:'옆에서',back:'뒤에서'}[state.view];
 for(const key of ['a','b']){const r=state[key],host=q('#sizeSummary'+key.toUpperCase());host.querySelector('strong').textContent=r.name;host.querySelector('span').textContent=r.condition;host.querySelector('small').textContent='높이 '+r.dimensions.height_mm.toLocaleString('ko-KR')+' mm';const link=q('#sizeSource'+key.toUpperCase());link.href=r.source.url;link.textContent=r.name+' 제조사 제원 · '+r.source.reviewed_on;}
 for(const button of document.querySelectorAll('[data-size-view]'))button.setAttribute('aria-pressed',String(button.dataset.sizeView===state.view));
 for(const button of document.querySelectorAll('[data-size-layout]'))button.setAttribute('aria-pressed',String(button.dataset.sizeLayout===state.layout));
 const labels={length_mm:'전장',width_mm:'전폭',height_mm:'전고',wheelbase_mm:'축간거리'};
 q('#sizeValues').innerHTML=Object.entries(labels).map(([k,label])=>{const av=state.a.dimensions[k],bv=state.b.dimensions[k],diff=av-bv;return `<tr><th scope="row">${label}</th><td>${av.toLocaleString('ko-KR')} mm</td><td>${bv.toLocaleString('ko-KR')} mm</td><td>${diff===0?'같음':(diff>0?'A가 ':'B가 ')+Math.abs(diff).toLocaleString('ko-KR')+' mm '+(k==='height_mm'?'높음':k==='width_mm'?'넓음':'김')}</td></tr>`}).join('');
 const url=new URL(location.href);for(const key of ['a','b'])url.searchParams.set(key,state[key].id);url.searchParams.set('view',state.view);url.searchParams.set('layout',state.layout);history.replaceState(null,'',url);
}
for(const key of ['A','B'])q('#size'+key).addEventListener('change',e=>{state[key.toLowerCase()]=rows.find(r=>r.id===e.target.value);render()});
for(const b of document.querySelectorAll('[data-size-view]'))b.onclick=()=>{state.view=b.dataset.sizeView;render()};
for(const b of document.querySelectorAll('[data-size-layout]'))b.onclick=()=>{state.layout=b.dataset.sizeLayout;render()};
q('#sizeOpacity').oninput=render;q('#sizeSwap').onclick=()=>{[state.a,state.b]=[state.b,state.a];render()};render();
