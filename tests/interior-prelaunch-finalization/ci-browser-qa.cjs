'use strict';
// QA rerun after schema backfill 2

const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

const ROOT='docs/interior-cost-preview';
const BASE=(process.env.QA_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const PREFIX='/pm-lab/interior-cost-preview';
const PREVIEW_CANON='https://5ggul.github.io/pm-lab/interior-cost-preview';
const results=[],failures=[];
function record(name,ok,detail=''){
  results.push({name,ok:!!ok,detail:String(detail??'')});
  if(!ok)failures.push({name,detail:String(detail??'')});
  console.log('['+(ok?'PASS':'FAIL')+'] '+name+(detail?' :: '+detail:''));
}
function must(ok,name,detail=''){record(name,ok,detail);if(!ok)throw new Error(name+(detail?': '+detail:''));}
function read(p){return fs.readFileSync(p,'utf8');}
function routeToFile(route){return route==='/'?path.join(ROOT,'index.html'):path.join(ROOT,route.replace(/^\//,'').replace(/\/$/,''),'index.html');}
function jsonLd(html){
  const arr=[];
  for(const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)){
    arr.push(JSON.parse(m[1]));
  }
  return arr;
}
function types(obj,out=[]){
  if(!obj||typeof obj!=='object')return out;
  if(Array.isArray(obj)){obj.forEach(x=>types(x,out));return out;}
  if(obj['@type'])out.push(obj['@type']);
  Object.values(obj).forEach(v=>types(v,out));
  return out;
}

(async()=>{
  const allow=JSON.parse(read(path.join(ROOT,'data/index-release-allowlist-v1.json')));
  const readiness=JSON.parse(read(path.join(ROOT,'data/prelaunch-readiness-v1.json')));
  const sitemap=read(path.join(ROOT,'sitemap.xml'));
  const sitemapProd=read(path.join(ROOT,'sitemap-production.xml'));
  const routes=allow.index_routes;

  must(readiness.state==='READY_FOR_OWNER_FINAL_REVIEW','readiness state is owner-final-review',readiness.state);
  must(routes.length===allow.index_count,'allowlist count matches',String(routes.length));
  must(routes.length===69,'index allowlist frozen at 69 routes',String(routes.length));
  must(allow.region_detail_index_count===0,'no region detail route in allowlist');
  must(sitemap===sitemapProd,'sitemap.xml equals sitemap-production.xml');

  const sitemapLocs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  must(sitemapLocs.length===routes.length,'sitemap count matches allowlist',String(sitemapLocs.length));
  must(!sitemapLocs.includes(PREVIEW_CANON+'/region/'),'region hub remains outside protected production sitemap');
  must(!sitemapLocs.some(x=>/\/region\/[^/]+\/$/.test(x)),'region details excluded from sitemap');
  must(!sitemapLocs.some(x=>/answers-v|production-simulator|production-diff|ad-layout|coverage|launch-gate/i.test(x)),'internal QA/data routes excluded from sitemap');

  let schemaScripts=0,guideCount=0,datasetCount=0,toolCount=0;
  const tools=new Set(['/calculator/','/checklist/','/one-set/','/quote-check/','/quote-compare/','/quote-items/']);
  for(const route of routes){
    const file=routeToFile(route);
    must(fs.existsSync(file),'allowlisted file exists',route);
    const h=read(file);
    must(/<meta name="robots" content="[^"]*noindex/i.test(h),'preview noindex preserved',route);
    must(h.includes('property="og:image" content="'+PREVIEW_CANON+'/assets/og-default.svg"'),'og:image present',route);
    must(h.includes('name="twitter:card" content="summary_large_image"'),'large Twitter card present',route);
    must(h.includes('name="twitter:image" content="'+PREVIEW_CANON+'/assets/og-default.svg"'),'twitter:image present',route);
    const canonical=(h.match(/<link rel="canonical" href="([^"]+)"/i)||[])[1]||'';
    must(canonical.startsWith(PREVIEW_CANON),'canonical remains preview base until owner cutover',route+' :: '+canonical);
    const scripts=jsonLd(h); schemaScripts+=scripts.length;
    must(scripts.length>0,'JSON-LD parses',route);
    const t=scripts.flatMap(x=>types(x));
    if(/^\/guides\/[^/]+\/$/.test(route)){
      guideCount++;
      must(h.includes('data-direct-answer="true"'),'guide answer-first marker present',route);
      must(t.includes('FAQPage'),'guide FAQPage present',route);
    }
    if(/^\/data\/(construction-wage|cost-index|quote-statistics)\//.test(route)||/^\/data\/public-unit-cost\//.test(route)){
      datasetCount++;
      must(t.includes('Dataset'),'data route Dataset schema present',route);
    }
    if(tools.has(route)){
      toolCount++;
      must(t.includes('WebApplication')||t.includes('SoftwareApplication'),'tool application schema present',route);
    }
  }
  must(guideCount===20,'all 20 guide detail pages validated',String(guideCount));
  must(datasetCount===14,'all dataset routes validated',String(datasetCount));
  must(toolCount===6,'all six tool routes validated',String(toolCount));
  must(schemaScripts>=70,'structured-data scripts parse across candidates',String(schemaScripts));

  const home=read(path.join(ROOT,'index.html'));
  const homeScripts=jsonLd(home); const homeTypes=homeScripts.flatMap(x=>types(x));
  must(homeTypes.includes('Organization'),'home Organization schema present');
  must(homeTypes.includes('FAQPage'),'home FAQPage schema present');
  must(home.includes('"logo":{"@type":"ImageObject","url":"'+PREVIEW_CANON+'/assets/logo.svg"'),'Organization logo configured');
  must(home.includes('"sameAs":["https://github.com/5ggul/pm-lab"]'),'Organization sameAs configured');
  must(home.includes('"contactPoint"'),'Organization contactPoint configured');
  must(home.includes('data-home-faq="prelaunch"'),'home visible FAQ present');

  const guideHub=read(path.join(ROOT,'guides/index.html'));
  must(guideHub.includes('data-guide-hub-start="prelaunch"'),'guide hub has start-here orientation');

  const contact=read(path.join(ROOT,'contact/index.html'));
  must(contact.includes('data-contact-channel="github"')&&contact.includes('https://github.com/5ggul/pm-lab/issues/new'),'real contact/error-report channel present');

  const regionHub=read(path.join(ROOT,'region/index.html'));
  must((regionHub.match(/REGION · N=0/g)||[]).length===0,'region hub repeated N=0 cards removed');
  must(regionHub.includes('data-region-release-summary'),'region hub single release summary present');
  must(!/\/region\/(seoul|busan|daegu|incheon|gwangju|daejeon|ulsan|sejong|gyeonggi|gangwon|chungbuk|chungnam|jeonbuk|jeonnam|gyeongbuk|gyeongnam|jeju)\//.test(regionHub),'region hub does not link held details');

  const regionNames=['seoul','busan','daegu','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi','gangwon','chungbuk','chungnam','jeonbuk','jeonnam','gyeongbuk','gyeongnam','jeju'];
  for(const slug of regionNames){
    const h=read(path.join(ROOT,'region',slug,'index.html'));
    must(/<meta name="robots" content="noindex,follow,noarchive,nosnippet">/i.test(h),'region detail hard noindex-follow',slug);
    must(/<body\b[^>]*data-index-state="hold"/i.test(h),'region detail hold state',slug);
  }

  const robots=read(path.join(ROOT,'robots.txt'));
  const robotsProd=read(path.join(ROOT,'robots-production.txt'));
  must(/Disallow:\s*\//.test(robots),'preview robots still blocks crawling');
  must(/Allow:\s*\//.test(robotsProd),'production robots template allows crawling');
  must(robotsProd.includes('Sitemap: '+PREVIEW_CANON+'/sitemap.xml'),'production robots template references real sitemap.xml');

  must(fs.existsSync(path.join(ROOT,'assets/og-default.svg')),'OG asset exists');
  must(fs.existsSync(path.join(ROOT,'assets/logo.svg')),'logo asset exists');

  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'ko-KR'});
  const pageErrors=[],badResponses=[];
  context.on('page',p=>{
    p.on('pageerror',e=>pageErrors.push({url:p.url(),message:String(e?.message||e)}));
    p.on('response',r=>{if(r.status()>=400)badResponses.push({status:r.status(),url:r.url()});});
  });
  try{
    const req=context.request;
    for(const route of routes){
      const res=await req.get(BASE+PREFIX+route,{timeout:30000});
      must(res.ok(),'candidate HTTP 200',route+' :: '+res.status());
    }
    for(const asset of ['/assets/og-default.svg','/assets/logo.svg','/sitemap.xml','/data/index-release-allowlist-v1.json','/data/prelaunch-readiness-v1.json']){
      const res=await req.get(BASE+PREFIX+asset,{timeout:30000});
      must(res.ok(),'release artifact HTTP 200',asset+' :: '+res.status());
    }

    const p=await context.newPage();
    await p.goto(BASE+PREFIX+'/',{waitUntil:'networkidle',timeout:60000});
    must((await p.locator('[data-home-faq="prelaunch"]').count())===1,'home FAQ renders once');
    must((await p.locator('[data-home-faq="prelaunch"] article').count())===3,'home FAQ renders three questions');

    await p.goto(BASE+PREFIX+'/region/',{waitUntil:'networkidle',timeout:60000});
    must((await p.locator('[data-region-release-summary]').count())===1,'region release summary renders');
    must((await p.locator('[data-v10-region-card]').count())===0,'region repeated cards absent in rendered DOM');

    await p.goto(BASE+PREFIX+'/guides/',{waitUntil:'networkidle',timeout:60000});
    must((await p.locator('[data-guide-hub-start="prelaunch"]').count())===1,'guide start-here block renders');

    await p.goto(BASE+PREFIX+'/contact/',{waitUntil:'networkidle',timeout:60000});
    must((await p.locator('[data-contact-channel="github"] a[href*="github.com/5ggul/pm-lab/issues/new"]').count())===1,'contact issue link renders');

    await p.goto(BASE+PREFIX+'/search/?q=32%ED%8F%89',{waitUntil:'networkidle',timeout:60000});
    await p.waitForTimeout(300);
    const searchLinks=await p.locator('a[href]').evaluateAll(as=>as.map(a=>a.getAttribute('href')||''));
    must(!searchLinks.some(h=>/^\/pm-lab\/interior-cost-preview\/region\/[^/]+\/$/.test(h)),'search excludes held region detail URLs');

    const widths=[360,375,390,430];
    const pages=['/','/quote-check/','/quote-compare/','/region/','/guides/'];
    for(const width of widths){
      const mc=await browser.newContext({viewport:{width:width,height:820},hasTouch:true,isMobile:true,locale:'ko-KR'});
      const mp=await mc.newPage();
      for(const route of pages){
        const r=await mp.goto(BASE+PREFIX+route,{waitUntil:'domcontentloaded',timeout:60000});
        must(!!r&&r.ok(),'mobile HTTP 200',width+' '+route);
        await mp.waitForTimeout(120);
        const metrics=await mp.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
        must(metrics.sw<=metrics.cw+1,'mobile no horizontal overflow',width+' '+route+' :: '+JSON.stringify(metrics));
      }
      await mc.close();
    }

    must(pageErrors.length===0,'no uncaught page errors',JSON.stringify(pageErrors));
    must(badResponses.length===0,'no 4xx/5xx browser responses',JSON.stringify(badResponses));
  }finally{
    await context.close();
    await browser.close();
  }

  console.log('QA_TOTAL_ASSERTIONS='+results.length);
  console.log('QA_FAILURES='+failures.length);
  console.log('INDEX_ALLOWLIST='+routes.length);
  console.log('GUIDE_FAQ_COUNT='+guideCount);
  console.log('DATASET_COUNT='+datasetCount);
  if(failures.length)process.exitCode=1;
})().catch(err=>{console.error(err?.stack||err);console.log('QA_FAILURES='+(failures.length+1));process.exit(1);});
