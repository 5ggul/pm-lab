import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateBrowserRegressionAssets} from './browser-regression-assets.mjs';
import {validateCompareDecision} from './compare-decision-integrator.mjs';
import {validateToolsDecision} from './tools-decision-integrator.mjs';
import {validateHomeDecision} from './home-decision-integrator.mjs';
import {validateTrustConsistency} from './trust-consistency-integrator.mjs';
import {validateDiscoveryHubs} from './discovery-hubs-integrator.mjs';
import {validateVisualIntegrity} from './visual-integrity-integrator.mjs';
import {validatePrelaunchQuality} from './prelaunch-quality-integrator.mjs';
import {validateRetentionWorkspace} from './retention-workspace-integrator.mjs';
import {validatePublisherValue} from './publisher-value-integrator.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-52-release-candidate.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const legacyCompareRoutes=['/compare/bhc-chicken-vs-bbq-chicken/','/compare/cu-vs-gs25/'];
const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');

if(manifest.uiVersion!=='11.52')err.push(`manifest ${manifest.uiVersion}`);
for(const k of ['releaseCandidateAudit','allInternalLinksChecked','assetsChecked','searchIntentCollisionAudit','singleH1Audit','imageAltAudit','viewportCoverageAudit','brandLowerFunnelUx','compareHydrationAligned','compareDecisionUx','staticCompareDecisionUx','legacyCompareDecisionUx','toolsDecisionUx','homeDecisionUx','trustConsistencyUx','discoveryHubsUx','visualIntegrityUx','prelaunchQualityUx','retentionWorkspaceUx','publisherValueUx','v42VisualLanguagePreserved'])if(manifest.v11_52?.[k]!==true)err.push(`flag ${k}`);
if(manifest.v11_52?.candidateSetChanged!==false||manifest.v11_52?.indexPolicyChanged!==false||manifest.v11_52?.dataSemanticsChanged!==false||manifest.v11_52?.productionDeployed!==false||report.productionDeployed!==false)err.push('immutable contracts');
if(htmlFiles.length!==311||candidates.length!==184)err.push(`counts ${htmlFiles.length}/${candidates.length}`);
for(const [k,v] of [['htmlPages',311],['candidatePages',184],['viewportMeta',311],['imageMissingAlt',0]])if(Number(report[k])!==v)err.push(`report ${k}=${report[k]}`);
for(const k of ['brokenInternalLinks','missingAssets','candidateIssues','titleDuplicateGroups','descriptionDuplicateGroups','h1DuplicateGroups','canonicalDuplicateGroups'])if(!Array.isArray(report[k])||report[k].length!==0)err.push(`${k}=${Array.isArray(report[k])?report[k].length:'invalid'}`);
if(report.brandLowerFunnelUx!==true)err.push('report brandLowerFunnelUx false');
if(report.compareHydrationAligned!==true)err.push('report compareHydrationAligned false');
if(report.compareDecisionUx!==true)err.push('report compareDecisionUx false');
if(report.staticCompareDecisionUx!==true||Number(report.staticCompareDecisionPages)!==7)err.push(`report staticCompareDecision ${report.staticCompareDecisionUx}/${report.staticCompareDecisionPages}`);
if(report.legacyCompareDecisionUx!==true||Number(report.legacyCompareDecisionPages)!==2)err.push(`report legacyCompareDecision ${report.legacyCompareDecisionUx}/${report.legacyCompareDecisionPages}`);
if(report.toolsDecisionUx!==true)err.push('report toolsDecisionUx false');
if(report.homeDecisionUx!==true)err.push('report homeDecisionUx false');
if(report.trustConsistencyUx!==true)err.push('report trustConsistencyUx false');
if(report.discoveryHubsUx!==true)err.push('report discoveryHubsUx false');
if(report.visualIntegrityUx!==true||Number(report.visualIntegrityRemovedStockImages)!==153||Number(report.visualIntegrityAffectedPages)!==153)err.push(`report visualIntegrity ${report.visualIntegrityUx}/${report.visualIntegrityRemovedStockImages}/${report.visualIntegrityAffectedPages}`);
if(report.prelaunchQualityUx!==true||Number(report.rankingFaqItems)!==4||Number(report.historyNotePages)<=0||report.brandAnchorOffsets!==true||report.releaseInputsOwnedByProductionGate!==true)err.push(`report prelaunchQuality ${report.prelaunchQualityUx}/${report.rankingFaqItems}/${report.historyNotePages}/${report.brandAnchorOffsets}/${report.releaseInputsOwnedByProductionGate}`);
if(report.retentionWorkspaceUx!==true||Number(report.retentionBrandWorkspaces)!==136||Number(report.updatesRadarRows)!==12||report.localOnlyPersistence!==true||Number(report.editorialRails)!==3||Number(report.editorialGuideLinks)!==9)err.push(`report retention ${report.retentionWorkspaceUx}/${report.retentionBrandWorkspaces}/${report.updatesRadarRows}/${report.localOnlyPersistence}/${report.editorialRails}/${report.editorialGuideLinks}`);
if(report.publisherValueUx!==true||Number(report.publisherValueItems)!==6||report.automationDisclosure!==true||report.originalAnalysisDisclosure!==true)err.push(`report publisherValue ${report.publisherValueUx}/${report.publisherValueItems}/${report.automationDisclosure}/${report.originalAnalysisDisclosure}`);
if(report.rcReady!==true||manifest.v11_52?.rcReady!==true)err.push('rcReady false');

let bodyCoverage=0,noindex=0,singleH1=0,metaDescriptions=0,canonicalPreview=0;
for(const f of htmlFiles){const h=await fs.readFile(f,'utf8');if(/<body\b[^>]*\bv52-release-candidate\b[^>]*data-v52-release-candidate="1"/i.test(h))bodyCoverage++;else err.push(`body ${path.relative(out,f)}`)}
for(const r of candidates){const h=await fs.readFile(fileFor(r),'utf8');if(h.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))noindex++;else err.push(`noindex ${r}`);if((h.match(/<h1\b/gi)||[]).length===1)singleH1++;else err.push(`h1 ${r}`);if(/<meta name="description" content="[^"]+">/i.test(h))metaDescriptions++;else err.push(`description ${r}`);if(/<link rel="canonical" href="https:\/\/5ggul\.github\.io\/pm-lab\/franchise-ssg-preview[^"]*">/i.test(h))canonicalPreview++;else err.push(`canonical ${r}`)}
if(bodyCoverage!==311||noindex!==184||singleH1!==184||metaDescriptions!==184||canonicalPreview!==184)err.push(`coverage ${bodyCoverage}/${noindex}/${singleH1}/${metaDescriptions}/${canonicalPreview}`);

let brandDecisionPages=0,brandDecisionTagged=0,brandLowerFunnelEligiblePages=0;
for(const f of htmlFiles){
  const h=await fs.readFile(f,'utf8');
  if(!h.includes('data-v10-brand="1"'))continue;
  brandDecisionPages++;
  if(h.includes('id="official-current-cost"'))brandLowerFunnelEligiblePages++;
  if(/<body\b[^>]*\bv52-brand-decision\b[^>]*data-v52-brand-decision="1"/i.test(h)&&h.includes('data-v52-lower-funnel')&&h.includes('/assets/brand-lower-funnel.css')&&h.includes('/assets/brand-lower-funnel.js'))brandDecisionTagged++;
  else err.push(`brand decision integration ${path.relative(out,f)}`);
}
if(brandDecisionPages===0||brandDecisionTagged!==brandDecisionPages||brandLowerFunnelEligiblePages===0)err.push(`brand decision coverage ${brandDecisionTagged}/${brandDecisionPages}, eligible ${brandLowerFunnelEligiblePages}`);
if(Number(report.brandDecisionPages)!==brandDecisionPages||Number(report.brandDecisionTagged)!==brandDecisionTagged||Number(report.brandLowerFunnelEligiblePages)!==brandLowerFunnelEligiblePages)err.push(`report brand decision counts ${report.brandDecisionPages}/${report.brandDecisionTagged}/${report.brandLowerFunnelEligiblePages}`);
try{await fs.access(path.join(out,'assets/brand-lower-funnel.js'));await fs.access(path.join(out,'assets/brand-lower-funnel.css'))}catch{err.push('brand lower funnel assets missing')}

const compare=await fs.readFile(fileFor('/compare/'),'utf8');
const pickerArea=compare.match(/<div class="v34-pickers" data-v34-pickers>([\s\S]*?)<\/div><div class="v34-status"/)?.[1]||'';
const selectedOptions=pickerArea.match(/\sselected(?=[\s>])/g)||[];
if(selectedOptions.length!==2)err.push(`compare selected options ${selectedOptions.length}/2`);
if(!pickerArea.includes('<option value="mega-mgc-coffee" selected>'))err.push('compare mega default not selected in HTML');
if(!pickerArea.includes('<option value="compose-coffee" selected>'))err.push('compare compose default not selected in HTML');
if(!compare.includes('<strong data-v49-compare-count>2개</strong>'))err.push('compare live count not hydrated to 2');
for(const name of ['메가MGC커피','컴포즈커피'])if(!compare.includes(`<span>${name}</span>`))err.push(`compare live chip ${name}`);
if(!compare.includes('<span data-v34-count>2/4</span>'))err.push('compare workspace count mismatch');

let staticComparePages=0,staticCompareTagged=0;
for(const f of htmlFiles){const h=await fs.readFile(f,'utf8');if(!h.includes('data-v34-workspace="static"'))continue;staticComparePages++;if(h.includes('data-v52-static-compare-decision')&&h.includes('/assets/static-compare-decision.css')&&h.includes('/assets/static-compare-decision.js'))staticCompareTagged++;else err.push(`static compare asset tags ${path.relative(out,f)}`)}
if(staticComparePages!==7||staticCompareTagged!==7)err.push(`static compare coverage ${staticComparePages}/${staticCompareTagged}`);
try{await fs.access(path.join(out,'assets/static-compare-decision.js'));await fs.access(path.join(out,'assets/static-compare-decision.css'))}catch{err.push('static compare assets missing')}

let legacyCompareTagged=0;
for(const route of legacyCompareRoutes){
  const h=await fs.readFile(fileFor(route),'utf8');
  if(!h.includes('data-v10-compare="1"')||h.includes('data-v34-workspace'))err.push(`legacy compare shape ${route}`);
  if(h.includes('data-v52-legacy-compare-decision')&&h.includes('/assets/legacy-compare-decision.css')&&h.includes('/assets/legacy-compare-decision.js'))legacyCompareTagged++;else err.push(`legacy compare asset tags ${route}`);
}
if(legacyCompareTagged!==2)err.push(`legacy compare coverage ${legacyCompareTagged}/2`);
try{await fs.access(path.join(out,'assets/legacy-compare-decision.js'));await fs.access(path.join(out,'assets/legacy-compare-decision.css'))}catch{err.push('legacy compare assets missing')}
const bhcLegacy=await fs.readFile(fileFor('/compare/bhc-chicken-vs-bbq-chicken/'),'utf8');
if(!bhcLegacy.includes('bhc치킨과 BBQ치킨'))err.push('legacy bhc particle repair missing');
if(bhcLegacy.includes('bhc치킨와 BBQ치킨'))err.push('legacy bhc bad particle retained');

// Inspect the actual assets and page integrations; validation must not silently repair a stale build.
try { validateBrowserRegressionAssets(out); } catch(error) { err.push(`browser regression assets: ${error.message}`); }
try { validateCompareDecision(out); } catch(error) { err.push(`compare decision assets: ${error.message}`); }
try { validateToolsDecision(out); } catch(error) { err.push(`tools decision: ${error.message}`); }
try { validateHomeDecision(out); } catch(error) { err.push(`home decision: ${error.message}`); }
try { validateTrustConsistency(out); } catch(error) { err.push(`trust consistency: ${error.message}`); }
try { validateDiscoveryHubs(out); } catch(error) { err.push(`discovery hubs: ${error.message}`); }
try { const visual=validateVisualIntegrity(out); if(visual.homeVisuals!==1||visual.brandVisuals!==136||visual.categoryVisuals!==16||visual.markedPages!==153)err.push(`visual integrity coverage ${visual.homeVisuals}/${visual.brandVisuals}/${visual.categoryVisuals}/${visual.markedPages}`); } catch(error) { err.push(`visual integrity: ${error.message}`); }
try { const prelaunch=validatePrelaunchQuality(out); if(prelaunch.rankingFaqItems!==4||prelaunch.historyNotePages<=0||prelaunch.brandAnchorOffsets!==true||prelaunch.releaseInputsOwnedByProductionGate!==true)err.push(`prelaunch quality coverage ${prelaunch.rankingFaqItems}/${prelaunch.historyNotePages}/${prelaunch.brandAnchorOffsets}/${prelaunch.releaseInputsOwnedByProductionGate}`); } catch(error) { err.push(`prelaunch quality: ${error.message}`); }
try { const retention=validateRetentionWorkspace(out); if(retention.brandWorkspaces!==136||retention.updatesRadarRows!==12||retention.localOnlyPersistence!==true||retention.editorialRails!==3||retention.editorialGuideLinks!==9)err.push(`retention workspace coverage ${retention.brandWorkspaces}/${retention.updatesRadarRows}/${retention.localOnlyPersistence}/${retention.editorialRails}/${retention.editorialGuideLinks}`); } catch(error) { err.push(`retention workspace: ${error.message}`); }
try { const value=validatePublisherValue(out); if(value.valueItems!==6||value.automationDisclosure!==true||value.originalAnalysisDisclosure!==true)err.push(`publisher value coverage ${value.valueItems}/${value.automationDisclosure}/${value.originalAnalysisDisclosure}`); } catch(error) { err.push(`publisher value: ${error.message}`); }

if(err.length){console.error(JSON.stringify({v11_52ReleaseCandidateValidation:'FAIL',count:err.length,bodyCoverage,noindex,singleH1,metaDescriptions,canonicalPreview,compareSelectedOptions:selectedOptions.length,reportSummary:{brandLowerFunnelUx:report.brandLowerFunnelUx,brandDecisionPages:report.brandDecisionPages,brandDecisionTagged:report.brandDecisionTagged,brandLowerFunnelEligiblePages:report.brandLowerFunnelEligiblePages,broken:report.brokenInternalLinks?.length,missingAssets:report.missingAssets?.length,candidateIssues:report.candidateIssues?.length,titleDup:report.titleDuplicateGroups?.length,descDup:report.descriptionDuplicateGroups?.length,h1Dup:report.h1DuplicateGroups?.length,canonicalDup:report.canonicalDuplicateGroups?.length,imageMissingAlt:report.imageMissingAlt,compareHydrationAligned:report.compareHydrationAligned,compareDecisionUx:report.compareDecisionUx,staticCompareDecisionUx:report.staticCompareDecisionUx,staticCompareDecisionPages:report.staticCompareDecisionPages,legacyCompareDecisionUx:report.legacyCompareDecisionUx,legacyCompareDecisionPages:report.legacyCompareDecisionPages,toolsDecisionUx:report.toolsDecisionUx,homeDecisionUx:report.homeDecisionUx,trustConsistencyUx:report.trustConsistencyUx,discoveryHubsUx:report.discoveryHubsUx,visualIntegrityUx:report.visualIntegrityUx,visualIntegrityRemovedStockImages:report.visualIntegrityRemovedStockImages,visualIntegrityAffectedPages:report.visualIntegrityAffectedPages,prelaunchQualityUx:report.prelaunchQualityUx,rankingFaqItems:report.rankingFaqItems,historyNotePages:report.historyNotePages,historyNotes:report.historyNotes,brandAnchorOffsets:report.brandAnchorOffsets,releaseInputsOwnedByProductionGate:report.releaseInputsOwnedByProductionGate,retentionWorkspaceUx:report.retentionWorkspaceUx,retentionBrandWorkspaces:report.retentionBrandWorkspaces,updatesRadarRows:report.updatesRadarRows,localOnlyPersistence:report.localOnlyPersistence,editorialRails:report.editorialRails,editorialGuideLinks:report.editorialGuideLinks,publisherValueUx:report.publisherValueUx,publisherValueItems:report.publisherValueItems,automationDisclosure:report.automationDisclosure,originalAnalysisDisclosure:report.originalAnalysisDisclosure,rcReady:report.rcReady},errors:err.slice(0,220)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_52ReleaseCandidateValidation:'PASS',htmlPages:311,bodyCoverage,candidates:184,noindex,singleH1,metaDescriptions,canonicalPreview,brandDecisionPages,brandDecisionTagged,brandLowerFunnelEligiblePages,brandLowerFunnelUx:true,compareSelectedOptions:2,compareHydrationAligned:true,compareDecisionUx:true,staticCompareDecisionPages:7,staticCompareDecisionUx:true,legacyCompareDecisionPages:2,legacyCompareDecisionUx:true,toolsDecisionUx:true,homeDecisionUx:true,trustConsistencyUx:true,discoveryHubsUx:true,visualIntegrityUx:true,prelaunchQualityUx:true,rankingFaqItems:4,historyNotePages:report.historyNotePages,brandAnchorOffsets:true,releaseInputsOwnedByProductionGate:true,retentionWorkspaceUx:true,retentionBrandWorkspaces:136,updatesRadarRows:12,localOnlyPersistence:true,editorialRails:3,editorialGuideLinks:9,publisherValueUx:true,publisherValueItems:6,automationDisclosure:true,originalAnalysisDisclosure:true,internalLinksChecked:report.totalInternalLinks,assetsChecked:report.totalInternalAssets,imagesChecked:report.imageCount,rcReady:true,productionDeployed:false},null,2));
