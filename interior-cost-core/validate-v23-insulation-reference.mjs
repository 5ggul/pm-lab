import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('docs/interior-cost-preview');
const read=r=>JSON.parse(fs.readFileSync(path.join(root,r),'utf8'));
const errors=[];
const files=['data/insulation-reference-v23.json','data/insulation-editorial-v23.json','data/matrix-route-plan-v23.json','data/release-url-set-v23.json','data/matrix-release-gate-v23.json','data/matrix-cutover-simulation-v23.json','data/answer-index-v23.json','data/site-quality-v23.json'];
for(const f of files)if(!fs.existsSync(path.join(root,f)))errors.push(`missing:${f}`);
if(!errors.length){
  const refs=read('data/insulation-reference-v23.json'),editorial=read('data/insulation-editorial-v23.json'),plan=read('data/matrix-route-plan-v23.json'),release=read('data/release-url-set-v23.json'),gate=read('data/matrix-release-gate-v23.json'),cutover=read('data/matrix-cutover-simulation-v23.json'),answers=read('data/answer-index-v23.json'),quality=read('data/site-quality-v23.json');
  const expected={
    'OD020.20050':16147,'OD020.20100':17893,'OD020.20200':18922,'OD020.20300':20024,
    'OD020.30050':8289,'OD020.30100':9138,'OD020.50050':14925,'OD020.50200':17333
  };
  if(refs.version!=='23.0.0'||refs.rows?.length!==8||refs.private_market_average!==false||refs.automatic_material_sum!==false)errors.push('reference-summary');
  for(const row of refs.rows||[]){if(expected[row.code]!==row.price||row.unit!=='㎡')errors.push(`reference-row:${row.code}`)}
  if(new Set((refs.rows||[]).map(x=>x.code)).size!==8)errors.push('reference-code-duplicates');
  if(editorial.version!=='23.0.0'||editorial.route_count!==5||editorial.faq_count!==15||editorial.records?.length!==5)errors.push('editorial-summary');
  if(new Set((editorial.records||[]).map(x=>x.title)).size!==5)errors.push('editorial-title-duplicates');
  if(editorial.records?.some(x=>x.public_ref_count!==8||x.material_group_count<1||x.check_count<4||x.faq_count!==3))errors.push('editorial-record-quality');
  if(plan.version!=='23.0.0'||plan.route_count!==25||plan.release_count!==25||plan.hold_count!==0||plan.routes?.length!==25)errors.push('plan-summary');
  const insulation=plan.routes?.filter(x=>x.trade==='insulation')||[];
  if(insulation.length!==5||insulation.some(x=>x.status!=='RELEASE'||x.public_ref_count!==8||x.release_source!=='v23_insulation'))errors.push('plan-insulation');
  if(release.version!=='23.0.0'||release.base_v22_count!==95||release.matrix_release!==25||release.matrix_hold!==0||release.new_candidates!==5||release.total_count!==100||release.urls?.length!==100||release.simulation_only!==true||release.actual_preview_noindex_unchanged!==true)errors.push('release-summary');
  const releasePaths=new Set((release.urls||[]).map(x=>x.path));
  for(const r of plan.routes||[])if(!releasePaths.has(r.path))errors.push(`release-missing:${r.path}`);
  if(gate.version!=='23.0.0'||gate.preview_indexing!==false||gate.production_switch!==false||gate.release_count!==25||gate.hold_count!==0||gate.release_routes?.length!==25||gate.hold_routes?.length!==0)errors.push('gate-summary');
  if(gate.rules?.pyeong_used_as_work_area!==false||gate.rules?.automatic_cross_layer_sum!==false||gate.rules?.private_market_average_from_public_data!==false)errors.push('gate-boundaries');
  if(cutover.version!=='23.0.0'||cutover.simulation_only!==true||cutover.applied!==false||cutover.owner_approval_required!==true||cutover.current_preview_robots!=='noindex,nofollow'||cutover.release_count!==25||cutover.hold_count!==0||cutover.rules?.search_console_submission!==false||cutover.rules?.ads_activation!==false)errors.push('cutover-summary');
  if(answers.version!=='23.0.0'||answers.base_v22_count!==250||answers.added_v23!==15||answers.count!==265||answers.answers?.length!==265)errors.push('answer-summary');
  const v23=(answers.answers||[]).filter(x=>String(x.id).startsWith('v23-'));
  if(v23.length!==15||new Set(v23.map(x=>x.question)).size!==15)errors.push('answer-uniqueness');
  if(quality.version!=='23.0.0'||quality.matrix_release!==25||quality.matrix_hold!==0||quality.insulation_reference_rows!==8||quality.insulation_editorial_routes!==5||quality.insulation_faqs!==15||quality.release_candidates!==100||quality.answer_count!==265||quality.preview_noindex!==true||quality.actual_production_switch||quality.actual_search_console_submission||quality.actual_ads_injected)errors.push('quality-summary');
  for(const p of [24,30,32,34,40]){
    const rel=`interior-cost/matrix/${p}-pyeong/insulation/index.html`,full=path.join(root,rel);
    if(!fs.existsSync(full)){errors.push(`page-missing:${rel}`);continue}
    const h=fs.readFileSync(full,'utf8');
    for(const token of ['noindex,nofollow','data-v23-insulation','data-v23-faq','REFERENCE FIX · V23','OD020.20050','OD020.50050','실제 작업면적 자동 추정 안 함','자동 합산하지 않습니다'])if(!h.includes(token))errors.push(`page-token:${p}:${token}`);
    if((h.match(/data-v23-faq-list/g)||[]).length!==1)errors.push(`faq-block-count:${p}`);
    const config=h.match(/<script type="application\/json" data-v21-route-config>([\s\S]*?)<\/script>/)?.[1];
    if(!config){errors.push(`config-missing:${p}`);continue}
    try{const c=JSON.parse(config);if(c.public_refs?.length!==8||c.materials?.length<1)errors.push(`config-layers:${p}`)}catch{errors.push(`config-json:${p}`)}
  }
  const hub=fs.readFileSync(path.join(root,'interior-cost/matrix/index.html'),'utf8');
  if(!hub.includes('data-v23-release-note')||!hub.includes('출시 후보</span><strong>25개</strong>')||!hub.includes('25개 모두 데이터·편집 검수 후보'))errors.push('matrix-hub');
  if(!fs.readFileSync(path.join(root,'llms.txt'),'utf8').includes('# v23 insulation reference'))errors.push('llms');
}
if(errors.length){console.error(JSON.stringify({ok:false,version:'23.0.0',errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,version:'23.0.0',insulation_reference_rows:8,insulation_routes:5,matrix_release:25,matrix_hold:0,release_candidates:100,answer_count:265,preview_indexing:false,production_switch:false},null,2));
