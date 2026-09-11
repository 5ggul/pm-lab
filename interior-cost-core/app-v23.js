(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const clean=s=>String(s??'').trim();
  const key=s=>clean(s).toLowerCase().replace(/[\s_\-./()\[\]{}]/g,'');
  const num=s=>{const n=Number(String(s??'').replace(/,/g,'').replace(/원|₩/g,'').trim());return Number.isFinite(n)?n:null};

  function parseCsvLine(line,delim){
    const out=[];let cur='',q=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(q&&line[i+1]==='"'){cur+='"';i++;}
        else q=!q;
      }else if(ch===delim&&!q){out.push(cur.trim());cur='';}
      else cur+=ch;
    }
    out.push(cur.trim());return out;
  }
  function detectDelimiter(lines){
    const first=lines.find(Boolean)||'';
    const scores=[[',',(first.match(/,/g)||[]).length],['\t',(first.match(/\t/g)||[]).length],[';',(first.match(/;/g)||[]).length]];
    scores.sort((a,b)=>b[1]-a[1]);return scores[0][1]>0?scores[0][0]:null;
  }
  function normalizeUnit(raw){
    const v=clean(raw);if(!v)return'';
    if(['㎡','m2','M2','m²','M²','m^2','M^2'].includes(v))return'㎡';
    if(v==='m'||v==='M')return'M';
    return v;
  }
  function inferTrade(item,tradeRaw,trades){
    const direct=key(tradeRaw),byId=trades.find(t=>key(t.id)===direct||key(t.label)===direct);if(byId)return byId.id;
    const text=key(`${item} ${tradeRaw}`);
    const scores=trades.map(t=>({id:t.id,score:(t.keywords||[]).reduce((n,k)=>n+(text.includes(key(k))?1:0),n)})).sort((a,b)=>b.score-a.score);
    return scores[0]?.score>0?scores[0].id:'';
  }
  function headerMap(cells,aliases){
    const map={};for(let i=0;i<cells.length;i++){const k=key(cells[i]);for(const [field,names] of Object.entries(aliases||{}))if(names.some(x=>key(x)===k)){map[field]=i;break;}}
    return map;
  }
  function isHeader(map){return Object.keys(map).length>=2&&('item'in map||'qty'in map||'price'in map||'total'in map)}
  function rowFromCells(cells,map,trades){
    const get=f=>map&&map[f]!=null?clean(cells[map[f]]):'';
    const item=get('item')||(map?clean(cells[0]):clean(cells[0]));
    const tradeRaw=get('trade')||(map?'':clean(cells[1]));
    const unit=normalizeUnit(get('unit')||(map?'':clean(cells[2])));
    const qty=num(get('qty')||(map?'':cells[3]));
    let price=num(get('price')||(map?'':cells[4]));
    const total=num(get('total'));
    let derived=false;if((price===null||price<=0)&&total!==null&&qty!==null&&qty>0){price=total/qty;derived=true;}
    return {item,trade:inferTrade(item,tradeRaw,trades),trade_raw:tradeRaw,unit,qty:qty??'',price:price??'',total:total??'',derived_price:derived};
  }
  function rowFromPlain(line,trades){
    const raw=clean(line);if(!raw)return null;
    const unitMatch=raw.match(/(?:^|\s)(㎡|m2|M2|m²|M²|m\^2|M\^2|M|m|EA|개|매|재|㎥)(?=\s|$)/);
    const unit=normalizeUnit(unitMatch?.[1]||'');
    const numeric=[...raw.matchAll(/(?:^|\s)([0-9][0-9,]*(?:\.[0-9]+)?)(?=\s|$)/g)].map(m=>({text:m[1],index:m.index||0,value:num(m[1])})).filter(x=>x.value!==null);
    const price=numeric.length?numeric[numeric.length-1].value:'';
    const qty=numeric.length>1?numeric[numeric.length-2].value:'';
    let item=raw;
    for(const n of numeric)item=item.replace(n.text,' ');
    if(unitMatch)item=item.replace(unitMatch[1],' ');
    item=item.replace(/\s+/g,' ').trim();
    const trade=inferTrade(item,'',trades);
    return {item,trade,trade_raw:'',unit,qty,price,total:'',derived_price:false};
  }
  function parseText(text,config){
    const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length)return {rows:[],mode:'empty',truncated:0};
    const delim=detectDelimiter(lines),trades=config.trades||[],aliases=config.import?.header_aliases||{};
    let rows=[],mode=delim==='\t'?'tsv':delim?'csv':'plain';
    if(delim){
      const first=parseCsvLine(lines[0],delim),map=headerMap(first,aliases),header=isHeader(map),start=header?1:0;
      for(let i=start;i<lines.length;i++){const cells=parseCsvLine(lines[i],delim);if(cells.every(x=>!clean(x)))continue;rows.push(rowFromCells(cells,header?map:null,trades));}
    }else for(const line of lines){const r=rowFromPlain(line,trades);if(r)rows.push(r);}
    rows=rows.filter(r=>r.item||r.trade||r.unit||r.qty!==''||r.price!=='');
    const max=Number(config.rules?.max_lines||12),truncated=Math.max(0,rows.length-max);if(rows.length>max)rows=rows.slice(0,max);
    return {rows,mode,truncated};
  }

  function initImport(){
    const root=$('[data-v22-tool]'),box=$('[data-v23-import]');if(!root||!box)return;
    const v22=(()=>{try{return JSON.parse($('[data-v22-config]',root)?.textContent||'{}')}catch{return{}}})();
    const importMeta={header_aliases:{item:['항목','항목명','공사항목','품명','내역','description','item','name'],trade:['공종','분류','category','trade'],unit:['단위','unit'],qty:['수량','면적','quantity','qty'],price:['단가','견적단가','내견적단가','unitprice','price'],total:['금액','합계','총액','amount','total']}};
    v22.import=importMeta;
    const text=$('[data-v23-import-text]',box),file=$('[data-v23-import-file]',box),parseBtn=$('[data-v23-parse]',box),applyBtn=$('[data-v23-apply]',box),clearBtn=$('[data-v23-clear]',box),status=$('[data-v23-status]',box),preview=$('[data-v23-preview]',box),linesHost=$('[data-v22-lines]',root),addBtn=$('[data-v22-add-line]',root);
    let parsed=[];
    const tradeLabel=id=>(v22.trades||[]).find(t=>t.id===id)?.label||'미분류';
    const setStatus=s=>{if(status)status.textContent=s};
    function renderPreview(result){
      parsed=result.rows;
      if(applyBtn)applyBtn.disabled=!parsed.length;
      if(preview){
        preview.hidden=!parsed.length;
        preview.innerHTML=parsed.length?`<div class="table-wrap"><table class="v23-preview-table"><thead><tr><th>#</th><th>항목</th><th>공종</th><th>단위</th><th>수량</th><th>단가</th><th>상태</th></tr></thead><tbody>${parsed.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.item||'-')}</td><td>${esc(tradeLabel(r.trade))}</td><td>${esc(r.unit||'-')}</td><td>${esc(r.qty||'-')}</td><td>${r.price!==''?Number(r.price).toLocaleString('ko-KR'):'-'}</td><td>${r.derived_price?'총액÷수량 단가':'원문'}</td></tr>`).join('')}</tbody></table></div>`:'';
      }
      const warnings=parsed.filter(r=>!r.trade||!r.unit||!(Number(r.qty)>0)||!(Number(r.price)>0)).length;
      setStatus(`${result.mode.toUpperCase()} · ${parsed.length}개 행 분석${result.truncated?` · ${result.truncated}개는 최대 행 수 초과로 제외`:''}${warnings?` · ${warnings}개 행은 공종/단위/수량/단가 확인 필요`:''}`);
    }
    function analyze(){renderPreview(parseText(text?.value||'',v22));}
    function dispatch(el,type){el?.dispatchEvent(new Event(type,{bubbles:true}));}
    function ensureLineCount(n){
      for(const line of $$('[data-v22-line]',root))line.remove();
      for(let i=0;i<n;i++)addBtn?.click();
    }
    function apply(){
      if(!parsed.length)return;ensureLineCount(parsed.length);
      const lines=$$('[data-v22-line]',root);
      parsed.forEach((r,i)=>{
        const line=lines[i];if(!line)return;
        const name=$('[data-v22-item-name]',line),trade=$('[data-v22-trade]',line),unit=$('[data-v22-unit]',line),qty=$('[data-v22-qty]',line),price=$('[data-v22-price]',line),confirm=$('[data-v22-confirm]',line);
        if(name){name.value=r.item||'';dispatch(name,'input');}
        if(trade&&r.trade){trade.value=r.trade;dispatch(trade,'change');}
        if(unit&&r.unit&&[...unit.options].some(o=>o.value===r.unit)){unit.value=r.unit;dispatch(unit,'change');}
        if(qty&&r.qty!==''){qty.value=String(r.qty);dispatch(qty,'input');}
        if(price&&r.price!==''){price.value=String(Math.round(Number(r.price)*100)/100);dispatch(price,'input');}
        if(confirm)confirm.checked=false;
      });
      setStatus(`${parsed.length}개 행을 비교표에 채웠습니다. 공식 참고항목은 선택하지 않았고 범위·규격 확인도 체크하지 않았습니다.`);
      root.scrollIntoView({behavior:'smooth',block:'start'});
    }
    parseBtn?.addEventListener('click',analyze);applyBtn?.addEventListener('click',apply);
    clearBtn?.addEventListener('click',()=>{if(text)text.value='';if(file)file.value='';parsed=[];if(applyBtn)applyBtn.disabled=true;if(preview){preview.hidden=true;preview.innerHTML='';}setStatus('입력 내용을 지웠습니다. 비교표의 기존 행은 유지합니다.');});
    file?.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;if(f.size>1024*1024){setStatus('1MB 이하 CSV/TXT 파일만 불러옵니다.');file.value='';return;}try{const s=await f.text();if(text)text.value=s;analyze();}catch{setStatus('파일을 읽지 못했습니다.');}});
  }
  function markReady(){if(document.body)document.body.dataset.v23Ready='1'}
  function init(){initImport();markReady()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
