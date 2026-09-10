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
fs.writeFileSync(tmp,code);
try {
  await import(pathToFileURL(tmp).href+`?t=${Date.now()}`);
  const appPath=path.join(root,'assets','app-v5.js');
  let app=fs.readFileSync(appPath,'utf8');
  const oldSearch="  const searchForm=$('[data-site-search]');\n  if(searchForm){\n    searchForm.addEventListener('submit',e=>{\n      e.preventDefault();\n      const q=$('input',searchForm).value.trim();\n      if(q) location.href=`${BASE}/search/?q=${encodeURIComponent(q)}`;\n    });\n  }";
  const multiSearch="  $$('[data-site-search]').forEach(searchForm=>{\n    searchForm.addEventListener('submit',e=>{\n      e.preventDefault();\n      const q=$('input',searchForm)?.value.trim()||'';\n      if(q) location.href=`${BASE}/search/?q=${encodeURIComponent(q)}`;\n    });\n  });";
  app=app.replace(oldSearch,()=>multiSearch);
  if(!app.includes("$$('[data-site-search]').forEach(searchForm=>")) throw new Error('multi-search binding patch failed');
  if(app.includes("\n  $('[data-site-search]').forEach(searchForm=>")) throw new Error('invalid single-element forEach binding detected');
  fs.writeFileSync(appPath,app);

  const appHash=crypto.createHash('sha1').update(app).digest('hex').slice(0,10);
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
    fs.writeFileSync(file,html);
  }
  const reportPath=path.join(root,'data','v5-report.json');
  const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
  report.app_build=appHash;
  report.quote_default_state='missing';
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
} finally {
  fs.rmSync(tmp,{force:true});
}
