import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const report=JSON.parse(await fs.readFile(path.join(out,'production-readiness-report.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const authority=JSON.parse(await fs.readFile(path.join(out,'internal-authority-report.json'),'utf8'));
const errors=[];
const expectedCandidates=(quality.indexPolicy?.productionCandidateUrls||[]).length;

if(report.schemaVersion!==1)errors.push(`schemaVersion ${report.schemaVersion}`);
if(report.previewMode!==true)errors.push('production readiness audit must inspect preview artifacts only');
if(report.previewSafety?.candidateCount!==expectedCandidates)errors.push(`candidate count ${report.previewSafety?.candidateCount}/${expectedCandidates}`);
if((report.previewSafety?.candidateHtmlMissing||[]).length)errors.push('candidate HTML missing');
if((report.previewSafety?.candidateNoindexMissing||[]).length)errors.push('preview candidate noindex regression');
if(report.previewSafety?.robotsDisallowAll!==true)errors.push('preview robots no longer blocks crawling');
if(report.previewSafety?.sitemapEmpty!==true)errors.push('preview sitemap is not empty');
if((report.previewSafety?.adCodeRoutes||[]).length)errors.push('ad code appeared before production release');
if(report.graphSafe!==true)errors.push('internal link graph not safe');
if((authority.graph?.candidateHtmlMissing||[]).length||(authority.graph?.unreachableCandidates||[]).length||(authority.graph?.orphanCandidates||[]).length)errors.push('authority report has graph regressions');
if(report.adReadiness?.candidateCount!==expectedCandidates)errors.push('ad readiness candidate count mismatch');
if(Number(report.adReadiness?.adEligibleCount||0)+Number(report.adReadiness?.adDeferredCount||0)!==expectedCandidates)errors.push('ad readiness classification incomplete');
if(report.releaseDecision==='READY_FOR_MANUAL_PRODUCTION_SWITCH'&&(report.blockers||[]).length)errors.push('ready decision has blockers');
if(report.releaseDecision==='BLOCKED'&&!(report.blockers||[]).length)errors.push('blocked decision has no blockers');
if((report.contentLeaks?.syntheticLeakRoutes||[]).length)errors.push(`synthetic visible-content leaks: ${report.contentLeaks.syntheticLeakRoutes.length}`);

if(errors.length){
  console.error(JSON.stringify({productionReadinessValidation:'FAIL',errors,releaseDecision:report.releaseDecision,blockers:report.blockers},null,2));
  process.exit(1);
}
console.log(JSON.stringify({productionReadinessValidation:'PASS',releaseDecision:report.releaseDecision,candidates:expectedCandidates,adEligible:report.adReadiness.adEligibleCount,blockers:report.blockers,warnings:report.warnings},null,2));
