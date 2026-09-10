import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const src=path.resolve('interior-cost-core/generate-v5.mjs');
const tmp=path.resolve('interior-cost-core/.generate-v5-runtime.mjs');
let code=fs.readFileSync(src,'utf8');
code=code.replace("function meta({title,desc,path:'/',type='website',schema=[]})", "function meta({title,desc,path='/',type='website',schema=[]})");
code=code.replace(
  "{'@context':'https://schema.org','@type':'WebSite',name:'견적검수실',url:SITE}",
  "{'@context':'https://schema.org','@type':'WebSite',name:'견적검수실',url:SITE,potentialAction:{'@type':'SearchAction',target:{'@type':'EntryPoint',urlTemplate:`${SITE}/search/?q={search_term_string}`},'query-input':'required name=search_term_string'}}"
);
fs.writeFileSync(tmp,code);
try {
  await import(pathToFileURL(tmp).href+`?t=${Date.now()}`);
  const appPath=path.resolve('docs/interior-cost-preview/assets/app-v5.js');
  let app=fs.readFileSync(appPath,'utf8');
  app=app.replace(
    "  const searchForm=$('[data-site-search]');\n  if(searchForm){\n    searchForm.addEventListener('submit',e=>{\n      e.preventDefault();\n      const q=$('input',searchForm).value.trim();\n      if(q) location.href=`${BASE}/search/?q=${encodeURIComponent(q)}`;\n    });\n  }",
    "  $$('[data-site-search]').forEach(searchForm=>{\n    searchForm.addEventListener('submit',e=>{\n      e.preventDefault();\n      const q=$('input',searchForm)?.value.trim()||'';\n      if(q) location.href=`${BASE}/search/?q=${encodeURIComponent(q)}`;\n    });\n  });"
  );
  fs.writeFileSync(appPath,app);
} finally {
  fs.rmSync(tmp,{force:true});
}
