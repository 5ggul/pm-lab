import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const src=path.resolve('interior-cost-core/generate-v5.mjs');
const tmp=path.resolve('interior-cost-core/.generate-v5-runtime.mjs');
const root=path.resolve('docs/interior-cost-preview');
let code=fs.readFileSync(src,'utf8');
code=code.replace("function meta({title,desc,path:'/',type='website',schema=[]})", "function meta({title,desc,path='/',type='website',schema=[]})");
code=code.replace(
  "{'@context':'https://schema.org','@type':'WebSite',name:'견적검수실',url:SITE}",
  "{'@context':'https://schema.org','@type':'WebSite',name:'견적검수실',url:SITE,potentialAction:{'@type':'SearchAction',target:{'@type':'EntryPoint',urlTemplate:`${SITE}/search/?q={search_term_string}`},'query-input':'required name=search_term_string'}}"
);
code=code.replace(
  'value="included" checked>기재</label><label><input type="radio" name="state-${id}" value="separate">별도</label><label><input type="radio" name="state-${id}" value="missing">미기재',
  'value="included">기재</label><label><input type="radio" name="state-${id}" value="separate">별도</label><label><input type="radio" name="state-${id}" value="missing" checked>미기재'
);
code=code.replace(
  'select data-vendor="${v}" data-state><option value="included">포함</option><option value="separate">별도</option><option value="missing">미기재</option></select>',
  'select data-vendor="${v}" data-state><option value="included">포함</option><option value="separate">별도</option><option value="missing" selected>미기재</option></select>'
);
fs.writeFileSync(tmp,code);
try {
  await import(pathToFileURL(tmp).href+`?t=${Date.now()}`);
  const appPath=path.join(root,'assets','app-v5.js');
  let app=fs.readFileSync(appPath,'utf8');
  const oldSearch="  const searchForm=$('[data-site-search]');\n  if(searchForm){\n    searchForm.addEventListener('submit',e=>{\n      e.preventDefault();\n      const q=$('input',searchForm).value.trim();\n      if(q) location.href=`${BASE}/search/?q=${encodeURIComponent(q)}`;\n    });\n  }";
  const multiSearch="  $$('[data-site-search]').forEach(searchForm=>{\n    searchForm.addEventListener('submit',e=>{\n      e.preventDefault();\n      const q=$('input',searchForm)?.value.trim()||'';\n      if(q) location.href=`${BASE}/search/?q=${encodeURIComponent(q)}`;\n    });\n  });";
  app=app.replace(oldSearch,()=>multiSearch);
  app=app.replace(
    /    const summary=\$\('\[data-compare-summary\]'\);\n    if\(summary\)\{[\s\S]*?\n    \}\n    const diffOnly=/,
    ()=>"    const summary=$('[data-compare-summary]');\n    const hasAnyInput=coreItems.some(([id])=>vendors.some(v=>{const x=readCompareVendor(v,id);return x.state!=='missing'||Number(x.amount||0)>0;}));\n    if(summary){\n      summary.innerHTML=!hasAnyInput\n        ? '<strong>아직 비교 전입니다.</strong><br>각 업체 견적의 포함·별도·미기재와 금액을 입력하면 조건 차이를 표시합니다.'\n        : criticalDiff.length\n          ? `<strong>단순 총액 비교 불가</strong><br>${criticalDiff.map(id=>coreItems.find(x=>x[0]===id)?.[1]).join(' · ')} 조건이 업체마다 다릅니다. 같은 조건으로 맞춘 뒤 금액을 비교하세요.`\n          : '<strong>핵심 포함조건은 동일합니다.</strong><br>사양·수량이 같은지 확인한 뒤 금액 차이를 해석하세요.';\n    }\n    const diffOnly="
  );
  app=app.replace(
    /  function initCompare\(\)\{[\s\S]*?\n  \}\n\n  function initBudget/,
    ()=>`  function compareStorageKey(el){
    const row=el.closest('[data-compare-row]');
    const item=row?.dataset.compareRow||'';
    const vendor=el.dataset.vendor||'';
    const kind=el.hasAttribute('data-state')?'state':'amount';
    return \`${'${item}:${vendor}:${kind}'}\`;
  }
  function initCompare(){
    const host=$('[data-compare-table]');if(!host)return;
    const fields=$$('[data-vendor]',host);
    const saved=storage.get('interior-compare-v5',{});
    fields.forEach(el=>{
      const key=compareStorageKey(el);
      if(saved&&saved[key]!=null) el.value=saved[key];
      el.addEventListener('input',updateCompare);
      el.addEventListener('change',updateCompare);
    });
    $('[data-diff-only]')?.addEventListener('change',updateCompare);
    $('[data-save-compare]')?.addEventListener('click',()=>{
      const data={};fields.forEach(el=>data[compareStorageKey(el)]=el.value);
      storage.set('interior-compare-v5',data);toast('비교표를 저장했습니다.');
    });
    $('[data-reset-compare]')?.addEventListener('click',()=>{storage.del('interior-compare-v5');location.reload()});
    $('[data-print]')?.addEventListener('click',()=>window.print());
    updateCompare();
  }

  function initBudget`
  );
  app=app.replace(
    /  function initBudget\(\)\{[\s\S]*?\n  \}\n\n  function initChecklist/,
    ()=>`  function budgetStorageKey(el){
    if(el.hasAttribute('data-vat')) return 'vat';
    const row=el.closest('[data-budget-row]');
    const item=row?.dataset.budgetRow||'';
    const kind=el.hasAttribute('data-qty')?'qty':el.hasAttribute('data-unit')?'unit':el.hasAttribute('data-unit-price')?'price':'included';
    return \`${'${item}:${kind}'}\`;
  }
  function initBudget(){
    const root=$('[data-budget-builder]');if(!root)return;
    const fields=$$('[data-qty],[data-unit],[data-unit-price],[data-included],[data-vat]',root);
    const saved=storage.get('interior-budget-v5',{});
    fields.forEach(el=>{const key=budgetStorageKey(el);if(saved&&saved[key]!=null)el.value=saved[key]});
    const calc=()=>{
      let subtotal=0;
      $$('[data-budget-row]',root).forEach(row=>{
        const qty=Number($('[data-qty]',row)?.value||0);
        const price=Number($('[data-unit-price]',row)?.value||0);
        const included=$('[data-included]',row)?.value!=='no';
        const line=qty*price;
        const out=$('[data-line-total]',row);
        if(out) out.textContent=included?\`${'${fmt(Math.round(line))}만원'}\`:'제외';
        if(included) subtotal+=line;
      });
      const vatMode=$('[data-vat]',root)?.value||'excluded';
      const total=vatMode==='add10'?subtotal*1.1:subtotal;
      const out=$('[data-budget-total]',root);
      if(out) out.textContent=vatMode==='excluded'?\`${'${fmt(Math.round(total))}만원 + VAT 별도'}\`:\`${'${fmt(Math.round(total))}만원'}\`;
    };
    fields.forEach(el=>{el.addEventListener('input',calc);el.addEventListener('change',calc)});
    $('[data-save-budget]')?.addEventListener('click',()=>{
      const data={};fields.forEach(el=>data[budgetStorageKey(el)]=el.value);
      storage.set('interior-budget-v5',data);toast('예산 시나리오를 저장했습니다.');
    });
    $('[data-reset-budget]')?.addEventListener('click',()=>{storage.del('interior-budget-v5');location.reload()});
    $('[data-print]')?.addEventListener('click',()=>window.print());
    calc();
  }

  function initChecklist`
  );
  app=app.replace(
    /  function initChecklist\(\)\{[\s\S]*?\n  \}\n\n  function initOneSet/,
    ()=>`  function initChecklist(){
    const root=$('[data-checklist]');if(!root)return;
    const key='interior-checklist-v5';
    const checks=$$('input[data-check-id]',root);
    const saved=storage.get(key,{});
    checks.forEach(el=>{el.checked=!!saved[el.dataset.checkId]});
    const update=()=>{
      const done=checks.filter(x=>x.checked).length;
      const out=$('[data-check-progress]',root);
      if(out) out.textContent=\`${'${done} / ${checks.length}'}\`;
    };
    checks.forEach(el=>el.addEventListener('change',update));
    $('[data-save-check]')?.addEventListener('click',()=>{
      const data={};checks.forEach(el=>data[el.dataset.checkId]=el.checked);
      storage.set(key,data);toast('체크 상태를 저장했습니다.');
    });
    $('[data-reset-check]')?.addEventListener('click',()=>{storage.del(key);checks.forEach(x=>x.checked=false);update()});
    $('[data-print]')?.addEventListener('click',()=>window.print());
    update();
  }

  function initOneSet`
  );
  app=app.replace(
    /  function initOneSet\(\)\{[\s\S]*?\n  \}\n\n  initSearchPage/,
    ()=>`  function initOneSet(){
    const root=$('[data-one-set]');if(!root)return;
    const select=$('[data-one-set-type]',root),amount=$('[data-one-set-amount]',root),host=$('[data-one-set-result]',root);
    if(!select||!amount||!host)return;
    const key='interior-one-set-v5',saved=storage.get(key,{});
    if(saved.type)select.value=saved.type;if(saved.amount!=null)amount.value=saved.amount;
    const sets={
      bathroom:['철거','폐기물','방수','타일 자재','타일 시공','도기','수전','천장','환풍기','젠다이','배관','전기'],
      kitchen:['기존 가구 철거','상부장','하부장','상판','키큰장','아일랜드','싱크볼','수전','후드','급배수 이동','전기 회로','벽 타일'],
      window:['창별 수량','가로×세로 치수','내창/외창','프레임','유리 사양','철거','실리콘·마감','양중','사다리차','폐기물']
    };
    const persist=()=>storage.set(key,{type:select.value,amount:amount.value});
    const render=()=>{
      const rows=sets[select.value]||[];
      const money=Number(amount.value||0);
      host.innerHTML=\`${'${money?`<p><strong>표시 금액</strong> ${fmt(money)}만원 — 세부 금액으로 임의 배분하지 않습니다.</p>`:""}<h3>세부 확인 항목</h3><ol>${rows.map(x=>`<li>${x}</li>`).join("")}</ol>'}\`;
      persist();
    };
    select.addEventListener('change',render);amount.addEventListener('input',render);render();
  }

  initSearchPage`
  );
  if(!app.includes("$$('[data-site-search]').forEach(searchForm=>")) throw new Error('multi-search binding patch failed');
  if(app.includes("\n  $('[data-site-search]').forEach(searchForm=>")) throw new Error('invalid single-element forEach binding detected');
  if(!app.includes('아직 비교 전입니다.')) throw new Error('compare empty-state patch failed');
  if(!app.includes('function compareStorageKey(el)')) throw new Error('compare event/storage patch failed');
  if(app.includes("$$('[data-compare-key]')")) throw new Error('obsolete compare-key selector remains');
  if(!app.includes("const root=$('[data-budget-builder]')")) throw new Error('budget binding patch failed');
  if(app.includes("$('[data-budget-form]')")||app.includes("$$('[data-budget-key]')")) throw new Error('obsolete budget selector remains');
  if(!app.includes("input[data-check-id]")) throw new Error('checklist binding patch failed');
  if(app.includes('data-reset-checklist')||app.includes('data-progress-bar')) throw new Error('obsolete checklist selector remains');
  if(!app.includes("$('[data-one-set-type]',root)")) throw new Error('one-set binding patch failed');
  if(app.includes('data-one-set-select')||app.includes('data-one-set-output')) throw new Error('obsolete one-set selector remains');
  fs.writeFileSync(appPath,app);

  const cssPath=path.join(root,'assets','site-v5.css');
  let css=fs.readFileSync(cssPath,'utf8');
  const marker='/* v5-mobile-readable-tables */';
  if(!css.includes(marker)) css+=`\n${marker}\n@media(max-width:700px){\n  .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;padding-bottom:4px}\n  .data-table{table-layout:auto!important;min-width:520px}\n  .data-table th,.data-table td{font-size:13px!important;line-height:1.55!important;padding:10px 8px!important;word-break:keep-all!important}\n}\n@media(max-width:390px){\n  .data-table th,.data-table td{font-size:12.5px!important;padding:9px 7px!important}\n}\n`;
  fs.writeFileSync(cssPath,css);

  const appHash=crypto.createHash('sha1').update(app).digest('hex').slice(0,10);
  const cssHash=crypto.createHash('sha1').update(css).digest('hex').slice(0,10);
  const htmlFiles=[];
  const collect=dir=>{
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,ent.name);
      if(ent.isDirectory()) collect(full);
      else if(ent.name.endsWith('.html')) htmlFiles.push(full);
    }
  };
  collect(root);
  for(const file of htmlFiles){
    let html=fs.readFileSync(file,'utf8');
    html=html.replace(/app-v5\.js\?v=[a-f0-9]+/g,`app-v5.js?v=${appHash}`);
    html=html.replace(/site-v5\.css\?v=[a-f0-9]+/g,`site-v5.css?v=${cssHash}`);
    fs.writeFileSync(file,html);
  }
  const reportPath=path.join(root,'data','v5-report.json');
  const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
  report.build=cssHash;
  report.app_build=appHash;
  report.quote_default_state='missing';
  report.compare_default_state='missing';
  report.compare_binding='data-vendor';
  report.budget_binding='budget-row';
  report.checklist_binding='check-id';
  report.one_set_binding='one-set-type';
  report.mobile_table_mode='readable-scroll';
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
} finally {
  fs.rmSync(tmp,{force:true});
}
