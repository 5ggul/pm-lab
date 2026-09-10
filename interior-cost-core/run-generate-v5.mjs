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
      const data={};
      fields.forEach(el=>data[compareStorageKey(el)]=el.value);
      storage.set('interior-compare-v5',data);
      toast('비교표를 저장했습니다.');
    });
    $('[data-reset-compare]')?.addEventListener('click',()=>{storage.del('interior-compare-v5');location.reload()});
    $('[data-print]')?.addEventListener('click',()=>window.print());
    updateCompare();
  }

  function initBudget`
  );
  if(!app.includes("$$('[data-site-search]').forEach(searchForm=>")) throw new Error('multi-search binding patch failed');
  if(app.includes("\n  $('[data-site-search]').forEach(searchForm=>")) throw new Error('invalid single-element forEach binding detected');
  if(!app.includes('아직 비교 전입니다.')) throw new Error('compare empty-state patch failed');
  if(!app.includes('function compareStorageKey(el)')) throw new Error('compare event/storage patch failed');
  if(app.includes("$$('[data-compare-key]')")) throw new Error('obsolete compare-key selector remains');
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
  report.mobile_table_mode='readable-scroll';
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
} finally {
  fs.rmSync(tmp,{force:true});
}
