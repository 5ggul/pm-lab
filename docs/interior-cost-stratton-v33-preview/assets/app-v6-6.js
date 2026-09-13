(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const REQUIRED=['sample_id','quote_month','region_level1','supply_pyeong','building_type','scope','bathroom_count','window_scope','vat_state','waste_state','total_amount_manwon'];
  const OPTIONAL=['exclusive_pyeong','demolition_manwon','waste_manwon','waterproof_manwon','bathroom_manwon','kitchen_manwon','wallpaper_manwon','flooring_manwon','carpentry_manwon','electrical_manwon','window_manwon','management_manwon'];
  const ALLOWED=new Set([...REQUIRED,...OPTIONAL]);
  const REGIONS=new Set(['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주']);
  const BUILDINGS=new Set(['아파트','빌라','주택']);
  const SCOPES=new Set(['올수리','부분']);
  const WINDOWS=new Set(['전체','부분','제외','미기재']);
  const STATES=new Set(['포함','별도','미기재']);
  const ITEM_FIELDS=OPTIONAL.filter(x=>x.endsWith('_manwon'));
  const PUBLIC_N=30, SEGMENT_N=20;
  let last={valid:[],errors:[],headers:[]};

  function parseCsv(text){
    const rows=[];let row=[],cell='',quoted=false;
    const src=String(text||'').replace(/^\uFEFF/,'');
    for(let i=0;i<src.length;i++){
      const ch=src[i],next=src[i+1];
      if(quoted){if(ch==='"'&&next==='"'){cell+='"';i++}else if(ch==='"'){quoted=false}else cell+=ch;continue}
      if(ch==='"'){quoted=true;continue}
      if(ch===','){row.push(cell);cell='';continue}
      if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';continue}
      if(ch!=='\r')cell+=ch;
    }
    row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row);
    return rows;
  }
  function num(v){const x=String(v??'').trim();if(x==='')return null;const n=Number(x.replaceAll(',',''));return Number.isFinite(n)?n:NaN}
  function validMonth(v){const m=String(v||'').match(/^(\d{4})-(\d{2})$/);return !!m&&Number(m[2])>=1&&Number(m[2])<=12}
  function validate(text){
    const raw=parseCsv(text);const errors=[];if(raw.length<2)return {valid:[],errors:['헤더와 데이터 행이 필요합니다.'],headers:[]};
    const headers=raw[0].map(x=>x.trim());const missing=REQUIRED.filter(x=>!headers.includes(x)),unknown=headers.filter(x=>!ALLOWED.has(x));
    if(missing.length)errors.push(`필수 열 누락: ${missing.join(', ')}`);if(unknown.length)errors.push(`허용하지 않는 열: ${unknown.join(', ')} · 개인정보/업체명 열은 넣지 않습니다.`);
    if(new Set(headers).size!==headers.length)errors.push('중복 헤더가 있습니다.');
    if(errors.length)return {valid:[],errors,headers};
    const ids=new Set(),valid=[];
    raw.slice(1).forEach((cells,index)=>{
      if(cells.every(x=>String(x).trim()===''))return;
      const line=index+2,obj={};headers.forEach((h,i)=>obj[h]=String(cells[i]??'').trim());const rowErrors=[];
      if(!/^[A-Za-z0-9_-]{3,40}$/.test(obj.sample_id))rowErrors.push('sample_id는 영문·숫자·_- 3~40자');
      if(ids.has(obj.sample_id))rowErrors.push('sample_id 중복');ids.add(obj.sample_id);
      if(!validMonth(obj.quote_month))rowErrors.push('quote_month는 YYYY-MM');
      if(!REGIONS.has(obj.region_level1))rowErrors.push('region_level1은 17개 시도 약칭 중 하나');
      const supply=num(obj.supply_pyeong);if(!Number.isFinite(supply)||supply<5||supply>100)rowErrors.push('supply_pyeong 5~100');
      const exclusive=num(obj.exclusive_pyeong);if(exclusive!==null&&(!Number.isFinite(exclusive)||exclusive<0||exclusive>100))rowErrors.push('exclusive_pyeong 0~100 또는 공란');
      if(!BUILDINGS.has(obj.building_type))rowErrors.push('building_type: 아파트/빌라/주택');
      if(!SCOPES.has(obj.scope))rowErrors.push('scope: 올수리/부분');
      const bathrooms=num(obj.bathroom_count);if(!Number.isInteger(bathrooms)||bathrooms<0||bathrooms>5)rowErrors.push('bathroom_count 0~5 정수');
      if(!WINDOWS.has(obj.window_scope))rowErrors.push('window_scope: 전체/부분/제외/미기재');
      if(!STATES.has(obj.vat_state))rowErrors.push('vat_state: 포함/별도/미기재');
      if(!STATES.has(obj.waste_state))rowErrors.push('waste_state: 포함/별도/미기재');
      const total=num(obj.total_amount_manwon);if(!Number.isFinite(total)||total<=0||total>100000)rowErrors.push('total_amount_manwon 0 초과');
      ITEM_FIELDS.forEach(f=>{const n=num(obj[f]);if(n!==null&&(!Number.isFinite(n)||n<0||n>100000))rowErrors.push(`${f}는 0 이상 또는 공란`)});
      if(rowErrors.length){errors.push(`행 ${line}: ${rowErrors.join(' / ')}`);return}
      const normalized={sample_id:obj.sample_id,quote_month:obj.quote_month,region_level1:obj.region_level1,supply_pyeong:supply,exclusive_pyeong:exclusive,building_type:obj.building_type,scope:obj.scope,bathroom_count:bathrooms,window_scope:obj.window_scope,vat_state:obj.vat_state,waste_state:obj.waste_state,total_amount_manwon:total};
      ITEM_FIELDS.forEach(f=>normalized[f]=num(obj[f]));valid.push(normalized);
    });
    return {valid,errors,headers};
  }
  function quantile(values,p){const a=[...values].sort((x,y)=>x-y);if(!a.length)return null;const pos=(a.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(pos-lo)}
  function money(n){return n==null?'—':`${Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1})}만원`}
  function render(root,result){
    last=result;const valid=result.valid.length,invalid=result.errors.filter(x=>x.startsWith('행 ')).length;
    $('[data-v66-valid]',root).textContent=`${valid}건`;$('[data-v66-valid]',root).className=valid?'ok':'';
    $('[data-v66-invalid]',root).textContent=`${invalid}건`;$('[data-v66-invalid]',root).className=invalid?'bad':'';
    const status=$('[data-v66-status]',root),statusNote=$('[data-v66-status-note]',root);if(valid>=PUBLIC_N&&invalid===0){status.textContent='통계 미리보기 가능';status.className='ok';statusNote.textContent=`검수 통과 N=${valid}. 공개 정책 기준 N=${PUBLIC_N} 충족.`}else{status.textContent='통계 보류';status.className='';statusNote.textContent=`검수 통과 N=${valid}. 전체 분포 공개 기준 N=${PUBLIC_N} 미만이거나 오류가 남아 있습니다.`}
    const errors=$('[data-v66-errors]',root);errors.innerHTML='';if(result.errors.length){result.errors.slice(0,30).forEach(e=>{const li=document.createElement('li');const code=document.createElement('code');code.textContent=e;li.append(code);errors.append(li)})}else{const li=document.createElement('li');li.textContent='검증 오류가 없습니다.';errors.append(li)}
    const preview=$('[data-v66-stat-preview]',root);if(valid>=PUBLIC_N&&invalid===0){const vals=result.valid.map(x=>x.total_amount_manwon);preview.hidden=false;$('[data-v66-n]',preview).textContent=`${valid}건`;$('[data-v66-p25]',preview).textContent=money(quantile(vals,.25));$('[data-v66-median]',preview).textContent=money(quantile(vals,.5));$('[data-v66-p75]',preview).textContent=money(quantile(vals,.75))}else preview.hidden=true;
    const exportBtn=$('[data-v66-export]',root);if(exportBtn)exportBtn.disabled=!valid;
  }
  function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function init(root){
    const area=$('[data-v66-csv]',root),validateBtn=$('[data-v66-validate]',root),exportBtn=$('[data-v66-export]',root);if(!area||!validateBtn)return;
    validateBtn.addEventListener('click',()=>render(root,validate(area.value)));
    exportBtn?.addEventListener('click',()=>{if(!last.valid.length)return;download('normalized-quote-samples.json',JSON.stringify({schema_version:'6.6.0',validated_count:last.valid.length,publication_threshold:{distribution_n:PUBLIC_N,segment_n:SEGMENT_N},rows:last.valid},null,2),'application/json')});
    const example=$('[data-v66-example]',root);example?.addEventListener('click',()=>{area.value='sample_id,quote_month,region_level1,supply_pyeong,exclusive_pyeong,building_type,scope,bathroom_count,window_scope,vat_state,waste_state,total_amount_manwon,bathroom_manwon,kitchen_manwon,wallpaper_manwon,flooring_manwon,window_manwon\nQ0001,2026-08,서울,32,25.7,아파트,올수리,2,제외,포함,포함,5200,900,850,320,450,';render(root,validate(area.value))});
    render(root,{valid:[],errors:[],headers:[]});
  }
  $$('[data-v66-pipeline]').forEach(init);
})();
