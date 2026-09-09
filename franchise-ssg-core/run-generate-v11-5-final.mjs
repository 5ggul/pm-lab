import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {CURATED_COMPARE_NAMES} from './content.mjs';
import {buildOfficialMergePlan,matchOfficialBrands} from './official-merge.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');

async function loadClassic(file,expr){
  const code=await fs.readFile(file,'utf8');
  const ctx={console};
  vm.createContext(ctx);
  vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);
  return ctx.__EXPORT__;
}

const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
const official=JSON.parse(await fs.readFile(path.join(repo,'data/franchise/official/brands-2025.json'),'utf8'));
const critical=[...new Set([...CURATED_COMPARE_NAMES.flat(),...catalog.brands.slice(0,12).map(b=>b.name)])];
const matched=matchOfficialBrands(catalog.brands,official);
const plan=buildOfficialMergePlan({catalogBrands:catalog.brands,officialDoc:official,criticalBrandNames:critical});
const reconciled=matched.matches.length+matched.resolvedExcluded.length+matched.unmatched.length+matched.ambiguous.length;
if(reconciled!==catalog.brands.length)throw new Error(`Catalog resolution mismatch ${reconciled}/${catalog.brands.length}`);

const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.5';
manifest.officialPresentation={
  matched:matched.matches.length,
  resolvedExcluded:matched.resolvedExcluded.length,
  unmatched:matched.unmatched.length,
  ambiguous:matched.ambiguous.length,
  syntheticFallback:false
};
manifest.officialMerge=plan.report;
manifest.coverage={
  ...(manifest.coverage||{}),
  officialMatchedBrands:matched.matches.length,
  officialResolvedExcludedBrands:matched.resolvedExcluded.length,
  officialUnmatchedBrands:matched.unmatched.length,
  officialAmbiguousBrands:matched.ambiguous.length
};
manifest.productionGates={...(manifest.productionGates||{}),officialMetricMergeReady:plan.active};
manifest.v11_5={
  reviewedMatchResolution:true,
  officialMatchedBrands:matched.matches.length,
  reviewedExcludedBrands:matched.resolvedExcluded.length,
  unresolvedBrands:matched.unmatched.length+matched.ambiguous.length,
  criticalMetricMissing:plan.report.criticalMissingMetrics.length,
  syntheticFallback:false
};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const report={
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  uiVersion:'11.5',
  officialReferenceYear:official.referenceYear??null,
  catalogBrands:catalog.brands.length,
  officialRecords:Array.isArray(official.records)?official.records.length:0,
  matched:matched.matches.length,
  exact:matched.matches.filter(x=>x.method==='EXACT').length,
  alias:matched.matches.filter(x=>x.method==='ALIAS').length,
  reviewedExcluded:matched.resolvedExcluded.length,
  unresolvedUnmatched:matched.unmatched.length,
  unresolvedAmbiguous:matched.ambiguous.length,
  criticalMissingMetrics:plan.report.criticalMissingMetrics,
  officialMergeActive:plan.active,
  syntheticFallback:false,
  resolvedExcludedCatalog:matched.resolvedExcluded,
  activationBlockers:plan.report.activationBlockers
};
await fs.writeFile(path.join(out,'v11-5-data-resolution.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_5:'PASS',matched:report.matched,reviewedExcluded:report.reviewedExcluded,unresolved:report.unresolvedUnmatched+report.unresolvedAmbiguous,criticalMissing:report.criticalMissingMetrics.length,officialMergeActive:report.officialMergeActive},null,2));
