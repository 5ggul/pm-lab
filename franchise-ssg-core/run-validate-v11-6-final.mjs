import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-6-route-integrity.json'),'utf8'));

if(report.htmlPages<300)errors.push(`html page count unexpectedly low: ${report.htmlPages}`);
if(report.expectedBrands!==170||report.brandPagesFound!==170||report.missingBrandRoutes.length)errors.push(`brand routes ${report.brandPagesFound}/${report.expectedBrands}`);
if(report.expectedCategories!==20||report.categoryPagesFound!==20||report.missingCategoryRoutes.length)errors.push(`category routes ${report.categoryPagesFound}/${report.expectedCategories}`);
if(report.expectedCuratedCompares!==10||report.comparePagesFound!==10||report.missingCompareRoutes.length)errors.push(`compare routes ${report.comparePagesFound}/${report.expectedCuratedCompares}`);
if(report.productionTools!==3||report.missingToolRoutes.length)errors.push(`production tools missing: ${report.missingToolRoutes.join(',')}`);
if(report.internalLinksChecked<1000)errors.push(`too few internal links checked: ${report.internalLinksChecked}`);
if(report.brokenInternalLinks.length)errors.push(`broken internal links: ${report.brokenInternalLinks.length}`);
if(report.canonicalMissing.length)errors.push(`canonical missing: ${report.canonicalMissing.length}`);
if(report.canonicalOffsite.length)errors.push(`offsite canonical: ${report.canonicalOffsite.length}`);
if(report.previewNoindexMissing.length)errors.push(`preview noindex missing: ${report.previewNoindexMissing.length}`);

const tools={
  'tools/startup-cost/index.html':['data-tool="startup-cost-v10"','name="publicCost"','name="rentDeposit"','name="keyMoney"','data-startup-total','data-copy-url'],
  'tools/monthly-profit-simulator/index.html':['data-tool="monthly-profit-v10"','name="revenue"','name="materialRate"','name="labor"','data-profit-balance','data-profit-breakeven','data-copy-url'],
  'tools/disclosure-decoder/index.html':['data-tool="disclosure-decoder"','name="franchise"','name="education"','name="deposit"','name="etc"','name="interior"','data-total','data-reset']
};
for(const [rel,markers] of Object.entries(tools)){
  const h=await fs.readFile(path.join(out,rel),'utf8');
  for(const marker of markers)if(!h.includes(marker))errors.push(`${rel}: missing ${marker}`);
}

const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
if(manifest.uiVersion!=='11.6')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(!manifest.v11_6?.fullStaticRouteAudit)errors.push('manifest fullStaticRouteAudit missing');
if(Number(manifest.v11_6?.brandPages)!==170)errors.push('manifest brand page count mismatch');
if(Number(manifest.v11_6?.categoryPages)!==20)errors.push('manifest category page count mismatch');
if(Number(manifest.v11_6?.curatedComparePages)!==10)errors.push('manifest compare page count mismatch');
if(Number(manifest.v11_6?.productionTools)!==3)errors.push('manifest production tool count mismatch');
if(Number(manifest.v11_6?.brokenInternalLinks)!==0)errors.push('manifest broken links must be zero');
if(Number(manifest.v11_6?.canonicalMissing)!==0)errors.push('manifest canonicalMissing must be zero');
if(Number(manifest.v11_6?.previewNoindexMissing)!==0)errors.push('manifest previewNoindexMissing must be zero');

const pkg=JSON.parse(await fs.readFile(path.join(here,'package.json'),'utf8'));
if(!String(pkg.scripts?.build||'').includes('run-generate-v11-6-final.mjs'))errors.push('package build missing v11.6 generator');
if(!String(pkg.scripts?.build||'').includes('run-validate-v11-6-final.mjs'))errors.push('package build missing v11.6 validator');

if(errors.length){console.error(JSON.stringify({v11_6Validation:'FAIL',errors,broken:report.brokenInternalLinks.slice(0,30)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_6Validation:'PASS',htmlPages:report.htmlPages,brands:170,categories:20,compares:10,tools:3,internalLinksChecked:report.internalLinksChecked,brokenLinks:0,canonicalMissing:0,noindexMissing:0},null,2));
