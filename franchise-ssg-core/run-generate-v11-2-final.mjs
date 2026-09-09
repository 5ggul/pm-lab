import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v11-1-final.mjs?v112=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const homePath=path.join(out,'index.html');

let home=await fs.readFile(homePath,'utf8');

// The home page should only promote tools that are production-candidate ready.
for(const href of ['/tools/brand-filter/','/areas/']){
  const escaped=href.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  home=home.replace(new RegExp(`<a href="/pm-lab/franchise-ssg-preview${escaped}">[\\s\\S]*?<\\/a>`,'g'),'');
}

// Do not feature a brand on the home table when its detail page fails the strict
// production index gate. The directory still keeps the full catalog discoverable.
home=home.replace(/<tr><td><a href="\/pm-lab\/franchise-ssg-preview\/brands\/paris-baguette\/">파리바게뜨<\/a><\/td>[\s\S]*?<\/tr>/,'');

await fs.writeFile(homePath,home,'utf8');

const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.2';
manifest.v11_2={
  homePromotesProductionReadyToolsOnly:true,
  homeRemovesSyntheticAreaShortcut:true,
  homeFeaturedBrandsRespectStrictGate:true
};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const base=JSON.parse(await fs.readFile(path.join(out,'v11-1-quality-report.json'),'utf8'));
const report={
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  uiVersion:'11.2',
  previewMode:base.previewMode,
  productionCandidates:base.productionCandidates,
  strictEligibleBrands:base.strictEligibleBrands,
  homePolicy:{
    promotedTools:['/tools/startup-cost/','/tools/monthly-profit-simulator/'],
    syntheticAreaShortcut:false,
    strictFeaturedBrandLinks:true
  },
  remainingProductionBlockers:base.remainingProductionBlockers
};
await fs.writeFile(path.join(out,'v11-2-quality-report.json'),JSON.stringify(report,null,2),'utf8');

console.log(JSON.stringify({v11_2:'PASS',productionCandidates:report.productionCandidates,strictEligibleBrands:report.strictEligibleBrands},null,2));
