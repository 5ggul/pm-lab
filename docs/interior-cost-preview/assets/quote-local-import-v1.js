(()=>{
  'use strict';

  const MAX_FILE_BYTES=2*1024*1024;
  const MAX_SAFE_AMOUNT=Number.MAX_SAFE_INTEGER;
  const ITEMS=[
    ['demolition','철거'],['waste','폐기물'],['waterproof','방수'],['bathroom','욕실'],
    ['kitchen','주방'],['wallpaper','도배'],['flooring','바닥'],['carpentry','목공'],
    ['electrical','전기'],['window','샷시'],['management','현장관리비'],['vat','VAT']
  ];
  const ITEM_IDS=new Set(ITEMS.map(([id])=>id));
  const ITEM_MAP=new Map();
  for(const [id,name] of ITEMS){
    ITEM_MAP.set(normalizeToken(id),id);
    ITEM_MAP.set(normalizeToken(name),id);
  }
  [['화장실','bathroom'],['샤시','window'],['창호','window'],['부가세','vat'],['폐기물처리','waste']]
    .forEach(([name,id])=>ITEM_MAP.set(normalizeToken(name),id));

  const STATE_MAP=new Map([
    ['included','included'],['기재','included'],['포함','included'],
    ['separate','separate'],['별도','separate'],
    ['missing','missing'],['미기재','missing']
  ].map(([k,v])=>[normalizeToken(k),v]));

  const HEADER_ALIASES={
    item:['공종','항목','item','id'],
    state:['상태','state'],
    amount:['금액만원','금액','amount','amount만원'],
    qty:['수량','qty','quantity'],
    unit:['단위','unit'],
    spec:['사양','spec','specification'],
    memo:['메모','memo','note']
  };

  const $=(s,r=document)=>r.querySelector(s);

  function normalizeToken(value){
    return String(value??'').replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[\s_\-()[\]{}]/g,'');
  }

  function detectDelimiter(text){
    let comma=0,tab=0,quoted=false;
    for(let i=0;i<Math.min(text.length,4096);i++){
      const ch=text[i];
      if(ch==='"'){
        if(quoted&&text[i+1]==='"'){i++;continue;}
        quoted=!quoted;continue;
      }
      if(!quoted){
        if(ch===',')comma++;
        else if(ch==='\t')tab++;
        else if(ch==='\n'||ch==='\r')break;
      }
    }
    return tab>comma?'\t':',';
  }

  function parseDelimited(text,delimiter){
    const rows=[];let row=[],field='',quoted=false;
    const source=String(text??'').replace(/^\uFEFF/,'');
    for(let i=0;i<source.length;i++){
      const ch=source[i];
      if(ch==='"'){
        if(quoted&&source[i+1]==='"'){field+='"';i++;continue;}
        quoted=!quoted;continue;
      }
      if(!quoted&&ch===delimiter){row.push(field);field='';continue;}
      if(!quoted&&(ch==='\n'||ch==='\r')){
        if(ch==='\r'&&source[i+1]==='\n')i++;
        row.push(field);field='';
        if(row.some(v=>String(v).trim()!==''))rows.push(row);
        row=[];continue;
      }
      field+=ch;
    }
    if(quoted)throw new Error('따옴표가 닫히지 않은 행이 있습니다.');
    row.push(field);
    if(row.some(v=>String(v).trim()!==''))rows.push(row);
    return rows;
  }

  function makeHeaderMap(header){
    const normalized=header.map(normalizeToken);
    const map={};
    for(const [key,aliases] of Object.entries(HEADER_ALIASES)){
      const aliasSet=new Set(aliases.map(normalizeToken));
      const index=normalized.findIndex(v=>aliasSet.has(v));
      if(index>=0)map[key]=index;
    }
    if(map.item==null||map.state==null){
      throw new Error('첫 줄에 “공종”과 “상태” 열이 필요합니다.');
    }
    return map;
  }

  function parseAmount(value,line){
    const raw=String(value??'').trim();
    if(!raw)return {raw:'',number:0};
    const cleaned=raw.replace(/,/g,'').replace(/만원/g,'').replace(/₩/g,'').trim();
    const number=Number(cleaned);
    if(!Number.isFinite(number)||number<0||number>MAX_SAFE_AMOUNT){
      throw new Error(`${line}행 금액이 안전한 계산 범위를 벗어났습니다.`);
    }
    return {raw:cleaned,number};
  }

  function parseQuoteText(text){
    const delimiter=detectDelimiter(text);
    const rows=parseDelimited(text,delimiter);
    if(rows.length<2)throw new Error('헤더와 공종 데이터가 있는 CSV/TXT 파일이 필요합니다.');
    const header=makeHeaderMap(rows[0]);
    const data=[];const seen=new Set();let total=0;
    for(let i=1;i<rows.length;i++){
      const cells=rows[i],line=i+1;
      const rawItem=cells[header.item]??'';
      const item=ITEM_MAP.get(normalizeToken(rawItem));
      if(!item)throw new Error(`${line}행 공종 “${String(rawItem).trim()||'빈 값'}”을 인식할 수 없습니다.`);
      if(!ITEM_IDS.has(item))throw new Error(`${line}행 공종이 지원 범위를 벗어났습니다.`);
      if(seen.has(item))throw new Error(`${line}행에 같은 공종이 중복되었습니다.`);
      seen.add(item);

      const rawState=cells[header.state]??'';
      const state=STATE_MAP.get(normalizeToken(rawState));
      if(!state)throw new Error(`${line}행 상태 “${String(rawState).trim()||'빈 값'}”를 인식할 수 없습니다.`);

      const amount=parseAmount(header.amount==null?'':cells[header.amount],line);
      total+=amount.number;
      if(!Number.isFinite(total)||total>MAX_SAFE_AMOUNT)throw new Error('파일의 금액 합계가 안전한 계산 범위를 벗어났습니다.');

      const get=key=>header[key]==null?'':String(cells[header[key]]??'').trim();
      const record={
        item,state,amount:amount.raw,
        qty:get('qty'),unit:get('unit'),spec:get('spec'),memo:get('memo')
      };
      for(const key of ['qty','unit','spec','memo']){
        if(record[key].length>1000)throw new Error(`${line}행 ${key} 값이 너무 깁니다.`);
      }
      data.push(record);
    }
    if(!data.length)throw new Error('가져올 공종 데이터가 없습니다.');
    return {data,delimiter};
  }

  async function decodeFile(file){
    if(!file)throw new Error('파일을 선택해 주세요.');
    if(file.size>MAX_FILE_BYTES)throw new Error('파일은 2MB 이하만 가져올 수 있습니다.');
    const name=String(file.name||'').toLowerCase();
    if(name&&!/\.(csv|txt)$/.test(name))throw new Error('CSV 또는 TXT 파일만 가져올 수 있습니다.');
    const buf=await file.arrayBuffer();
    try{return new TextDecoder('utf-8',{fatal:true}).decode(buf);}
    catch{
      try{return new TextDecoder('euc-kr').decode(buf);}
      catch{throw new Error('UTF-8 또는 한글 CSV 인코딩으로 읽을 수 없습니다.');}
    }
  }

  function setValue(el,value){
    if(!el)return;
    const next=String(value??'');
    if(el.value===next)return;
    el.value=next;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function setQuoteCheck(records){
    const form=$('[data-quote-form]');
    if(!form)throw new Error('견적 입력 화면을 찾지 못했습니다.');
    for(const r of records){
      const row=$(`[data-qrow="${r.item}"]`,form);
      if(!row)throw new Error(`${r.item} 입력 행을 찾지 못했습니다.`);
    }
    for(const r of records){
      const row=$(`[data-qrow="${r.item}"]`,form);
      const radio=$(`[name="state-${r.item}"][value="${r.state}"]`,row);
      if(radio&&!radio.checked){
        radio.checked=true;
        radio.dispatchEvent(new Event('change',{bubbles:true}));
      }
      setValue($('[data-q-amount]',row),r.amount);
      setValue($('[data-q-qty]',row),r.qty);
      setValue($('[data-q-unit]',row),r.unit);
      setValue($('[data-q-spec]',row),r.spec);
      setValue($('[data-q-memo]',row),r.memo);
    }
  }

  function setCompare(records,target){
    if(!['a','b','c'].includes(target))throw new Error('가져올 업체 칸을 선택해 주세요.');
    const host=$('[data-compare-table]');
    if(!host)throw new Error('견적 비교표를 찾지 못했습니다.');
    for(const r of records){
      const row=$(`[data-compare-row="${r.item}"]`,host);
      if(!row||!$('[data-vendor="'+target+'"][data-state]',row)||!$('[data-vendor="'+target+'"][data-amount]',row)){
        throw new Error(`${r.item} 비교 행을 찾지 못했습니다.`);
      }
    }
    for(const r of records){
      const row=$(`[data-compare-row="${r.item}"]`,host);
      setValue($('[data-vendor="'+target+'"][data-state]',row),r.state);
      setValue($('[data-vendor="'+target+'"][data-amount]',row),r.amount);
    }
  }

  function injectStyle(){
    if($('#local-quote-import-style'))return;
    const style=document.createElement('style');
    style.id='local-quote-import-style';
    style.textContent=`
      .local-quote-import{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0;padding:12px;border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7)}
      .local-quote-import strong{font-size:13px}.local-quote-import button,.local-quote-import select{min-height:44px}
      .local-quote-import button{font-weight:700}.local-quote-import select{padding:0 10px}
      .local-quote-import .local-import-note{width:100%;margin:0;color:var(--muted,#777168);font-size:12px;line-height:1.5}
      .local-quote-import [data-local-import-status]{width:100%;margin:0;font-size:12px;line-height:1.5}
      @media(max-width:560px){.local-quote-import button{width:100%}.local-quote-import label{display:flex;align-items:center;gap:8px;width:100%}.local-quote-import select{flex:1}}
    `;
    document.head.append(style);
  }

  function createRoot(mode){
    const root=document.createElement('section');
    root.className='local-quote-import';
    root.dataset.localQuoteImport=mode;
    const input=document.createElement('input');
    input.type='file';input.accept='.csv,.txt,text/csv,text/plain';input.hidden=true;input.dataset.localImportFile='';
    const button=document.createElement('button');
    button.type='button';button.textContent='CSV/TXT 가져오기';button.dataset.localImportOpen='';
    const title=document.createElement('strong');title.textContent='로컬 파일 가져오기';
    root.append(title);
    if(mode==='compare'){
      const label=document.createElement('label');label.textContent='업체';
      const select=document.createElement('select');select.dataset.localImportVendor='';
      [['a','A'],['b','B'],['c','C']].forEach(([value,text])=>{
        const option=document.createElement('option');option.value=value;option.textContent=text+' 업체';select.append(option);
      });
      label.append(select);root.append(label);
    }
    root.append(button,input);
    const note=document.createElement('p');
    note.className='local-import-note';
    note.textContent=mode==='check'
      ? '헤더: 공종, 상태, 금액(만원), 수량, 단위, 사양, 메모 · 이 브라우저에서만 파일을 읽으며 서버로 전송하지 않습니다.'
      : '헤더: 공종, 상태, 금액(만원), 수량, 단위, 사양, 메모 · 비교표에는 선택한 업체의 상태·금액을 넣습니다. 서버 전송은 없습니다.';
    const status=document.createElement('p');status.dataset.localImportStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    root.append(note,status);
    return root;
  }

  function bindRoot(root,mode){
    const input=$('[data-local-import-file]',root),button=$('[data-local-import-open]',root),status=$('[data-local-import-status]',root);
    button.addEventListener('click',()=>input.click());
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;
      button.disabled=true;status.textContent='파일을 확인하는 중입니다.';
      try{
        const text=await decodeFile(file);
        const parsed=parseQuoteText(text);
        if(mode==='check')setQuoteCheck(parsed.data);
        else setCompare(parsed.data,$('[data-local-import-vendor]',root)?.value||'a');
        const kind=parsed.delimiter==='\t'?'TXT/TSV':'CSV';
        status.textContent=`${kind}에서 ${parsed.data.length}개 공종을 가져왔습니다. 적용 결과를 확인한 뒤 저장해 주세요.`;
      }catch(err){
        status.textContent=`가져오지 못했습니다. ${String(err?.message||err)}`;
      }finally{
        input.value='';button.disabled=false;
      }
    });
  }

  function init(){
    injectStyle();
    const quoteActions=$('[data-quote-report] .tool-actions');
    if(quoteActions&&!$('[data-local-quote-import="check"]')){
      const root=createRoot('check');quoteActions.before(root);bindRoot(root,'check');
    }
    const compareHost=$('[data-compare-table]');
    if(compareHost&&!$('[data-local-quote-import="compare"]')){
      const actions=$('.tool-actions',compareHost)||compareHost;
      const root=createRoot('compare');actions.before(root);bindRoot(root,'compare');
    }
  }

  window.InteriorLocalQuoteImportV1={
    parseQuoteText,detectDelimiter,parseDelimited,decodeFile,setQuoteCheck,setCompare,ITEMS,MAX_FILE_BYTES,MAX_SAFE_AMOUNT
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();