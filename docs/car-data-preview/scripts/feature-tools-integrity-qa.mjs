import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {patchSavedConditions} from './saved-conditions.mjs';
import {normalizeRows, buildIndex, validateAliases, exactKey} from './official-issues-data.mjs';
import {siteConfig} from './site-config.mjs';
import {REVIEWED_TOOL_ROUTES, reviewedToolIndexChecks, reviewedToolSchemaChecks} from './reviewed-tool-index-quality.mjs';

// Static, offline inspection only. The sole output is this run's QA report.
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const source=path.join(repo,'docs/car-data-preview');
const production=path.resolve(process.env.FEATURE_TOOLS_PRODUCTION_DIR||path.join(repo,'build/peekmycar-production'));
const output=path.join(repo,'output/feature-tools-20261020/integrity-report.json');
const read=(root,file)=>fs.readFileSync(path.join(root,file),'utf8');
const json=(root,file)=>JSON.parse(read(root,file));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const lfHash=text=>hash(text.replace(/\r\n/g,'\n'));
const failures=[],sections=[],stats={};let checks=0;
const equal=(actual,expected,label)=>{checks++;assert.deepEqual(actual,expected,label);};
const valid=(condition,label)=>{checks++;assert(condition,label);};
const scenario=(name,run)=>{try{run();sections.push({name,ok:true});}catch(error){failures.push({name,message:error.message});sections.push({name,ok:false});}};
const one=(values,label)=>{equal(values.length,1,label+' appears once');return values[0];};
const decode=value=>String(value??'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
function attrs(tag){return Object.fromEntries([...tag.slice(0,tag.indexOf('>')+1).matchAll(/\s+([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(m=>[m[1].toLowerCase(),decode(m[2]??m[3]??m[4])]));}
const tags=(html,name)=>[...html.matchAll(new RegExp('<'+name+'\\b[^>]*>','gi'))].map(m=>attrs(m[0]));
const meta=(html,key)=>one(tags(html,'meta').filter(tag=>tag.name===key||tag.property===key),key+' metadata').content;
const scripts=html=>tags(html,'script').filter(tag=>tag.src);
const assetName=url=>decode(url).split('?')[0].split('/').at(-1);
const scriptCount=(html,name)=>scripts(html).filter(tag=>assetName(tag.src)===name).length;
const isRedirect=html=>tags(html,'meta').some(tag=>tag['http-equiv']?.toLowerCase()==='refresh');
function htmlPages(root){const files=new Map();function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.isDirectory()&&['assets','data','scripts'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.name.endsWith('.html'))files.set(path.relative(root,file).split(path.sep).join('/'),fs.readFileSync(file,'utf8'));}}walk(root);return files;}
const toFile=route=>route.replace(/^\//,'').replace(/\/$/,'/index.html')||'index.html';
const routeOf=file=>'/'+file.replace(/index\.html$/,'');
const newTools=[{slug:'fuel-efficiency',module:'measured-efficiency.js'},{slug:'car-installment',module:'car-installment.js'}];
const baselineCostHash='3712e93eb0c014e23bbcb4ab8b2f2b4c7621c20a74d6ae0832dd87ab80767105';
// Historical evidence of the first reviewed import, never an allowlist for
// future annual replacements. Current assertions follow the validated manifest.
const initialOfficialEvidence={
  reports:{sha256:'9f069900299da423fac09059e7695e93d7a49bc48fb17eb9d2ce9bc10f137696',period:{from:'2025-01-02',to:'2025-12-31',basis:'received_date'}},
  recalls:{sha256:'f8ec0a20cbef74cc583e303bf233ab4b209c6c608731dfef29680a433aebabdf',period:{from:'2025-01-02',to:'2025-12-22',basis:'recall_start'}}
};
let sourcePages,releasePages,baseline,manifest;
scenario('load isolated source, release and committed policy',()=>{
  sourcePages=htmlPages(source);releasePages=htmlPages(production);
  baseline=JSON.parse(execFileSync('git',['show','HEAD:docs/car-data-preview/data/index-quality-gate.json'],{cwd:repo,encoding:'utf8'}));
  manifest=json(production,'review-build.json');
  stats.baselineSha=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
  stats.release=manifest;stats.sourceHtmlPages=sourcePages.size;stats.productionHtmlPages=releasePages.size;
});

if(sourcePages&&releasePages&&baseline&&manifest){
  scenario('only the two approved calculators and current recall notices may add indexable URLs',()=>{
    const current=json(source,'data/index-quality-gate.json');
    const currentByPath=new Map(current.pages.map(page=>[page.path,page]));
    const originalReady=baseline.pages.filter(page=>page.status==='release_ready').map(page=>page.path).sort();
    const originalReadySet=new Set(originalReady);
    const currentReady=current.pages.filter(page=>page.status==='release_ready').map(page=>page.path).sort();
    const approvedRecallPaths=new Set(json(source,'data/recalls.json').notices.filter(notice=>/^[a-z0-9][a-z0-9-]*$/.test(notice.slug||'')).map(notice=>'/recalls/'+notice.slug+'/'));
    const approvedToolPaths=new Set(REVIEWED_TOOL_ROUTES);
    const approvedToolAdditions=currentReady.filter(route=>!originalReadySet.has(route)&&approvedToolPaths.has(route));
    const generatedRecallAdditions=currentReady.filter(route=>!originalReadySet.has(route)&&!approvedToolPaths.has(route));
    equal(currentByPath.size,current.pages.length,'quality-gate paths have no duplicates');
    equal(current.summary.failed,0,'quality gate has no failed pages');
    for(const page of baseline.pages){
      const expectedStatus=approvedToolPaths.has(page.path)?'release_ready':page.status;
      equal(currentByPath.get(page.path)?.status,expectedStatus,page.path+' keeps its approved indexing decision');
      const html=releasePages.get(toFile(page.path));valid(typeof html==='string',page.path+' remains in the bundle');
      equal(meta(html,'robots').split(',').map(x=>x.trim()).includes('index'),expectedStatus==='release_ready',page.path+' production indexing agrees with approved policy');
    }
    for(const route of generatedRecallAdditions){
      valid(approvedRecallPaths.has(route),route+' is an actual current recall notice, never an unrelated automatic indexing addition');
      const html=releasePages.get(toFile(route));valid(typeof html==='string',route+' newly generated recall is present in the bundle');
      valid(meta(html,'robots').split(',').map(value=>value.trim()).includes('index'),route+' new approved recall is indexable');
    }
    const origin=new URL(manifest.origin);
    const sitemap=[...read(production,'sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>decode(m[1])).sort();
    equal(sitemap,currentReady.map(route=>new URL(route,origin).href).sort(),'production sitemap exactly matches the current approved quality-gate URLs');
    equal(manifest.indexablePages,currentReady.length,'release manifest count matches the current approved URLs');
    for(const tool of newTools){
      const route='/tools/'+tool.slug+'/';equal(currentByPath.get(route)?.status,'release_ready',route+' passes the reviewed calculator policy');
      valid(sitemap.includes(new URL(route,origin).href),route+' is present in the production sitemap');
      const methodChecks=[...reviewedToolIndexChecks(toFile(route),releasePages.get(toFile(route))),...reviewedToolSchemaChecks(releasePages.get(toFile(route)))];
      valid(Array.isArray(methodChecks)&&methodChecks.every(check=>check.pass),route+' retains its static formulas, worked examples, limitations and related links');
    }
    stats.indexablePages=sitemap.length;
    equal(currentReady,[...new Set([...originalReady,...REVIEWED_TOOL_ROUTES,...generatedRecallAdditions])].sort(),'only explicitly approved tools or current recall notices can extend the committed indexable URL set');
    stats.indexingPolicy={committedReady:originalReady.length,currentReady:currentReady.length,approvedToolAdditions,generatedRecallAdditions,initialReviewedIndexablePages:147};
  });

  for(const tool of newTools)for(const [label,pages,base]of [['source',sourcePages,siteConfig.baseUrl],['production',releasePages,manifest.origin]])scenario(label+' '+tool.slug+' module, metadata and three stylesheet layers',()=>{
    const route='/tools/'+tool.slug+'/',html=pages.get(toFile(route));valid(typeof html==='string',label+' '+route+' exists');
    const policy=meta(html,'robots').split(',').map(x=>x.trim());
    if(label==='source')valid(policy.includes('noindex')&&!policy.includes('index'),label+' '+route+' preview remains noindex');
    else valid(policy.includes('index')&&!policy.includes('noindex'),label+' '+route+' approved production route is indexable');
    const canonical=one(tags(html,'link').filter(tag=>tag.rel==='canonical'),label+' canonical');
    equal(canonical.href,new URL(route.slice(1),base).href,label+' '+route+' has its own canonical');
    const h1=one([...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>m[1].replace(/<[^>]+>/g,'').trim()),label+' H1');valid(h1.length>0,label+' H1 has text');
    const runtime=one(scripts(html).filter(tag=>assetName(tag.src)===tool.module),label+' '+tool.module);equal(runtime.type,'module',label+' new tool is an ES module');
    const styles=tags(html,'link').filter(tag=>tag.rel==='stylesheet').map(tag=>assetName(tag.href));equal(styles,['tokens.css','base.css','tools.css'],label+' new tool uses exactly tokens/base/tools');
  });

  for(const [label,pages,base]of [['source',sourcePages,siteConfig.baseUrl],['production',releasePages,manifest.origin]])scenario(label+' tools hub keeps every old tool and both new links',()=>{
    const html=pages.get('tools/index.html');valid(typeof html==='string',label+' hub exists');
    const hrefs=tags(html,'a').filter(tag=>tag.href).map(tag=>new URL(tag.href,new URL('tools/',base)).pathname);
    const legacy=execFileSync('git',['ls-tree','-d','--name-only','HEAD:docs/car-data-preview/tools'],{cwd:repo,encoding:'utf8'}).trim().split('\n').filter(Boolean);
    for(const slug of new Set([...legacy,...newTools.map(tool=>tool.slug)]))valid(hrefs.includes(new URL('tools/'+slug+'/',base).pathname),label+' hub links to '+slug);
  });

  for(const [label,pages]of [['source',sourcePages],['production',releasePages]])scenario(label+' EV extension preserves its original calculator',()=>{
    const html=pages.get('tools/ev-charge-cost/index.html');valid(typeof html==='string',label+' EV tool exists');
    for(const name of ['cost-math.js','simple-cost-tools.js','ev-charge-planner.js'])equal(scriptCount(html,name),1,label+' '+name+' occurs once');
    equal(scripts(html).find(tag=>assetName(tag.src)==='ev-charge-planner.js').type,'module',label+' EV planner is an ES module');
    for(const id of ['simpleCostForm','distance','efficiency','unitPrice','costResult','costBreakdown'])equal(tags(html,id==='simpleCostForm'?'form':id==='costResult'?'output':id==='costBreakdown'?'p':'input').filter(tag=>tag.id===id).length,1,label+' keeps legacy EV '+id);
    equal(tags(html,'section').filter(tag=>Object.hasOwn(tag,'data-ev-charge-planner')).length,1,label+' EV planner has one independent section');
  });

  const savedEligible=(route,html)=>route==='tools/index.html'||/^tools\/[^/]+\/index\.html$/.test(route)||route==='cars/family/index.html'||/^cars\/[^/]+\/[^/]+\/(?:[^/]+\/)*index\.html$/.test(route)||(route.startsWith('compare/')&&!isRedirect(html));
  for(const [label,pages]of [['source',sourcePages],['production',releasePages]])scenario(label+' saved-condition widgets and modules have one owner',()=>{
    let eligible=0;
    for(const [route,html]of pages){
      const expected=savedEligible(route,html)?1:0;
      equal(tags(html,'details').filter(tag=>Object.hasOwn(tag,'data-saved-conditions')).length,expected,label+' '+route+' saved widget count');
      equal(scriptCount(html,'saved-conditions.js'),expected,label+' '+route+' saved module count');
      if(expected){equal(scripts(html).find(tag=>assetName(tag.src)==='saved-conditions.js').type,'module',label+' '+route+' saved runtime type');eligible++;}
    }
    stats[label+'SavedConsumers']=eligible;
  });
  scenario('saved-condition patch is pure and idempotent on eligible and unrelated routes',()=>{
    const fixture='<html><head><title>계산</title></head><body><main><h1>계산</h1></main></body></html>';
    const yes=['tools/index.html','tools/fuel-efficiency/index.html','tools/car-installment/index.html','tools/ev-charge-cost/index.html','compare/index.html','compare/example/index.html','cars/family/index.html','cars/hyundai/grandeur-gn7/hybrid/index.html'];
    const no=['index.html','community/index.html','auth/callback/index.html','search/index.html','cars/index.html','cars/hyundai/index.html','rankings/hybrid-fuel-economy/index.html','recalls/index.html'];
    for(const route of [...yes,...no]){const first=patchSavedConditions(fixture,route);equal(patchSavedConditions(first,route),first,route+' pure patch is idempotent');equal(scriptCount(first,'saved-conditions.js'),yes.includes(route)?1:0,route+' pure patch scope');}
    for(const [route,html]of sourcePages){const first=patchSavedConditions(html,route);equal(patchSavedConditions(first,route),first,route+' actual HTML can be patched idempotently without writes');}
  });

  scenario('approved cost-math source and production engine hashes are unchanged',()=>{
    const committed=execFileSync('git',['show','HEAD:docs/car-data-preview/assets/cost-math.js'],{cwd:repo,encoding:'utf8'});
    equal(lfHash(committed),baselineCostHash,'committed cost engine agrees with the approved LF-normalized hash');
    equal(lfHash(read(source,'assets/cost-math.js')),baselineCostHash,'source cost engine is unchanged');
    equal(lfHash(read(production,'assets/cost-math.js')),baselineCostHash,'production cost engine is unchanged');
    stats.costMath={sha256:baselineCostHash,normalization:'UTF-8 with CRLF normalized to LF'};
  });

  scenario('official aggregates independently reproduce the current validated source snapshots',()=>{
    const dataDir=path.join(repo,'car-data-preview/data/official-issues');
    const manifests=json(dataDir,'source-manifest.json').sources,snapshots={};
    const config=json(dataDir,'sources.json'),aliases=json(dataDir,'aliases-reviewed.json');
    const families=json(source,'data/generated/catalog-list-index.json').families;
    const aliasMap=validateAliases(aliases,families),sourceFacts={};
    const sourceIndex=json(source,'data/generated/official-issues-index.json');
    const releaseIndex=json(production,'data/generated/official-issues-index.json');
    for(const kind of ['reports','recalls']){
      const sourceManifest=manifests[kind];valid(sourceManifest.available===true,kind+' has a retained validated source');
      valid(/^[a-f0-9]{64}$/.test(sourceManifest.sha256||''),kind+' manifest has an immutable content hash');
      equal(sourceManifest.dataset_id,config[kind].dataset_id,kind+' keeps its configured official dataset');
      equal(sourceManifest.source_url,config[kind].source_url,kind+' keeps its configured official source URL');
      equal(sourceManifest.raw_file,kind+'-'+sourceManifest.sha256+'.csv',kind+' uses its immutable raw pointer');
      const bytes=fs.readFileSync(path.join(dataDir,'raw',sourceManifest.raw_file));equal(hash(bytes),sourceManifest.sha256,kind+' raw bytes agree with the current manifest');
      const normalized=normalizeRows(bytes,kind);snapshots[kind]={...normalized,sha256:sourceManifest.sha256};
      const matched=normalized.normalized.filter(row=>aliasMap.has(exactKey(row.maker)+'\0'+exactKey(row.model)));
      sourceFacts[kind]={sha256:sourceManifest.sha256,period:normalized.period,rows:normalized.rows,matchedRows:matched.length,heldRows:normalized.held.length};
      for(const [label,index]of [['source',sourceIndex],['production',releaseIndex]]){
        const current=index.sources[kind];
        equal(current.sha256,sourceManifest.sha256,label+' '+kind+' provenance');equal(current.period,normalized.period,label+' '+kind+' observed period comes from the current source rows');
        equal(current.rows,normalized.rows,label+' '+kind+' raw record accounting');equal(current.held_rows,normalized.held.length,label+' '+kind+' held-row accounting');
        equal(current.matched_rows,matched.length,label+' '+kind+' reviewed-alias accounting');equal(current.unmatched_rows,normalized.normalized.length-matched.length,label+' '+kind+' unmatched-row accounting');
        equal(current.declared_period,config[kind].declared_period??null,label+' '+kind+' does not invent complete-calendar coverage');equal(current.coverage_status,'observed_only',label+' '+kind+' coverage qualification');
        // Count each source record once using the reviewed alias map. Do not use
        // buildIndex/groupCount here: swapped family/year/month partitions must
        // fail even when the generator's grand total still happens to match.
        for(const family of index.families){
          const rows=matched.filter(row=>aliasMap.get(exactKey(row.maker)+'\0'+exactKey(row.model))===family.family_id);
          if(kind==='recalls'){equal(family.historical_recalls.length,rows.length,label+' '+family.family_id+' historical recall row count');continue;}
          const counts=new Map();for(const row of rows){const key=String(row.model_year)+'|'+row.received_date.slice(0,7);counts.set(key,(counts.get(key)||0)+1);}
          const published=new Map(family.reports.map(row=>[String(row.model_year)+'|'+row.received_month,row.count]));
          equal([...published].sort(),[...counts].sort(),label+' '+family.family_id+' year/month counts independently match source records');
          equal(family.report_count,rows.length,label+' '+family.family_id+' report row count');
        }
      }
    }
    const expected=buildIndex({families,aliases,snapshots,manifests,previous:sourceIndex});
    equal(sourceIndex,expected,'source family/year/month partitions reproduce original source rows');equal(releaseIndex,expected,'production aggregate reproduces the same source facts');
    stats.officialSources=sourceFacts;
    stats.initialOfficialEvidence=initialOfficialEvidence;
  });

  const reviewedPages=json(source,'data/static-model-pages.json').records;
  const cleanPath=value=>String(value||'').replace(/^\.\//,'').replace(/^\//,'');
  const familyForPath=value=>reviewedPages.find(page=>cleanPath(page.path)===cleanPath(value))?.family_id;
  function expectedOfficial(route,html){
    if(route==='cars/family/index.html')return {kind:'family',families:[]};
    if(route==='compare/index.html')return {kind:'custom',families:[]};
    if(route.startsWith('cars/')){const page=reviewedPages.slice().sort((a,b)=>b.path.length-a.path.length).find(page=>route.startsWith(cleanPath(page.path)));return page?{kind:'static',families:[page.family_id]}:null;}
    if(!route.startsWith('compare/')||isRedirect(html))return null;
    const raw=html.match(/<script\b[^>]*id="decision-data"[^>]*>([\s\S]*?)<\/script>/)?.[1];if(!raw)return null;
    const data=JSON.parse(raw);if(data.kind!=='compare'||data.pairs?.length!==1)return null;
    const families=[data.pairs[0].left,data.pairs[0].right].map(side=>familyForPath(side?.path));return families.every(Boolean)?{kind:'pair',families}:null;
  }
  for(const [label,pages]of [['source',sourcePages],['production',releasePages]])scenario(label+' official vehicle links keep 73 reviewed consumers and shared styling',()=>{
    let linked=0;
    for(const [route,html]of pages){
      const expected=expectedOfficial(route,html),count=expected?1:0;
      equal(tags(html,'section').filter(tag=>tag.id==='vehicle-issues').length,count,label+' '+route+' official section count');
      equal(scriptCount(html,'vehicle-official-issues.js'),count,label+' '+route+' official runtime count');
      if(!expected)continue;
      const config=JSON.parse(one([...html.matchAll(/<script\b[^>]*id="official-issues-config"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]),label+' '+route+' official config'));
      equal(config.kind,expected.kind,label+' '+route+' reviewed scope');equal((config.families||[]).map(family=>family.family_id),expected.families,label+' '+route+' reviewed family IDs');
      const block=one([...html.matchAll(/<!-- OFFICIAL:ISSUES:START -->([\s\S]*?)<!-- OFFICIAL:ISSUES:END -->/g)].map(m=>m[1]),label+' '+route+' official content block');
      for(const family of expected.families)for(const tab of ['reports','recalls','free-repairs'])valid(tags(block,'a').some(tag=>{const url=new URL(tag.href,new URL(route,label==='source'?siteConfig.baseUrl:manifest.origin));return url.searchParams.get('family')===family&&url.searchParams.get('tab')===tab;}),label+' '+route+' '+family+' '+tab+' link');
      valid(!tags(html,'link').some(tag=>tag.rel==='stylesheet'&&assetName(tag.href)==='recalls.css'),label+' '+route+' does not import the recall-page stylesheet');linked++;
    }
    equal(linked,73,label+' official consumers retain the reviewed scope');stats[label+'OfficialConsumers']=linked;
  });

  scenario('original official rows remain outside public roots and private keys are absent from the release',()=>{
    for(const root of [source,production])valid(!fs.existsSync(path.join(root,'data/official-issues')),path.relative(repo,root)+' has no original official snapshot directory');
    for(const relative of ['data/raw','data/staging','scripts','.git','.env'])valid(!fs.existsSync(path.join(production,relative)),'production excludes '+relative);
    let scanned=0;
    function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),relative=path.relative(production,file).split(path.sep).join('/');if(entry.isDirectory()){valid(!['raw','staging','.git'].includes(entry.name),'no private/source directory in release: '+relative);walk(file);continue;}valid(!/^(?:reports|recalls)(?:-snapshot\.json|(?:-[a-f0-9]{64})?\.csv)$/.test(entry.name),'no original official row file in release: '+relative);if(!/\.(?:html|js|json|txt|css)$/i.test(entry.name))continue;const content=fs.readFileSync(file,'utf8');scanned++;
      valid(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content),'no private PEM key in '+relative);
      valid(!/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/.test(content),'no private GitHub token in '+relative);
      for(const token of content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){let role;try{role=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8')).role;}catch{}valid(role!=='service_role','no Supabase service-role credential in '+relative);}
    }}walk(production);stats.publicTextFilesScanned=scanned;
  });
}

const result={checkedAt:new Date().toISOString(),sourceRoot:source,productionRoot:production,readOnlyInspection:true,checks,failures:failures.length,sections,details:failures,stats};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({checks,failures:failures.length,details:failures,report:output}));
if(failures.length)process.exitCode=1;
