import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const root=path.resolve(process.env.SSG_PRODUCTION_OUTPUT||'');
const reportPath=path.resolve(process.env.SSG_PRODUCTION_CANDIDATE_REPORT||'');
const evidenceDir=path.resolve(process.env.SSG_QA_OUTPUT||'artifacts/franchise-release-rehearsal');
const base=new URL(process.env.SSG_QA_BASE_URL||'http://127.0.0.1:8776/');
const productionOrigin='https://franchise-release-contract.invalid';
const previewNeedles=['https://5ggul.github.io/pm-lab/franchise-ssg-preview','/pm-lab/franchise-ssg-preview'];
const noindex='noindex,nofollow,noarchive,nosnippet';

assert.ok(process.env.SSG_QA_DEP_ROOT,'SSG_QA_DEP_ROOT required');
assert.ok(process.env.SSG_PRODUCTION_OUTPUT,'SSG_PRODUCTION_OUTPUT required');
assert.ok(process.env.SSG_PRODUCTION_CANDIDATE_REPORT,'SSG_PRODUCTION_CANDIDATE_REPORT required');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname)&&base.protocol==='http:','Loopback rehearsal server only');
assert.ok(fs.existsSync(root),'Production rehearsal candidate must exist');
assert.ok(fs.existsSync(reportPath),'Production candidate report must exist');
assert.ok(!root.includes(path.join('docs','franchise-ssg-preview')),'Rehearsal output must not be the preview tree');

const {chromium}=await import(pathToFileURL(path.join(process.env.SSG_QA_DEP_ROOT,'node_modules/playwright/index.mjs')).href);
const build=JSON.parse(fs.readFileSync(reportPath,'utf8'));
assert.equal(build.testMode,true,'Browser rehearsal must use release test mode');
assert.equal(build.decision,'PRODUCTION_CANDIDATE_BUILT_NOT_DEPLOYED','Only inspect a built, non-deployed candidate');
assert.equal(build.indexPolicyFinalized,true,'Production index policy must be finalized before browser QA');
assert.equal(build.productionSite,'RESERVED_TEST_ORIGIN','Test-mode report must redact the reserved test origin');
assert.equal(build.requestedCandidateCount,184,'Locked requested candidate count');
assert.ok(Array.isArray(build.effectiveCandidateUrls)&&build.effectiveCandidateUrls.length>0,'Effective candidate set required');
assert.equal(build.candidateCount,build.effectiveCandidateUrls.length,'Effective candidate count must match report');
assert.equal(build.sitemapUrlCount,build.candidateCount,'Sitemap count must match effective candidates');

fs.mkdirSync(evidenceDir,{recursive:true});
const evidencePath=path.join(evidenceDir,'production-candidate-browser.json');
const effective=new Set(build.effectiveCandidateUrls.map(normalizeRoute));
const htmlFiles=[];
walk(root,htmlFiles);
assert.equal(htmlFiles.length,311,'Locked production HTML route count');
const routes=htmlFiles.map(file=>routeFromHtml(path.relative(root,file))).sort();
assert.equal(new Set(routes).size,311,'Production HTML routes must be unique');

function walk(dir,out){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())walk(p,out);else if(ent.name.endsWith('.html'))out.push(p);
  }
}
function normalizeRoute(value){
  const clean=String(value||'/').split('#')[0].split('?')[0];
  if(clean==='/'||clean==='')return '/';
  return `/${clean.replace(/^\/+|\/+$/g,'')}/`;
}
function routeFromHtml(rel){
  const p=rel.replace(/\\/g,'/');
  return p==='index.html'?'/':normalizeRoute('/'+p.replace(/\/index\.html$/,''));
}
function routeFile(route){return route==='/'?path.join(root,'index.html'):path.join(root,...route.split('/').filter(Boolean),'index.html');}
function canonicalFromHtml(html){return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]||html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]||'';}
function localUrl(route){return new URL(route==='/'?'./':'.'+route,base).href;}
function selfCanonical(route){return route==='/'?`${productionOrigin}/`:`${productionOrigin}${route}`;}
function persistEvidence(payload){fs.writeFileSync(evidencePath,JSON.stringify(payload,null,2)+'\n');}

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const cases=[];
let cursor=0;

async function auditRoute(route){
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',locale:'ko-KR'});
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  const pageErrors=[],localFailures=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('response',response=>{
    if(response.status()>=400&&new URL(response.url()).origin===base.origin)localFailures.push({url:response.url(),status:response.status()});
  });
  const result={route,pass:false,indexExpected:effective.has(route)};
  try{
    const source=fs.readFileSync(routeFile(route),'utf8');
    const expectedCan=canonicalFromHtml(source);
    assert.ok(expectedCan.startsWith(`${productionOrigin}/`),`Candidate canonical must stay on reserved .invalid origin: ${expectedCan}`);
    if(effective.has(route))assert.equal(expectedCan,selfCanonical(route),'Indexed candidate must be self-canonical');
    const response=await page.goto(localUrl(route),{waitUntil:'domcontentloaded',timeout:20000});
    assert.equal(response?.status(),200,'HTTP status');
    await page.locator('main h1').first().waitFor({state:'visible'});
    const dom=await page.evaluate(()=>({
      h1:[...document.querySelectorAll('main h1')].filter(el=>el.getClientRects().length).map(el=>el.textContent.trim()),
      robots:document.querySelector('meta[name="robots"]')?.content||'',
      googlebot:document.querySelector('meta[name="googlebot"]')?.content||'',
      bingbot:document.querySelector('meta[name="bingbot"]')?.content||'',
      canonical:document.querySelector('link[rel="canonical"]')?.href||'',
      footer:document.querySelectorAll('[data-production-operator="1"]').length,
      previewBar:document.querySelectorAll('.preview-bar').length,
      html:document.documentElement.outerHTML,
      scrollWidth:document.documentElement.scrollWidth,
      width:innerWidth
    }));
    const expectedRobots=effective.has(route)?'index,follow':noindex;
    assert.equal(dom.h1.length,1,'Exactly one visible main H1');
    assert.equal(dom.robots,expectedRobots,'robots policy');
    assert.equal(dom.googlebot,expectedRobots,'googlebot policy');
    assert.equal(dom.bingbot,expectedRobots,'bingbot policy');
    assert.equal(dom.canonical,expectedCan,'Browser canonical must equal transformed production HTML');
    assert.equal(dom.footer,1,'Production operator footer');
    assert.equal(dom.previewBar,0,'Preview bar must be removed');
    assert.ok(dom.scrollWidth<=dom.width+1,`Document overflow ${dom.scrollWidth}/${dom.width}`);
    for(const needle of previewNeedles)assert.ok(!dom.html.includes(needle),`Preview URL leaked: ${needle}`);
    assert.deepEqual(pageErrors,[],'Uncaught browser errors');
    assert.deepEqual(localFailures,[],'Failed same-origin resources');
    result.pass=true;
    result.robots=dom.robots;
    result.canonical=dom.canonical;
  }catch(error){
    result.error=error.message;
    console.error('ROUTE_FAIL '+JSON.stringify({route,error:error.message,indexExpected:result.indexExpected,pageErrors,localFailures}));
  }
  result.pageErrors=pageErrors;
  if(localFailures.length)result.localFailures=localFailures;
  cases.push(result);
  await context.close();
}

try{
  await Promise.all(Array.from({length:4},async()=>{
    while(cursor<routes.length){
      const route=routes[cursor++];
      await auditRoute(route);
    }
  }));

  const keyRoutes=['/','/brands/','/categories/','/explore/','/compare/','/tools/','/about/','/contact/','/privacy/','/terms/','/brands/mega-mgc-coffee/','/categories/cafe/','/tools/startup-cost/'];
  const keyCases=[];
  for(const width of [390,1440]){
    for(const route of keyRoutes){
      const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',locale:'ko-KR'});
      const page=await context.newPage();page.setDefaultTimeout(10000);
      const entry={route,width,pass:false};
      try{
        const response=await page.goto(localUrl(route),{waitUntil:'domcontentloaded',timeout:20000});
        assert.equal(response?.status(),200);
        await page.locator('main h1').first().waitFor({state:'visible'});
        const state=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth,h1:[...document.querySelectorAll('main h1')].filter(el=>el.getClientRects().length).length,footer:document.querySelectorAll('[data-production-operator="1"]').length}));
        assert.ok(state.scrollWidth<=state.width+1,`Key route overflow ${state.scrollWidth}/${state.width}`);
        assert.equal(state.h1,1);
        assert.equal(state.footer,1);
        entry.pass=true;
        if(['/','/about/','/privacy/'].includes(route)){
          const safe=(route==='/'?'home':route.replaceAll('/',''));
          entry.screenshot=`${safe}-${width}.png`;
          await page.screenshot({path:path.join(evidenceDir,entry.screenshot),animations:'disabled',fullPage:true});
        }
      }catch(error){
        entry.error=error.message;
        console.error('KEY_ROUTE_FAIL '+JSON.stringify({route,width,error:error.message}));
      }
      keyCases.push(entry);
      await context.close();
    }
  }

  let legal=[];
  let robotsError=null;
  let sitemapError=null;
  let sitemapUrls=[];
  try{legal=await checkLegalPages();}catch(error){console.error('LEGAL_FAIL '+JSON.stringify({error:error.message}));throw error;}

  try{
    const robots=await fetch(new URL('robots.txt',base)).then(r=>{assert.equal(r.status,200);return r.text()});
    assert.ok(/User-agent:\s*\*/i.test(robots),'robots user-agent');
    assert.ok(/Allow:\s*\//i.test(robots),'Production rehearsal robots must allow crawling');
    assert.ok(robots.includes(`Sitemap: ${productionOrigin}/sitemap.xml`),'Production sitemap declaration');
    assert.ok(!/Disallow:\s*\//i.test(robots),'Production rehearsal robots must not globally disallow');
  }catch(error){robotsError=error.message;console.error('ROBOTS_FAIL '+JSON.stringify({error:error.message}));}

  try{
    const sitemap=await fetch(new URL('sitemap.xml',base)).then(r=>{assert.equal(r.status,200);return r.text()});
    sitemapUrls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
    assert.equal(sitemapUrls.length,build.candidateCount,'Sitemap URL count');
    assert.deepEqual(new Set(sitemapUrls).size,sitemapUrls.length,'Unique sitemap URLs');
    assert.ok(sitemapUrls.every(url=>url.startsWith(`${productionOrigin}/`)),'Sitemap must use only .invalid production origin');
    for(const needle of previewNeedles)assert.ok(!sitemap.includes(needle),'Preview URL leaked into sitemap');
  }catch(error){sitemapError=error.message;console.error('SITEMAP_FAIL '+JSON.stringify({error:error.message}));}

  cases.sort((a,b)=>a.route.localeCompare(b.route));
  const failed=cases.filter(x=>!x.pass),failedKey=keyCases.filter(x=>!x.pass);
  const indexed=cases.filter(x=>x.robots==='index,follow').length;
  const noindexed=cases.filter(x=>x.robots===noindex).length;
  const countErrors=[];
  if(indexed!==build.candidateCount)countErrors.push(`Browser-observed index count ${indexed} != ${build.candidateCount}`);
  if(noindexed!==311-build.candidateCount)countErrors.push(`Browser-observed noindex count ${noindexed} != ${311-build.candidateCount}`);
  if(failed.length)console.error('FAILED_CASES '+JSON.stringify(failed.slice(0,50)));
  if(failedKey.length)console.error('FAILED_KEY_CASES '+JSON.stringify(failedKey));
  if(countErrors.length)console.error('COUNT_FAIL '+JSON.stringify(countErrors));

  const pass=!failed.length&&!failedKey.length&&!robotsError&&!sitemapError&&!countErrors.length;
  const output={
    kind:'production-candidate-browser-rehearsal',
    generatedAt:new Date().toISOString(),
    sourceHead:process.env.SSG_QA_SOURCE_SHA||null,
    testMode:true,
    reportProductionSite:build.productionSite,
    productionOrigin,
    realProductionDomainUsed:false,
    productionDeploy:false,
    htmlPages:routes.length,
    requestedCandidates:build.requestedCandidateCount,
    effectiveCandidates:build.candidateCount,
    indexed,
    noindexed,
    sitemapUrls:sitemapUrls.length,
    canonicalAliasDemotions:(build.canonicalAliasDemotions||[]).length,
    legal,
    failedCases:failed,
    failedKeyCases:failedKey,
    robotsError,
    sitemapError,
    countErrors,
    keyCases,
    pass,
    cases
  };
  persistEvidence(output);
  console.log('SUMMARY '+JSON.stringify({...output,cases:undefined,keyCases:undefined,failedCases:failed.slice(0,10)}));

  assert.equal(robotsError,null,'Production robots browser contract');
  assert.equal(sitemapError,null,'Production sitemap browser contract');
  assert.equal(indexed,build.candidateCount,'Browser-observed index count');
  assert.equal(noindexed,311-build.candidateCount,'Browser-observed noindex count');
  assert.equal(failed.length,0,'All production rehearsal routes must render');
  assert.equal(failedKey.length,0,'All key responsive production routes must render');
}finally{
  await browser.close();
}

async function checkLegalPages(){
  const checks=[
    ['/about/',['RELEASE CONTRACT TEST','TEST ONLY - NOT FOR PUBLICATION']],
    ['/contact/',['release-contract@example.invalid','TEST ONLY']],
    ['/privacy/',['계약 테스트 개인정보처리방침','실제 운영 문서가 아닙니다']],
    ['/terms/',['계약 테스트 이용약관','실제 운영 약관이 아닙니다']]
  ];
  const result=[];
  for(const [route,needles] of checks){
    const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',locale:'ko-KR'});
    const page=await context.newPage();
    await page.goto(localUrl(route),{waitUntil:'domcontentloaded'});
    const text=await page.locator('main').innerText();
    for(const needle of needles)assert.ok(text.includes(needle),`${route} missing ${needle}`);
    result.push({route,needles,pass:true});
    await context.close();
  }
  return result;
}
