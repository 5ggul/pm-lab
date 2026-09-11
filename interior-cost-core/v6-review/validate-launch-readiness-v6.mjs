import fs from 'node:fs';
import path from 'node:path';

const file=path.resolve(process.env.READINESS_OUT||'/tmp/interior-v6-launch-readiness.json');
const errors=[];
if(!fs.existsSync(file))errors.push('readiness-report-missing');
const report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
const expectBool=(name,actual)=>{if(process.env[name]!==undefined&&actual!==(process.env[name]==='true'))errors.push(`${name}:${actual}`)};
if(report.schema_version!=='1.0')errors.push('schema-version');
if(!String(report.branch_policy||'').includes('explicit owner approval'))errors.push('approval-policy');
for(const id of ['production_validation','generated_outputs','indexable_page_floor','private_admin_excluded','reviewed_contract','construction_index','machine_readable_policy','public_unit_prices','quote_statistics','quote_submission','owner_preview_approval'])if(!report.checks?.[id])errors.push(`check:${id}`);
if(report.checks?.owner_preview_approval?.manual!==true||report.checks?.owner_preview_approval?.required!==true)errors.push('manual-owner-gate');
if(report.checks?.public_unit_prices?.required!==false||report.checks?.quote_statistics?.required!==false||report.checks?.quote_submission?.required!==false)errors.push('deferred-not-optional');
if(report.summary?.deploy_ready&&!report.summary?.owner_approved)errors.push('deploy-without-owner-approval');
if(report.summary?.deploy_ready&&!report.summary?.core_technical_ready)errors.push('deploy-with-technical-blocker');
if(report.summary?.recommended_release_mode==='full_data'&&!report.summary?.full_data_ready)errors.push('full-data-mode-without-data');
if(report.summary?.recommended_release_mode==='core_only'&&(!report.summary?.core_technical_ready||!report.summary?.owner_approved||report.summary?.full_data_ready))errors.push('invalid-core-only-mode');
expectBool('EXPECT_CORE_TECHNICAL_READY',report.summary?.core_technical_ready);
expectBool('EXPECT_OWNER_APPROVED',report.summary?.owner_approved);
expectBool('EXPECT_DEPLOY_READY',report.summary?.deploy_ready);
expectBool('EXPECT_FULL_DATA_READY',report.summary?.full_data_ready);
if(process.env.EXPECT_RELEASE_MODE&&report.summary?.recommended_release_mode!==process.env.EXPECT_RELEASE_MODE)errors.push(`release-mode:${report.summary?.recommended_release_mode}`);
if(errors.length){console.error(JSON.stringify({ok:false,errors,report},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,core_technical_ready:report.summary.core_technical_ready,owner_approved:report.summary.owner_approved,deploy_ready:report.summary.deploy_ready,full_data_ready:report.summary.full_data_ready,release_mode:report.summary.recommended_release_mode,critical_blockers:report.critical_blockers?.map(x=>x.id)||[],deferred:report.deferred_capabilities?.map(x=>x.id)||[]},null,2));
