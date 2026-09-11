import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('docs/interior-cost-preview');
const planPath=path.join(root,'data/matrix-route-plan-v21.json');
const releasePath=path.join(root,'data/release-url-set-v21.json');
const gatePath=path.join(root,'data/matrix-release-gate-v22.json');
const errors=[];

const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
for(const p of [planPath,releasePath,gatePath]){
  if(!fs.existsSync(p))errors.push(`missing:${path.relative(process.cwd(),p)}`);
}

if(!errors.length){
  const plan=readJson(planPath);
  const release=readJson(releasePath);
  const gate=readJson(gatePath);
  const routes=Array.isArray(plan.routes)?plan.routes:[];
  const releaseRoutes=routes.filter(x=>x.status==='RELEASE');
  const holdRoutes=routes.filter(x=>x.status==='HOLD');
  const releasePaths=new Set((release.urls||[]).map(x=>x.path));
  const gateRelease=new Set(gate.release_routes||[]);
  const gateHold=new Map((gate.hold_routes||[]).map(x=>[x.path,x.reason]));

  if(plan.version!=='21.0.0')errors.push('plan-version');
  if(plan.route_count!==25||routes.length!==25)errors.push('route-count');
  if(plan.release_count!==10||releaseRoutes.length!==10)errors.push('release-count');
  if(plan.hold_count!==15||holdRoutes.length!==15)errors.push('hold-count');

  if(release.version!=='21.0.0')errors.push('release-set-version');
  if(release.total_count!==85)errors.push('release-set-total');
  if(release.matrix_routes!==25||release.matrix_release!==10||release.matrix_hold!==15)errors.push('release-set-matrix-counts');
  if(release.simulation_only!==true)errors.push('release-set-must-remain-simulation');
  if(release.actual_preview_noindex_unchanged!==true)errors.push('preview-noindex-contract');

  if(gate.version!=='22.0.0')errors.push('gate-version');
  if(gate.preview_indexing!==false||gate.production_switch!==false)errors.push('gate-mode');
  if(gate.route_count!==25||gate.release_count!==10||gate.hold_count!==15)errors.push('gate-counts');
  if(gate.rules?.editorial_pilot_required!==true)errors.push('gate-editorial-rule');
  if(gate.rules?.public_reference_required!==true)errors.push('gate-reference-rule');
  if(gate.rules?.official_material_group_required!==true)errors.push('gate-material-rule');
  if(gate.rules?.pyeong_used_as_work_area!==false)errors.push('gate-pyeong-rule');
  if(gate.rules?.automatic_cross_layer_sum!==false)errors.push('gate-cross-layer-rule');
  if(gate.rules?.private_market_average_from_public_data!==false)errors.push('gate-market-average-rule');
  if(gate.rules?.hold_routes_must_not_enter_release_set!==true)errors.push('gate-hold-rule');

  if(gateRelease.size!==10)errors.push('gate-release-size');
  if(gateHold.size!==15)errors.push('gate-hold-size');

  for(const r of releaseRoutes){
    if(!releasePaths.has(r.path))errors.push(`release-missing-from-set:${r.path}`);
    if(!gateRelease.has(r.path))errors.push(`release-missing-from-gate:${r.path}`);
    if(gateHold.has(r.path))errors.push(`release-also-held:${r.path}`);
    if(!(Number(r.public_ref_count)>0))errors.push(`release-public-reference-gap:${r.path}`);
    if(!(Number(r.material_group_count)>0))errors.push(`release-material-gap:${r.path}`);
  }

  for(const r of holdRoutes){
    if(releasePaths.has(r.path))errors.push(`hold-leaked-into-release-set:${r.path}`);
    if(gateRelease.has(r.path))errors.push(`hold-leaked-into-gate-release:${r.path}`);
    if(!gateHold.has(r.path))errors.push(`hold-missing-reason:${r.path}`);
    if(Number(r.public_ref_count)===0&&gateHold.get(r.path)!=='reference_gap')errors.push(`hold-reference-reason:${r.path}`);
  }

  for(const r of routes){
    const htmlPath=path.join(root,r.path);
    if(!fs.existsSync(htmlPath)){
      errors.push(`page-missing:${r.path}`);
      continue;
    }
    const html=fs.readFileSync(htmlPath,'utf8');
    if(!html.includes('noindex,nofollow'))errors.push(`page-indexable:${r.path}`);
    for(const token of ['실제 작업면적 자동 추정 안 함','민간 시장평균 생성 안 함','자동 합산하지 않습니다']){
      if(!html.includes(token))errors.push(`boundary-missing:${r.path}:${token}`);
    }
  }
}

if(errors.length){
  console.error(JSON.stringify({ok:false,version:'22.0.0',errors},null,2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok:true,
  version:'22.0.0',
  route_count:25,
  release_count:10,
  hold_count:15,
  release_set_total:85,
  preview_indexing:false,
  production_switch:false,
  policy:'hold routes cannot enter the simulated release set until the gate is explicitly revised'
},null,2));
