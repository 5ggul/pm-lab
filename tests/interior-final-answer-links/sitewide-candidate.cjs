'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

const FETCH_ORIGIN=(process.env.QA_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const CANONICAL_ORIGIN='https://5ggul.github.io';
const PREFIX='/pm-lab/interior-cost-preview';
const SITE_ROOT=path.resolve('docs/interior-cost-preview');
const results=[],failures=[];

function record(name,ok,detail=''){
  results.push({name,ok:!!ok,detail:String(detail??'')});
  if(!ok) failures.push({name,detail:String(detail??'')});
  console.log('['+(ok?'PASS':'FAIL')+'] '+name+(detail?' :: '+detail:''));
}
function walk(dir){
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...walk(full));
    else if(e.isFile()&&e.name==='index.html') out.push(full);
  }
  return out;
}
function liveUrlForFile(file){
  const rel=path.relative(SITE_ROOT,file).split(path.sep).join('/');
  if(rel==='index.html') return FETCH_ORIGIN+PREFIX+'/';
  return FETCH_ORIGIN+PREFIX+'/'+rel.replace(/index\.html$/,'');
}
function canonical(html){
  return html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
    ||html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1]||'';
}
function hasNoindex(html){
  return /<meta\s+[^>]*name=["'](?:robots|googlebot)["'][^>]*content=["'][^"']*noindex/i.test(html)
    ||/<meta\s+[^>]*content=["'][^"']*noindex[^"']*["'][^>]*name=["'](?:robots|googlebot)["']/i.test(html);
}
function attrUrls(html,base){
  const out=[];
  const re=/\b(?:href|src)=["']([^"']+)["']/gi;
  for(const m of html.matchAll(re)){
    const raw=m[1].trim();
    if(!raw||raw.startsWith('#')||/^(?:data|mailto|tel|javascript):/i.test(raw)) continue;
    try{
      const u=new URL(raw,base);
      u.hash='';
      if(u.pathname.startsWith(PREFIX)){
      u.protocol=new URL(FETCH_ORIGIN).protocol;
      u.host=new URL(FETCH_ORIGIN).host;
      out.push(u.href);
    }
    }catch{}
  }
  return out;
}
async function mapLimit(items,limit,fn){
  let next=0;
  const workers=Array.from({length:Math.min(limit,items.length)},async()=>{
    while(true){
      const i=next++;
      if(i>=items.length) return;
      await fn(items[i],i);
    }
  });
  await Promise.all(workers);
}

(async()=>{
  const files=walk(SITE_ROOT).sort();
  record('repository contains 202 interior HTML pages',files.length===202,String(files.length));

  const sitemap=fs.readFileSync(path.join(SITE_ROOT,'sitemap-production.xml'),'utf8');
  const sitemapUrls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim());
  record('production sitemap has public URLs',sitemapUrls.length>=60,String(sitemapUrls.length));
  record('production sitemap URLs are unique',new Set(sitemapUrls).size===sitemapUrls.length,String(sitemapUrls.length));

  const blocked=['/region/','/quote-batch/','/quote-intake/','/quote-market/','/search/','/compare/','/interior-cost/matrix/'];
  for(const frag of blocked) record('sitemap excludes protected '+frag,!sitemapUrls.some(u=>u.includes(frag)));

  const allHtml=new Map();
  const resourceUrls=new Set();
  await mapLimit(files,16,async(file)=>{
    const url=liveUrlForFile(file);
    try{
      const r=await fetch(url,{redirect:'follow'});
      const html=await r.text();
      allHtml.set(url,html);
      record('HTTP 200 '+new URL(url).pathname,r.status===200,String(r.status));
      record('title present '+new URL(url).pathname,/<title>[^<]{2,}<\/title>/i.test(html));
      record('h1 present '+new URL(url).pathname,/<h1\b[^>]*>/i.test(html));
      record('preview noindex '+new URL(url).pathname,hasNoindex(html));
      const c=canonical(html);
      record('canonical absolute '+new URL(url).pathname,c.startsWith(CANONICAL_ORIGIN+PREFIX+'/'),c||'(missing)');
      for(const ref of attrUrls(html,url)) resourceUrls.add(ref);
    }catch(e){
      record('fetch '+url,false,String(e));
    }
  });

  const sitemapSet=new Set(sitemapUrls.map(u=>u.replace(/\/+$/,'/')));
  for(const u of sitemapUrls){
    const canonicalNorm=u.replace(/\/+$/,'/');
    const fetchNorm=canonicalNorm.replace(CANONICAL_ORIGIN,FETCH_ORIGIN);
    const html=allHtml.get(fetchNorm)||allHtml.get(fetchNorm.replace(/\/$/,'/'));
    if(!html){
      record('sitemap URL maps to repository page '+new URL(u).pathname,false,'not found in fetched index set');
      continue;
    }
    const c=canonical(html).replace(/\/+$/,'/');
    record('public canonical matches sitemap URL '+new URL(u).pathname,c===canonicalNorm,c);
  }

  const answerJsonPath=path.join(SITE_ROOT,'data','answer-index-v11.json');
  const answerHtmlPath=path.join(SITE_ROOT,'data','answers-v11','index.html');
  const answerData=JSON.parse(fs.readFileSync(answerJsonPath,'utf8'));
  const answerHtml=fs.readFileSync(answerHtmlPath,'utf8');
  const answerLinks=[...answerHtml.matchAll(/<article\b[^>]*data-v11-answer[^>]*>[\s\S]*?<a\s+href=["']([^"']+)["']>근거 페이지<\/a>[\s\S]*?<\/article>/g)].map(m=>m[1]);
  record('v11 answer index count is 90',answerData.count===90&&answerData.answers?.length===90,JSON.stringify({count:answerData.count,rows:answerData.answers?.length}));
  record('v11 answer JSON URLs are complete',answerData.answers.every(a=>typeof a.url==='string'&&a.url.length>0&&!a.url.includes('undefined')));
  record('v11 answer HTML has 90 evidence links',answerLinks.length===90,String(answerLinks.length));
  record('v11 answer HTML has no undefined evidence links',answerLinks.every(x=>x&&x!=='undefined'&&!x.includes('/undefined')));
  record('v11 generated answers match JSON URLs',answerLinks.every((x,i)=>x===answerData.answers[i]?.url));

  const resources=[...resourceUrls];
  let badResourceCount=0;
  await mapLimit(resources,20,async(url)=>{
    try{
      const r=await fetch(url,{redirect:'follow'});
      if(r.status>=400){
        badResourceCount++;
        record('internal resource '+new URL(url).pathname,false,String(r.status));
      }
    }catch(e){
      badResourceCount++;
      record('internal resource '+url,false,String(e));
    }
  });
  record('all internal href/src resources resolve',badResourceCount===0,'checked='+resources.length+' bad='+badResourceCount);

  const robots=fs.readFileSync(path.join(SITE_ROOT,'robots.txt'),'utf8');
  const robotsProd=fs.readFileSync(path.join(SITE_ROOT,'robots-production.txt'),'utf8');
  record('preview robots still blocks crawl',/User-agent:\s*\*[\s\S]*Disallow:\s*\//i.test(robots));
  record('production robots template allows crawl',!/Disallow:\s*\//i.test(robotsProd)&&/Allow:\s*\//i.test(robotsProd));
  record('production robots template declares sitemap',/Sitemap:/i.test(robotsProd));

  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true,locale:'ko-KR'});
  const pageErrors=[],badResponses=[];

  const extraPaths=['/region/','/quote-batch/','/quote-intake/','/quote-market/','/search/','/compare/reference-layers/','/interior-cost/matrix/','/quote-paste/'];
  const browserUrls=[...new Set([...sitemapUrls.map(u=>u.replace(CANONICAL_ORIGIN,FETCH_ORIGIN)),...extraPaths.map(p=>FETCH_ORIGIN+PREFIX+p)])];

  let next=0;
  const workerCount=4;
  await Promise.all(Array.from({length:workerCount},async(_,wi)=>{
    const page=await context.newPage();
    let current='';
    page.on('pageerror',e=>pageErrors.push({url:current,message:String(e?.message||e)}));
    page.on('response',r=>{
      if(r.status()>=400&&r.url().startsWith(FETCH_ORIGIN+PREFIX)) badResponses.push({page:current,status:r.status(),url:r.url()});
    });
    while(true){
      const i=next++;
      if(i>=browserUrls.length) break;
      const url=browserUrls[i];
      current=url;
      try{
        const resp=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
        const m=await page.evaluate(()=>({
          width:document.documentElement.scrollWidth,
          client:document.documentElement.clientWidth,
          h1:(document.querySelector('h1')?.textContent||'').trim(),
          main:!!document.querySelector('main'),
          text:(document.body?.innerText||'').trim().length,
          robots:document.querySelector('meta[name="robots"]')?.content||''
        }));
        record('mobile HTTP '+new URL(url).pathname,!!resp&&resp.ok(),resp?String(resp.status()):'no response');
        record('mobile no page overflow '+new URL(url).pathname,m.width<=m.client+1,JSON.stringify({width:m.width,client:m.client}));
        record('mobile main+h1 '+new URL(url).pathname,m.main&&m.h1.length>0,m.h1);
        record('mobile non-empty body '+new URL(url).pathname,m.text>=100,String(m.text));
        record('live preview remains noindex '+new URL(url).pathname,/noindex/i.test(m.robots),m.robots);
      }catch(e){
        record('mobile browser '+url,false,String(e));
      }
    }
    await page.close();
  }));
  await context.close();
  await browser.close();

  record('sitewide browser has no uncaught page errors',pageErrors.length===0,JSON.stringify(pageErrors.slice(0,10)));
  record('sitewide browser has no internal 4xx/5xx resources',badResponses.length===0,JSON.stringify(badResponses.slice(0,10)));

  const report={
    schema:'interior-final-sitewide-candidate-audit/v2',
    generatedAt:new Date().toISOString(),
    repositoryPages:files.length,
    sitemapUrls:sitemapUrls.length,
    internalResources:resources.length,
    browserUrls:browserUrls.length,
    passed:results.filter(r=>r.ok).length,
    failed:failures.length,
    results,failures,pageErrors,badResponses
  };
  fs.writeFileSync(process.env.QA_RESULT_PATH||'sitewide-live.json',JSON.stringify(report,null,2)+'\n');
  console.log('SITEWIDE_PAGES='+files.length);
  console.log('SITEMAP_URLS='+sitemapUrls.length);
  console.log('BROWSER_URLS='+browserUrls.length);
  console.log('QA_TOTAL_ASSERTIONS='+results.length);
  console.log('QA_FAILURES='+failures.length);
  if(failures.length) process.exitCode=1;
})().catch(err=>{console.error(err?.stack||err);process.exit(1);});
