import fs from 'node:fs';
import path from 'node:path';

const out=path.resolve(process.env.OUT_DIR||'/tmp/interior-v6-production');
const reportFile=path.resolve(process.env.READINESS_OUT||'/tmp/interior-v6-launch-readiness.json');
const ownerApproved=process.env.OWNER_APPROVED==='true';
const productionValidated=process.env.PRODUCTION_VALIDATED==='true';
const quoteSubmitEnabled=process.env.ENABLE_QUOTE_SUBMIT==='true';
const minIndexablePages=Math.max(1,Number(process.env.MIN_INDEXABLE_PAGES)||35);
const now=process.env.READINESS_NOW||new Date().toISOString();
const readJson=p=>{try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}};
const exists=rel=>fs.existsSync(path.join(out,rel));

const contract=readJson(path.join(out,'data/data-contract.json'))||{};
const catalog=readJson(path.join(out,'data/catalog.json'))||{};
const siteIndex=readJson(path.join(out,'site-index.json'))||{};
const byId=Object.fromEntries((catalog.datasets||[]).map(x=>[x.id,x]));
const indexablePages=Array.isArray(siteIndex.pages)?siteIndex.pages.length:0;
const requiredOutputs=['sitemap.xml','robots.txt','site-index.json','data/catalog.json','llms.txt'];
const missingOutputs=requiredOutputs.filter(x=>!exists(x));
const privateAdminExcluded=!exists('quote-admin');
const reviewDate=/^\d{4}-\d{2}-\d{2}$/.test(String(contract.reviewed_on||''))?contract.reviewed_on:null;
const constructionReady=byId['construction-cost-index']?.status==='ready';
const publicPriceReady=byId['public-unit-prices']?.indexable===true;
const quoteStatisticsReady=byId['quote-public-segments']?.indexable===true;
const machinePolicyReady=Boolean(byId['data-contract']&&byId['work-match-rules']&&byId['public-price-sources']);

const checks={
  production_validation:{required:true,ready:productionValidated,detail:'production validator passed in this run'},
  generated_outputs:{required:true,ready:missingOutputs.length===0,detail:missingOutputs.length?`missing: ${missingOutputs.join(', ')}`:'sitemap/robots/site-index/catalog/llms present'},
  indexable_page_floor:{required:true,ready:indexablePages>=minIndexablePages,detail:`${indexablePages}/${minIndexablePages}`},
  private_admin_excluded:{required:true,ready:privateAdminExcluded,detail:privateAdminExcluded?'quote-admin excluded from production output':'quote-admin found in production output'},
  reviewed_contract:{required:true,ready:Boolean(reviewDate&&contract.version),detail:reviewDate?`${contract.version||'unknown'} · ${reviewDate}`:'review date missing'},
  construction_index:{required:true,ready:constructionReady,detail:constructionReady?'construction cost index ready':'construction cost index not ready'},
  machine_readable_policy:{required:true,ready:machinePolicyReady,detail:machinePolicyReady?'contract/rules/source registry discoverable':'machine-readable policy assets incomplete'},
  public_unit_prices:{required:false,ready:publicPriceReady,detail:publicPriceReady?'public unit price explorer indexable':'deferred until official data readiness gate passes'},
  quote_statistics:{required:false,ready:quoteStatisticsReady,detail:quoteStatisticsReady?'quote statistics indexable':'deferred until exact segment threshold is met'},
  quote_submission:{required:false,ready:quoteSubmitEnabled,detail:quoteSubmitEnabled?'anonymous submission enabled':'disabled by default; not required for core launch'},
  owner_preview_approval:{required:true,ready:ownerApproved,manual:true,detail:ownerApproved?'explicit owner approval supplied':'explicit owner approval not supplied'}
};

const criticalBlockers=Object.entries(checks).filter(([,v])=>v.required&&!v.ready).map(([id,v])=>({id,detail:v.detail,manual:Boolean(v.manual)}));
const deferred=Object.entries(checks).filter(([,v])=>!v.required&&!v.ready).map(([id,v])=>({id,detail:v.detail}));
const coreTechnicalReady=Object.values(checks).filter(v=>v.required&&!v.manual).every(v=>v.ready);
const fullDataReady=publicPriceReady&&quoteStatisticsReady;
const deployReady=coreTechnicalReady&&ownerApproved;
const releaseMode=!coreTechnicalReady?'blocked_technical':!ownerApproved?'blocked_manual_approval':fullDataReady?'full_data':'core_only';

const report={
  schema_version:'1.0',
  generated_at:now,
  reviewed_on:reviewDate,
  branch_policy:'preview/review first; production only after explicit owner approval',
  production_output:out,
  summary:{
    core_technical_ready:coreTechnicalReady,
    owner_approved:ownerApproved,
    deploy_ready:deployReady,
    full_data_ready:fullDataReady,
    recommended_release_mode:releaseMode,
    indexable_pages:indexablePages,
    critical_blockers:criticalBlockers.length,
    deferred_capabilities:deferred.length
  },
  checks,
  critical_blockers:criticalBlockers,
  deferred_capabilities:deferred,
  next_action:!coreTechnicalReady?'fix technical blockers and rerun the full review workflow':!ownerApproved?'obtain explicit owner preview approval before any production deployment':fullDataReady?'production deployment may proceed only through the approved release path':'production may launch core pages if approved; keep deferred data pages gated until their readiness rules pass'
};
fs.mkdirSync(path.dirname(reportFile),{recursive:true});
fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:true,report:reportFile,...report.summary,next_action:report.next_action},null,2));
