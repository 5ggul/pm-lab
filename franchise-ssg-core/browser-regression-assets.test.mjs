import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {OLD_READER,NEW_READER,BRAND_UX_JS,BRAND_UX_START,BRAND_UX_END,START,END,FIX_CSS,applyBrowserRegressionFix,validateBrowserRegressionAssets} from './browser-regression-assets.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
function fixture(t,app=OLD_READER,css='body{margin:0}\n'){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'franchise-browser-fix-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'assets'));fs.writeFileSync(path.join(root,'assets/app.js'),app);fs.writeFileSync(path.join(root,'assets/site.css'),css);
  for(const name of ['index.html','official-data.json','robots.txt','sitemap.xml','route-manifest.json'])fs.writeFileSync(path.join(root,name),`unchanged fixture ${name}\n`);return root;
}
function snapshot(root){return Object.fromEntries(fs.readdirSync(root,{recursive:true}).sort().filter(f=>fs.statSync(path.join(root,f)).isFile()).map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]))}
const reader=()=>vm.runInNewContext(`${NEW_READER}\nvalue;`);
const expectedValidation={calculatorReader:true,mobileTitle:true,formulaContrast:true,desktopFreshnessRail:true,categoryLabelWrap:true,brandDecisionUx:true,mobileBrandActions:true};

test('assets: only the two reviewed shared assets change',t=>{
  const root=fixture(t),before=snapshot(root),result=applyBrowserRegressionFix(root),after=snapshot(root);
  assert.deepEqual(result.changedFiles,['assets/app.js','assets/site.css']);assert.equal(result.productionDeploy,false);assert.equal(result.indexPolicyChanged,false);
  for(const f of Object.keys(before))if(!result.changedFiles.includes(f))assert.equal(after[f],before[f]);
  assert.equal(after['assets/app.js'],NEW_READER+'\n\n'+BRAND_UX_JS+'\n');assert.equal(after['assets/site.css'],'body{margin:0}\n\n'+FIX_CSS+'\n');
});

test('assets: repeat application is byte-for-byte idempotent',t=>{const root=fixture(t);applyBrowserRegressionFix(root);const before=snapshot(root);assert.deepEqual(applyBrowserRegressionFix(root).changedFiles,[]);assert.deepEqual(snapshot(root),before)});
test('assets: validation is read-only and accepts the repaired assets',t=>{const root=fixture(t);applyBrowserRegressionFix(root);const before=snapshot(root);assert.deepEqual(validateBrowserRegressionAssets(root),expectedValidation);assert.deepEqual(snapshot(root),before)});

test('assets: layout guards and brand decision UX are part of the bounded repair',()=>{
  assert.match(FIX_CSS,/grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(FIX_CSS,/\.v25-bar\s*>\s*span/);assert.match(FIX_CSS,/\.report-grid strong/);assert.match(FIX_CSS,/overflow-wrap:\s*anywhere/);
  for(const token of ['.v52-mobile-actions','.v35-kpis','.v52-cost-checks','.v52-dominant-cost','.v52-benchmark-cards','.v52-store-summary','.v52-year-cards','.v52-raw-panel','.v52-history-table-wrap'])assert.ok(FIX_CSS.includes(token),token);
  assert.match(FIX_CSS,/scroll-snap-type:x mandatory/);
  for(const token of ['비용 계산','브랜드 비교','data-v52-mobile-actions','v52-dominant-cost','v52-benchmark-cards','v52-store-summary','v52-latest-year','v52-history-table-wrap'])assert.ok(BRAND_UX_JS.includes(token),token);
});

test('assets: validation rejects the old reader without repairing it',t=>{const root=fixture(t),before=snapshot(root);assert.throws(()=>validateBrowserRegressionAssets(root),/Legacy calculator reader/);assert.deepEqual(snapshot(root),before)});
for(const[name,app]of[['unknown','const value=()=>0;'],['duplicate-old',OLD_READER+OLD_READER],['duplicate-new',NEW_READER+NEW_READER],['mixed',OLD_READER+NEW_READER]])test(`assets: fail before writes for ${name} reader`,t=>{const root=fixture(t,app),before=snapshot(root);assert.throws(()=>applyBrowserRegressionFix(root),/exactly one known/);assert.deepEqual(snapshot(root),before)});
for(const[name,css]of[['missing-end',START],['missing-start',END],['reversed',END+START],['duplicate',FIX_CSS+FIX_CSS]])test(`assets: fail before writes for ${name} CSS markers`,t=>{const root=fixture(t,OLD_READER,css),before=snapshot(root);assert.throws(()=>applyBrowserRegressionFix(root),/CSS patch markers/);assert.deepEqual(snapshot(root),before)});
for(const[name,app]of[['brand-missing-end',NEW_READER+'\n'+BRAND_UX_START],['brand-missing-start',NEW_READER+'\n'+BRAND_UX_END],['brand-reversed',NEW_READER+'\n'+BRAND_UX_END+BRAND_UX_START],['brand-duplicate',NEW_READER+'\n'+BRAND_UX_JS+BRAND_UX_JS]])test(`assets: fail before writes for ${name}`,t=>{const root=fixture(t,app),before=snapshot(root);assert.throws(()=>applyBrowserRegressionFix(root),/brand UX markers/);assert.deepEqual(snapshot(root),before)});

test('assets: validation rejects missing or altered CSS without writing',t=>{for(const css of ['body{}',FIX_CSS.replace('white-space:normal','white-space:nowrap')]){const root=fixture(t,NEW_READER+'\n\n'+BRAND_UX_JS+'\n',css),before=snapshot(root);assert.throws(()=>validateBrowserRegressionAssets(root),/CSS fix/);assert.deepEqual(snapshot(root),before)}});
test('assets: validation rejects missing brand decision runtime without writing',t=>{const root=fixture(t,NEW_READER,FIX_CSS),before=snapshot(root);assert.throws(()=>validateBrowserRegressionAssets(root),/Brand decision UX patch/);assert.deepEqual(snapshot(root),before)});
test('assets: explicit patch can repair the bounded CSS block without touching surrounding CSS',t=>{const root=fixture(t,NEW_READER+'\n\n'+BRAND_UX_JS+'\n','/*before*/'+START+'\nold style\n'+END+'/*after*/');applyBrowserRegressionFix(root);assert.equal(fs.readFileSync(path.join(root,'assets/site.css'),'utf8'),'/*before*/'+FIX_CSS+'/*after*/')});
test('assets: missing CSS cannot leave app.js partially rewritten',t=>{const root=fixture(t);fs.unlinkSync(path.join(root,'assets/site.css'));assert.throws(()=>applyBrowserRegressionFix(root));assert.equal(fs.readFileSync(path.join(root,'assets/app.js'),'utf8'),OLD_READER)});
test('assets: reject implicit and relative write roots',()=>{for(const root of[undefined,null,'','relative'])assert.throws(()=>applyBrowserRegressionFix(root),/absolute preview root/)});

test('reader: DIV calculators read named input/select/textarea fields',()=>{const value=reader(),root={querySelectorAll:()=>[{name:'other',value:'8'},{name:'revenue',value:'9000'}]};assert.equal(value(root,'revenue'),9000);assert.equal(value(root,'missing'),0)});
test('reader: HTML form namedItem remains compatible and takes precedence',()=>{assert.equal(reader()({elements:{namedItem:()=>({value:'5000'})},querySelectorAll:()=>[{name:'revenue',value:'1'}]},'revenue'),5000)});
test('reader: blank, absent, invalid, negative and nonfinite values are safe',()=>{const value=reader();for(const raw of['',undefined,null,'abc','-5','Infinity'])assert.equal(value({querySelectorAll:()=>[{name:'x',value:raw}]},'x'),0);assert.equal(value(null,'x'),0);assert.equal(value({querySelectorAll:()=>[{name:'x',value:'12.5'}]},'x'),12.5)});

test('integration: standalone RC generation patches the fixed preview root before reporting readiness',()=>{const code=fs.readFileSync(path.join(here,'run-generate-v11-52-release-candidate.mjs'),'utf8');assert.ok(code.includes("import {applyBrowserRegressionFix} from './browser-regression-assets.mjs';"));const patch=code.indexOf('applyBrowserRegressionFix(out);'),readiness=code.indexOf('const rcReady=');assert.ok(patch>0&&patch<readiness);assert.ok(!code.includes('SSG_BROWSER_FIX_ROOT'))});
test('integration: RC validation checks actual assets without running a repair',()=>{const code=fs.readFileSync(path.join(here,'run-validate-v11-52-release-candidate.mjs'),'utf8');assert.ok(code.includes("import {validateBrowserRegressionAssets} from './browser-regression-assets.mjs';"));assert.ok(code.indexOf('validateBrowserRegressionAssets(out);')<code.indexOf('if(err.length)'));assert.ok(!code.includes('applyBrowserRegressionFix'))});

// Explorer selection is part of the same two-file bounded repair, not a new build stage.
test('assets: budget comparison ships with native selection and existing a/b parameters',()=>{
  for(const token of ['data-v52-budget-pick','data-v52-budget-compare','sessionStorage','row.hidden',"url.searchParams.set('a'", "url.searchParams.set('b'", 'pageshow'])assert.ok(BRAND_UX_JS.includes(token),token);
  assert.ok(FIX_CSS.includes('.v52-budget-dock'));
  assert.ok(FIX_CSS.includes('--v52-budget-dock-height'));
  new vm.Script(BRAND_UX_JS);
});


test('assets: compact budget rows preserve one table and explicit hidden rows',()=>{
  for(const token of ['v52-budget-mobile-rows','v52-budget-results-wrap',"setAttribute('headers'", "setAttribute('role','table')", "label.setAttribute('aria-hidden','true')"])assert.ok(BRAND_UX_JS.includes(token),token);
  assert.match(FIX_CSS,/\.v52-budget-mobile-rows tr\[hidden\]\{display:none!important\}/);
  assert.ok(FIX_CSS.includes('clip-path:inset(50%)'));
  assert.ok(FIX_CSS.includes('.v52-budget-mobile-label{display:none}'));
  new vm.Script(BRAND_UX_JS);
});
