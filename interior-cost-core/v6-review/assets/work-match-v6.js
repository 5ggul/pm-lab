const clean=v=>String(v??'').trim();
export const normalizeMatchText=v=>clean(v).toLowerCase().replace(/[\s·ㆍ+,_/()\[\]-]+/g,'');
const unique=a=>[...new Set(a.filter(Boolean))];
const contains=(line,token)=>normalizeMatchText(line).includes(normalizeMatchText(token));

export function parseLineFlags(line){
  const t=clean(line).toLowerCase();
  return {
    bundled:/1\s*식|일체|전체/.test(t),
    separate:/별도|미포함|제외/.test(t),
    included:/포함/.test(t),
    quantity:(t.match(/(\d+(?:\.\d+)?)\s*(㎡|m2|m²|평|m|개|식|회로|회)/i)||[]).slice(1).join(' ')||null
  };
}

function candidateKey(c){return `${c.standard_work}|${c.label}`}
function mergeCandidate(a,b){
  return {
    ...a,
    evidence:unique([...(a.evidence||[]),...(b.evidence||[])]),
    public_terms:unique([...(a.public_terms||[]),...(b.public_terms||[])]),
    questions:unique([...(a.questions||[]),...(b.questions||[])]),
    sources:unique([...(a.sources||[]),...(b.sources||[])])
  };
}

export function matchLine(line,rules){
  const raw=clean(line),flags=parseLineFlags(raw),map=new Map();
  if(!raw)return {raw,flags,candidates:[],unmatched:true};
  const add=c=>{const key=candidateKey(c),base={confirmed:false,evidence:[],public_terms:[],questions:[],sources:[],certainty:'candidate',...c};map.set(key,map.has(key)?mergeCandidate(map.get(key),base):base)};

  for(const bundle of rules?.bundles||[]){
    const context=(bundle.contexts||[]).find(x=>contains(raw,x));
    const bundleTerm=(bundle.bundle_terms||[]).find(x=>contains(raw,x));
    if(!context||!bundleTerm)continue;
    for(const component of bundle.components||[])add({
      ...component,
      certainty:'scope_check',
      evidence:[`${context} + ${bundleTerm}`],
      sources:[bundle.label]
    });
  }

  const hasBathroom=/욕실|화장실/.test(raw),hasFloor=/바닥|마루|장판/.test(raw);
  for(const rule of rules?.aliases||[]){
    const hits=(rule.aliases||[]).filter(alias=>contains(raw,alias));
    if(!hits.length)continue;
    if(rule.ambiguous_group==='tile'&&hasBathroom&&rule.standard_work==='바닥'&&!hasFloor)continue;
    if(rule.ambiguous_group==='tile'&&hasFloor&&rule.standard_work==='욕실'&&!hasBathroom)continue;
    add({
      standard_work:rule.standard_work,
      label:rule.label,
      certainty:rule.ambiguous_group?'ambiguous':'explicit',
      evidence:hits,
      public_terms:rule.public_terms||[],
      questions:rule.questions||[],
      sources:[rule.id]
    });
  }

  return {raw,flags,candidates:[...map.values()],unmatched:map.size===0};
}

export function matchLines(text,rules,{maxLines=30}={}){
  return clean(text).split(/\r?\n/).map(clean).filter(Boolean).slice(0,maxLines).map(line=>matchLine(line,rules));
}

function scorePublicRow(row,terms){
  const name=normalizeMatchText(row?.name),spec=normalizeMatchText(row?.spec),condition=normalizeMatchText(row?.application_condition),code=normalizeMatchText(row?.work_code);
  let score=0;
  for(const term of terms||[]){
    const q=normalizeMatchText(term);if(!q)continue;
    if(name===q)score+=8;else if(name.includes(q))score+=5;
    if(spec.includes(q))score+=2;
    if(condition.includes(q))score+=1;
    if(code.includes(q))score+=1;
  }
  return score;
}
export function matchPublicRows(rows,candidate,limit=5){
  const terms=unique(candidate?.public_terms||[]);if(!terms.length)return[];
  return (rows||[]).map(row=>({row,score:scorePublicRow(row,terms)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(a.row.work_code||'').localeCompare(String(b.row.work_code||''),'ko')||String(a.row.name||'').localeCompare(String(b.row.name||''),'ko')).slice(0,limit).map(x=>x.row);
}

if(typeof document!=='undefined'){
  const $=(s,r=document)=>r.querySelector(s),root=new URL('../',import.meta.url),selected=new Map();
  let rules=null,publicData={status:'source_not_collected',rows:[]},analyses=[];
  const stateText=(c)=>c.certainty==='explicit'?'명시':c.certainty==='scope_check'?'1식 분해 후보':'용도 확인';
  const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
  const money=v=>Number.isFinite(Number(v))?Math.round(Number(v)).toLocaleString('ko-KR')+'원':'—';
  function publicLink(term){const a=el('a','match-public-link','공공단가에서 검색');a.href=new URL(`reference-prices/?q=${encodeURIComponent(term||'')}`,root).href;return a}
  function updateSummary(){
    const host=$('[data-match-confirmed]'),count=$('[data-match-confirmed-count]');if(!host)return;host.replaceChildren();
    const items=[...selected.values()];if(count)count.textContent=String(items.length);
    if(!items.length){host.append(el('p','match-quiet','아직 사용자가 확정한 공종이 없습니다.'));return}
    items.forEach(item=>{const row=el('div','confirmed-row');row.append(el('strong','',item.standard_work),el('span','',item.label),el('small','',item.sourceLine));host.append(row)});
  }
  function publicCandidates(candidate,holder){
    holder.replaceChildren();const rows=matchPublicRows(publicData.rows||[],candidate,5);
    if(publicData.status!=='ready'||!(publicData.rows||[]).length){holder.append(el('p','match-quiet','공식 단가 데이터 수집 전입니다. 검색어만 제공합니다.'));return}
    if(!rows.length){holder.append(el('p','match-quiet','현재 공식 데이터에서 직접 일치하는 후보를 찾지 못했습니다. 검색어를 바꿔 확인하세요.'));return}
    const table=el('table','public-candidate-table'),head=el('thead');const hr=el('tr');['공종코드','품명·규격','단위','공공 참고단가','발표일'].forEach(t=>hr.append(el('th','',t)));head.append(hr);table.append(head);const body=el('tbody');
    rows.forEach(r=>{const tr=el('tr');tr.append(el('td','',r.work_code||'—'),el('td','',`${r.name||'—'}${r.spec?' · '+r.spec:''}`),el('td','',r.unit||'—'),el('td','',money(r.total_cost_won)),el('td','',r.published_date||'—'));body.append(tr)});table.append(body);holder.append(table);
  }
  function candidateRow(lineIndex,candidateIndex,candidate,sourceLine){
    const key=`${lineIndex}:${candidateKey(candidate)}`,row=el('div','match-candidate');
    const choose=el('label','match-check'),input=document.createElement('input');input.type='checkbox';input.checked=selected.has(key);choose.append(input,el('span','',selected.has(key)?'확정됨':'선택'));
    const work=el('div','match-work');work.append(el('strong','',candidate.standard_work),el('span','',candidate.label));
    const why=el('div','match-evidence');why.append(el('b','',stateText(candidate)),el('span','',(candidate.evidence||[]).join(' · ')||'규칙 후보'));
    const questions=el('ul','match-questions');(candidate.questions||[]).slice(0,3).forEach(q=>questions.append(el('li','',q)));
    const pub=el('div','match-public');const term=(candidate.public_terms||[])[0]||'';if(term)pub.append(publicLink(term));else pub.append(el('span','match-quiet','공공단가 직접 검색어 없음'));
    const toggle=el('button','match-public-toggle','공식 후보');toggle.type='button';const detail=el('div','match-public-detail');detail.hidden=true;if(term){pub.append(toggle);toggle.addEventListener('click',()=>{detail.hidden=!detail.hidden;if(!detail.hidden)publicCandidates(candidate,detail)})}
    input.addEventListener('change',()=>{if(input.checked){selected.set(key,{...candidate,sourceLine});choose.querySelector('span').textContent='확정됨'}else{selected.delete(key);choose.querySelector('span').textContent='선택'}updateSummary()});
    row.append(choose,work,why,questions,pub,detail);return row;
  }
  function render(){
    const host=$('[data-match-results]'),empty=$('[data-match-empty]');if(!host)return;host.replaceChildren();
    const candidateCount=analyses.reduce((n,x)=>n+x.candidates.length,0);$('[data-match-line-count]').textContent=String(analyses.length);$('[data-match-candidate-count]').textContent=String(candidateCount);
    if(!analyses.length){empty.hidden=false;updateSummary();return}empty.hidden=true;
    analyses.forEach((analysis,i)=>{const section=el('section','match-line');const head=el('div','match-line-head');head.append(el('span','match-line-no',String(i+1).padStart(2,'0')),el('strong','',analysis.raw));const flags=el('div','match-flags');if(analysis.flags.bundled)flags.append(el('span','', '1식/일체'));if(analysis.flags.included)flags.append(el('span','', '포함'));if(analysis.flags.separate)flags.append(el('span','', '별도/제외'));if(analysis.flags.quantity)flags.append(el('span','',analysis.flags.quantity));head.append(flags);section.append(head);
      if(analysis.unmatched){section.append(el('p','match-unmatched','표준 공종 후보를 자동 확정하지 못했습니다. 원문을 더 구체적으로 적거나 표준 공종표에서 직접 확인하세요.'))}
      else{const grid=el('div','match-candidate-list');analysis.candidates.forEach((c,j)=>grid.append(candidateRow(i,j,c,analysis.raw)));section.append(grid)}host.append(section)});updateSummary();
  }
  function analyze(){selected.clear();analyses=matchLines($('[data-match-input]')?.value||'',rules||{});render()}
  function copyConfirmed(){const items=[...selected.values()];if(!items.length)return;const text=items.map(x=>`[${x.standard_work}] ${x.label} ← ${x.sourceLine}`).join('\n');navigator.clipboard?.writeText(text);const b=$('[data-match-copy]');if(b){const old=b.textContent;b.textContent='복사됨';setTimeout(()=>b.textContent=old,900)}}
  async function load(){
    try{const [rr,pr]=await Promise.all([fetch(new URL('data/work-match-rules.json',root),{cache:'no-store'}),fetch(new URL('data/public-unit-prices.json',root),{cache:'no-store'})]);if(rr.ok)rules=await rr.json();if(pr.ok)publicData=await pr.json()}catch{}
    $('[data-match-public-state]').textContent=publicData.status==='ready'&&publicData.rows?.length?`${publicData.rows.length.toLocaleString('ko-KR')}행 연결`:'공식 단가 수집 전';
    const q=new URL(location.href).searchParams.get('q');if(q){$('[data-match-input]').value=q;analyze()}
  }
  $('[data-match-analyze]')?.addEventListener('click',analyze);$('[data-match-input]')?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')analyze()});$('[data-match-example]')?.addEventListener('click',()=>{$('[data-match-input]').value='욕실공사 1식\n주방가구 철거 포함\n도배 + 장판\n콘센트 증설 10개';analyze()});$('[data-match-reset]')?.addEventListener('click',()=>{$('[data-match-input]').value='';selected.clear();analyses=[];render()});$('[data-match-copy]')?.addEventListener('click',copyConfirmed);load();
}
