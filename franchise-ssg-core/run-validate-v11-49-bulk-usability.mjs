import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-49-bulk-usability.json'),'utf8'));
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const js=await fs.readFile(path.join(out,'assets/v49-bulk-usability.js'),'utf8');
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');
const hasZeroCost=b=>Object.values(b.components||{}).some(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)===0);
const zeroCostBrands=(snap.brands||[]).filter(hasZeroCost);

const ui=Number(manifest.uiVersion);
if(!Number.isFinite(ui)||ui<11.49)err.push(`manifest ${manifest.uiVersion}`);
for(const k of ['bulkUsability','brandCostDueDiligence','compareSelectionSummary','startupInputResultBridge','mobileDataReadability','v42VisualLanguagePreserved'])if(manifest.v11_49?.[k]!==true)err.push(`flag ${k}`);
if(manifest.v11_49?.candidateSetChanged!==false||manifest.v11_49?.indexPolicyChanged!==false||manifest.v11_49?.dataSemanticsChanged!==false||manifest.v11_49?.productionDeployed!==false||report.productionDeployed!==false)err.push('immutable contracts');
if(Number(snap.brand_count)!==136||Number(snap.category_count)!==20||candidates.length!==184)err.push(`counts ${snap.brand_count}/${snap.category_count}/${candidates.length}`);
for(const [k,v] of [['brandPages',136],['brandCheckRows',408],['candidatePages',184]])if(Number(report[k])!==v)err.push(`report ${k}=${report[k]}`);
if(Number(report.zeroPublicWarnings)!==zeroCostBrands.length)err.push(`zero warning report=${report.zeroPublicWarnings} expected=${zeroCostBrands.length}`);
if(report.compareHubPatched!==true||report.startupToolPatched!==true)err.push('tool patch flags');
if(!Array.isArray(report.mobileBreakpoints)||report.mobileBreakpoints.join(',')!=='720,430')err.push('mobile breakpoints');

for(const token of ['/* v11.49 bulk usability */','/* v11.49 bulk usability end */','.v49-cost-checks','.v49-compare-live','.v49-startup-summary','@media(max-width:430px)'])if(!css.includes(token))err.push(`css ${token}`);
for(const token of ['data-v49-compare-live','data-v49-startup-public','data-v49-startup-reset','data-v49-remove'])if(!js.includes(token))err.push(`js ${token}`);

let brandBlocks=0,brandRows=0,noindex=0,v48Preserved=0,bodyFlag=0,zeroWarningPages=0;
for(const b of snap.brands||[]){
  const html=await fs.readFile(fileFor(b.route),'utf8');
  const block=html.match(/<!-- v11\.49 brand cost checks -->([\s\S]*?)<!-- v11\.49 brand cost checks end -->/);
  if(!block){err.push(`brand block ${b.slug}`);continue}
  brandBlocks++;
  const rows=(block[1].match(/data-v49-check="/g)||[]).length;brandRows+=rows;if(rows!==3)err.push(`brand rows ${b.slug}=${rows}`);
  const zeroCopy=block[1].includes('0원 공개항목');
  if(hasZeroCost(b)){if(!zeroCopy)err.push(`missing zero warning ${b.slug}`);else zeroWarningPages++}
  else if(zeroCopy)err.push(`unexpected zero warning ${b.slug}`);
  if(html.includes('<!-- v11.48 brand distinctness -->')&&html.includes('data-v48-brand-distinct="1"'))v48Preserved++;else err.push(`v48 lost ${b.slug}`);
  if(html.includes('data-v49-bulk-usability="1"'))bodyFlag++;else err.push(`body flag ${b.slug}`);
}
if(brandBlocks!==136||brandRows!==408||v48Preserved!==136||bodyFlag!==136||zeroWarningPages!==zeroCostBrands.length)err.push(`brand coverage ${brandBlocks}/${brandRows}/${v48Preserved}/${bodyFlag}/zero=${zeroWarningPages}`);

const compare=await fs.readFile(fileFor('/compare/'),'utf8');
for(const t of ['data-v49-compare-live','data-v49-compare-count','data-v49-compare-chips','data-v49-compare-clear','assets/v49-bulk-usability.js'])if(!compare.includes(t))err.push(`compare ${t}`);
const startup=await fs.readFile(fileFor('/tools/startup-cost/'),'utf8');
for(const t of ['data-v49-startup-summary','data-v49-startup-public','data-v49-startup-extra','data-v49-startup-total','data-v49-startup-reset','assets/v49-bulk-usability.js'])if(!startup.includes(t))err.push(`startup ${t}`);

const mega=await fs.readFile(fileFor('/brands/mega-mgc-coffee/'),'utf8');
for(const t of ['계약 전 비용 확인','기타비용','76.4%','업종 중앙'])if(!mega.includes(t))err.push(`mega ${t}`);

for(const r of candidates){const h=await fs.readFile(fileFor(r),'utf8');if(h.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))noindex++;else err.push(`noindex ${r}`)}
if(noindex!==184)err.push(`noindex ${noindex}`);

if(err.length){console.error(JSON.stringify({v11_49BulkUsabilityValidation:'FAIL',count:err.length,currentUiVersion:manifest.uiVersion,brandBlocks,brandRows,v48Preserved,bodyFlag,zeroWarningPages,expectedZeroWarnings:zeroCostBrands.length,noindex,errors:err.slice(0,200)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_49BulkUsabilityValidation:'PASS',currentUiVersion:manifest.uiVersion,brands:136,brandRows:408,v48Preserved,zeroWarningPages,noindex,candidates:184,compareHub:true,startupTool:true,mobile:true,productionDeployed:false},null,2));
