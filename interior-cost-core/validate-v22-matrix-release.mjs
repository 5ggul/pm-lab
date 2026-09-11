import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('docs/interior-cost-preview');
const planPath=path.join(root,'data/matrix-route-plan-v22.json');
const releasePath=path.join(root,'data/release-url-set-v22.json');
const gatePath=path.join(root,'data/matrix-release-gate-v22.json');
const cutoverPath=path.join(root,'data/matrix-cutover-simulation-v22.json');
const editorialPath=path.join(root,'data/matrix-editorial-v22.json');
const answersPath=path.join(root,'data/answer-index-v22.json');
const qualityPath=path.join(root,'data/site-quality-v22.json');
const errors=[];

const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
for(const p of [planPath,releasePath,gatePath,cutoverPath,editorialPath,answersPath,qualityPath]){
  if(!fs.existsSync(p))errors.push(`missing:${path.relative(process.cwd(),p)}`);
}

if(!errors.length){
  const plan=readJson(planPath);
  const release=readJson(releasePath);
  const gate=readJson(gatePath);
  const cutover=readJson(cutoverPath);
  const editorial=readJson(editorialPath);
  const answers=readJson(answersPath);
  const quality=readJson(qualityPath);
  const routes=Array.isArray(plan.routes)?plan.routes:[];
  const releaseRoutes=routes.filter(x=>x.status==='RELEASE');
  const holdRoutes=routes.filter(x=>x.status==='HOLD');
  const promoted=routes.filter(x=>x.release_source==='v22_editorial');
  const releasePaths=new Set((release.urls||[]).map(x=>x.path));
  const gateRelease=new Set(gate.release_routes||[]);
  const gateHold=new Map((gate.hold_routes||[]).map(x=>[x.path,x.reason]));
  const cutoverRows=new Map((cutover.routes||[]).map(x=>[x.path,x]));
  const editorialRows=new Map((editorial.records||[]).map(x=>[x.path,x]));

  if(plan.version!=='22.0.0')errors.push('plan-version');
  if(plan.route_count!==25||routes.length!==25)errors.push('route-count');
  if(plan.release_count!==20||releaseRoutes.length!==20)errors.push('release-count');
  if(plan.hold_count!==5||holdRoutes.length!==5)errors.push('hold-count');
  if(promoted.length!==10)errors.push('editorial-promotion-count');
  if(holdRoutes.some(r=>r.trade!=='insulation'))errors.push('non-insulation-hold-remains');

  if(release.version!=='22.0.0')errors.push('release-set-version');
  if(release.total_count!==95||release.urls?.length!==95)errors.push('release-set-total');
  if(release.base_v21_count!==85||release.matrix_routes!==25||release.matrix_release!==20||release.matrix_hold!==5||release.new_candidates!==10)errors.push('release-set-matrix-counts');
  if(release.simulation_only!==true)errors.push('release-set-must-remain-simulation');
  if(release.actual_preview_noindex_unchanged!==true)errors.push('preview-noindex-contract');

  if(gate.version!=='22.0.0')errors.push('gate-version');
  if(gate.preview_indexing!==false||gate.production_switch!==false)errors.push('gate-mode');
  if(gate.route_count!==25||gate.release_count!==20||gate.hold_count!==5)errors.push('gate-counts');
  if(gate.rules?.editorial_review_required_for_v22_promotions!==true)errors.push('gate-editorial-rule');
  if(gate.rules?.public_reference_required!==true)errors.push('gate-reference-rule');
  if(gate.rules?.official_material_group_required!==true)errors.push('gate-material-rule');
  if(gate.rules?.pyeong_used_as_work_area!==false)errors.push('gate-pyeong-rule');
  if(gate.rules?.automatic_cross_layer_sum!==false)errors.push('gate-cross-layer-rule');
  if(gate.rules?.private_market_average_from_public_data!==false)errors.push('gate-market-average-rule');
  if(gate.rules?.hold_routes_must_not_enter_release_set!==true)errors.push('gate-hold-rule');
  if(gateRelease.size!==20||gateHold.size!==5)errors.push('gate-route-size');

  if(editorial.version!=='22.0.0'||editorial.editorial_count!==10||editorial.faq_count!==30||editorial.records?.length!==10)errors.push('editorial-data-counts');
  if(new Set((editorial.records||[]).map(x=>x.title)).size!==10)errors.push('editorial-title-duplicates');
  if(editorial.records?.some(x=>x.check_count<4||x.faq_count!==3||x.public_ref_count<1||x.material_group_count<1))errors.push('editorial-record-quality');

  if(answers.version!=='22.0.0'||answers.base_v21_count!==220||answers.added_v22!==30||answers.count!==250||answers.answers?.length!==250)errors.push('answer-index-counts');
  const v22Answers=(answers.answers||[]).filter(x=>String(x.id).startsWith('v22-'));
  if(v22Answers.length!==30||new Set(v22Answers.map(x=>x.question)).size!==30)errors.push('answer-index-editorial-uniqueness');

  if(cutover.version!=='22.0.0')errors.push('cutover-version');
  if(cutover.simulation_only!==true||cutover.applied!==false||cutover.owner_approval_required!==true)errors.push('cutover-must-remain-simulation');
  if(cutover.current_preview_robots!=='noindex,nofollow')errors.push('cutover-preview-robots');
  if(cutover.release_count!==20||cutover.hold_count!==5||cutoverRows.size!==25)errors.push('cutover-counts');
  if(cutover.rules?.hold_never_in_sitemap!==true||cutover.rules?.hold_never_in_search_console_batch!==true||cutover.rules?.bulk_noindex_removal_forbidden!==true)errors.push('cutover-rules');

  if(quality.version!=='22.0.0'||quality.matrix_routes!==25||quality.matrix_release!==20||quality.matrix_hold!==5||quality.editorial_promotions!==10||quality.editorial_faqs!==30||quality.release_candidates!==95||quality.answer_count!==250||quality.preview_noindex!==true||quality.actual_production_switch||quality.actual_search_console_submission||quality.actual_ads_injected)errors.push('quality-summary');

  for(const r of releaseRoutes){
    if(!releasePaths.has(r.path))errors.push(`release-missing-from-set:${r.path}`);
    if(!gateRelease.has(r.path))errors.push(`release-missing-from-gate:${r.path}`);
    if(gateHold.has(r.path))errors.push(`release-also-held:${r.path}`);
    if(!(Number(r.public_ref_count)>0))errors.push(`release-public-reference-gap:${r.path}`);
    if(!(Number(r.material_group_count)>0))errors.push(`release-material-gap:${r.path}`);
    const c=cutoverRows.get(r.path);
    if(!c||c.status!=='RELEASE'||c.future_robots_if_approved!=='index,follow')errors.push(`release-cutover-mismatch:${r.path}`);
  }

  for(const r of holdRoutes){
    if(releasePaths.has(r.path))errors.push(`hold-leaked-into-release-set:${r.path}`);
    if(gateRelease.has(r.path))errors.push(`hold-leaked-into-gate-release:${r.path}`);
    if(!gateHold.has(r.path))errors.push(`hold-missing-reason:${r.path}`);
    if(Number(r.public_ref_count)!==0||gateHold.get(r.path)!=='reference_gap')errors.push(`hold-reference-reason:${r.path}`);
    const c=cutoverRows.get(r.path);
    if(!c||c.status!=='HOLD'||c.future_robots_if_approved!=='noindex,follow')errors.push(`hold-cutover-mismatch:${r.path}`);
  }

  for(const r of routes){
    const htmlPath=path.join(root,r.path);
    if(!fs.existsSync(htmlPath)){
      errors.push(`page-missing:${r.path}`);
      continue;
    }
    const html=fs.readFileSync(htmlPath,'utf8');
    if(!html.includes('noindex,nofollow'))errors.push(`page-indexable:${r.path}`);
    for(const token of ['실제 작업면적 자동 추정 안 함','민간 시장평균 생성 안 함','자동 합산하지 않습니다'])if(!html.includes(token))errors.push(`boundary-missing:${r.path}:${token}`);
    if(r.release_source==='v22_editorial'){
      if(!html.includes('data-v22-editorial')||!html.includes('data-v22-faq')||!html.includes('EDITORIAL REVIEW · V22'))errors.push(`editorial-html-missing:${r.path}`);
      const row=editorialRows.get(r.path);
      if(!row||!html.includes(row.title))errors.push(`editorial-title-missing:${r.path}`);
    }
  }
  const matrix=fs.readFileSync(path.join(root,'interior-cost/matrix/index.html'),'utf8');
  if(!matrix.includes('data-v22-release-note')||!matrix.includes('출시 후보</span><strong>20개</strong>')||!matrix.includes('단열 5개 조합만 HOLD'))errors.push('matrix-hub-v22-state');
  if(!fs.readFileSync(path.join(root,'llms.txt'),'utf8').includes('# v22 editorial matrix'))errors.push('llms-v22');
}

if(errors.length){
  console.error(JSON.stringify({ok:false,version:'22.0.0',errors},null,2));
  process.exit(1);
}
console.log(JSON.stringify({ok:true,version:'22.0.0',route_count:25,release_count:20,hold_count:5,editorial_promotions:10,editorial_faqs:30,release_set_total:95,answer_count:250,preview_indexing:false,production_switch:false,cutover_simulation_only:true},null,2));
