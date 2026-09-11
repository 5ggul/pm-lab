import fs from 'node:fs';
import path from 'node:path';
import {assessBaseUrl} from '../validate-release-base-url-v6.mjs';

const errors=[];
const good=assessBaseUrl('https://interiorcost.kr/');
if(!good.ok||good.normalized_base_url!=='https://interiorcost.kr/'||good.preview_host)errors.push('good-domain');
const http=assessBaseUrl('http://interiorcost.kr/');if(http.ok||!http.errors.includes('https-required'))errors.push('https-gate');
const test=assessBaseUrl('https://example.test/');if(test.ok||!test.errors.some(x=>x.startsWith('non-production-host:')))errors.push('reserved-host');
const loopback=assessBaseUrl('https://localhost/');if(loopback.ok||!loopback.errors.some(x=>x.startsWith('non-production-host:')))errors.push('loopback-host');
const preview=assessBaseUrl('https://5ggul.github.io/pm-lab/interior-cost-preview/');if(preview.ok||!preview.errors.some(x=>x.startsWith('preview-host-forbidden:')))errors.push('preview-block');
const previewAllowed=assessBaseUrl('https://5ggul.github.io/pm-lab/interior-cost-preview/',{allowPreviewHost:true});if(!previewAllowed.ok||!previewAllowed.preview_host||previewAllowed.normalized_base_url!=='https://5ggul.github.io/pm-lab/interior-cost-preview/')errors.push('preview-subpath-override');
const credentials=assessBaseUrl('https://user:pw@interiorcost.kr/');if(credentials.ok||!credentials.errors.includes('credentials-in-url'))errors.push('credentials-gate');
const query=assessBaseUrl('https://interiorcost.kr/?x=1');if(query.ok||!query.errors.includes('query-or-fragment-forbidden'))errors.push('query-gate');

const workflows={prices:path.resolve('.github/workflows/interior-public-prices-preflight.yml'),release:path.resolve('.github/workflows/interior-v6-release-preflight.yml')};
for(const [name,file] of Object.entries(workflows)){
  if(!fs.existsSync(file)){errors.push(`workflow-missing:${name}`);continue}
  const y=fs.readFileSync(file,'utf8');
  for(const token of ['workflow_dispatch:','permissions:','contents: read','actions/upload-artifact@v4'])if(!y.includes(token))errors.push(`${name}:${token}`);
  for(const forbidden of ['contents: write','actions: write','pages: write','actions/deploy-pages','netlify deploy','wrangler pages deploy','git push','git commit'])if(y.includes(forbidden))errors.push(`${name}:forbidden:${forbidden}`);
}
if(fs.existsSync(workflows.prices)){
  const y=fs.readFileSync(workflows.prices,'utf8');
  for(const token of ['preflight-request.trigger','DATA_GO_KR_SERVICE_KEY','preflight-public-prices-v6.mjs','public-price-preflight.json','Confirm repository remained unchanged'])if(!y.includes(token))errors.push(`prices:${token}`);
  if(y.includes('preflight-request.json'))errors.push('prices:web-request-file-forbidden');
}
if(fs.existsSync(workflows.release)){
  const y=fs.readFileSync(workflows.release,'utf8');
  for(const token of ['push:','release-preflight-request.trigger','actions: read','base_url:','owner_approved:','allow_preview_host:','https://5ggul.github.io/pm-lab/interior-cost-preview/',"github.event_name == 'push' && 'true'","inputs.owner_approved && 'true' || 'false'",'RELEASE_REHEARSAL:','RELEASE_REVIEW_DIR:','/tmp/interior-v6-release-review/release-readiness.json','/tmp/interior-v6-release-review/release-checklist.json','Confirm current SHA review CI succeeded','GITHUB_SHA','interior-v6-review','REVIEW_CI_PASSED=true','validate-release-base-url-v6.mjs','build-production-v6.mjs','validate-production-v6.mjs','validate-production-assets-v6.mjs','build-launch-readiness-v6.mjs','build-production-manifest-v6.mjs','preflight-public-prices-v6.mjs','build-release-checklist-v6.mjs','PUBLIC_PRICE_PREFLIGHT_FILE:','Confirm candidate manifest still exact','Confirm repository remained unchanged'])if(!y.includes(token))errors.push(`release:${token}`);
  if(y.includes('release-preflight-request.json'))errors.push('release:web-request-file-forbidden');
  if(y.includes("REVIEW_CI_PASSED: 'true'"))errors.push('release:hardcoded-review-ci-forbidden');
  if(!/OWNER_APPROVED:\s*\$\{\{ inputs\.owner_approved/.test(y))errors.push('release:owner-approval-input-only');
  if(!/ALLOW_PREVIEW_HOST:\s*\$\{\{ github\.event_name == 'push'/.test(y))errors.push('release:preview-push-rehearsal-only');
  if(!/authorization:`Bearer \$\{token\}`/.test(y))errors.push('release:review-ci-read-token');
}
const preflightSource=fs.readFileSync(path.resolve('interior-cost-core/preflight-public-prices-v6.mjs'),'utf8');for(const token of ["mode:'read_only_preflight'",'minPublishedRows:1','PREFLIGHT_STRICT','repository_write:false','production_deploy:false'])if(!preflightSource.includes(token))errors.push(`public-price-source:${token}`);
const checklistSource=fs.readFileSync(path.resolve('interior-cost-core/build-release-checklist-v6.mjs'),'utf8');for(const token of ['production_domain','owner_preview_approval','public_price_live_preflight','external_blocker','deploy_executed:false'])if(!checklistSource.includes(token))errors.push(`checklist-source:${token}`);
const baseSource=fs.readFileSync(path.resolve('interior-cost-core/validate-release-base-url-v6.mjs'),'utf8');for(const token of ['https-required','preview-host-forbidden','non-production-host','ALLOW_PREVIEW_HOST'])if(!baseSource.includes(token))errors.push(`base-url-source:${token}`);
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,production_url_gate:true,https_required:true,preview_host_blocked_by_default:true,preview_subpath_rehearsal:true,non_web_trigger_files:true,release_metadata_outside_candidate:true,manifest_revalidated_after_checklist:true,review_ci_status_resolved_from_actions_api:true,hardcoded_review_ci_pass_forbidden:true,public_price_preflight:'artifact-only',release_preflight:'artifact-only',integrated_release_checklist:true,repository_permissions:['contents:read','actions:read'],deploy_action:false,owner_approval_input:true,push_rehearsal_owner_approved:false},null,2));
