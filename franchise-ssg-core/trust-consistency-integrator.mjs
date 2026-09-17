import fs from 'node:fs';
import path from 'node:path';

const BASE='/pm-lab/franchise-ssg-preview';
const START='<!-- v11.52 trust consistency: start -->';
const END='<!-- v11.52 trust consistency: end -->';
const OLD_UPDATE='2026-09-12: 2025 기준 공식 스냅샷 11,724건을 확인했고 기존 170개 카탈로그 중 149개를 정확명 또는 수동검토 별칭으로 매칭했습니다. 0개는 미매칭, 0개는 명칭 중복 확인이 필요합니다.';
const NEW_UPDATE='2026-09-12: 2025 기준 공식 스냅샷 11,724건을 확인했고 기존 170개 브랜드 카탈로그 중 149개는 공식 데이터와 식별자 매칭을 확인했습니다. 이후 공식 키·헤더·브랜드명·법인명 교차 검증을 통과한 136개를 공개 후보로 남겼습니다. 각 단계는 서로 다른 검수 게이트이므로 단계 밖 항목을 하나의 미매칭 사유로 단정하지 않습니다.';
const BLOCK=`${START}<section class="v52-trust-gate" data-v52-trust-gate="1" aria-labelledby="v52-trust-gate-title"><div class="v52-trust-gate-head"><span>DATA GATE</span><h2 id="v52-trust-gate-title">데이터 공개 게이트</h2><p>카탈로그 수, 공식 데이터 식별자 매칭 수, 공개 후보 수는 같은 기준의 숫자가 아닙니다. 단계별 조건을 통과한 범위를 따로 표시합니다.</p></div><ol class="v52-trust-gate-grid"><li data-v52-trust-gate-item="catalog"><small>01 · 카탈로그 범위</small><strong>170개</strong><p>검수 시작점으로 사용하는 기존 브랜드 식별자 범위입니다.</p></li><li data-v52-trust-gate-item="matched"><small>02 · 공식 데이터 식별자 매칭</small><strong>149개</strong><p>공식 데이터에서 브랜드·법인 식별 관계를 확인한 범위입니다.</p></li><li data-v52-trust-gate-item="trusted"><small>03 · 공개 후보 신뢰 게이트</small><strong>136개</strong><p>공식 키·헤더·브랜드명·법인명 교차 검증을 통과해 현재 공개 후보로 남긴 범위입니다.</p></li></ol><p class="v52-trust-gate-note">단계 간 차이는 단일 실패 사유를 뜻하지 않습니다. 결측·식별·구조 검수 기준은 <a href="${BASE}/sources/">데이터 출처</a>와 <a href="${BASE}/updates/">변경 기록</a>을 함께 확인하고, 실제 계약 판단 전에는 <a href="${BASE}/disclaimer/">면책 고지</a>도 확인하세요.</p></section>${END}`;

function requireRoot(root){if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');}
function replaceMarked(text){
  const a=text.indexOf(START),b=text.indexOf(END);
  if((a<0)!=(b<0))throw new Error('Incomplete trust consistency marker');
  if(a<0)return null;
  if(b<a)throw new Error('Reversed trust consistency marker');
  return text.slice(0,a)+BLOCK+text.slice(b+END.length);
}

export function applyTrustConsistency(root){
  requireRoot(root);
  const updatesFile=path.join(root,'updates/index.html');
  const methodologyFile=path.join(root,'methodology/index.html');
  const sourcesFile=path.join(root,'sources/index.html');
  let updates=fs.readFileSync(updatesFile,'utf8');
  let methodology=fs.readFileSync(methodologyFile,'utf8');
  const sources=fs.readFileSync(sourcesFile,'utf8');
  const originalUpdates=updates,originalMethodology=methodology;
  if(!updates.includes('<h1>데이터 변경 기록</h1>')||!methodology.includes('<h1>계산 기준</h1>')||!sources.includes('data-v47-source-funnel="1"'))throw new Error('Trust page shape mismatch');
  if(updates.includes(OLD_UPDATE))updates=updates.replace(OLD_UPDATE,NEW_UPDATE);
  else if(!updates.includes(NEW_UPDATE))throw new Error('Updates baseline sentence changed; refusing an unverified rewrite');
  if(updates.includes('0개는 미매칭'))throw new Error('Contradictory unmatched copy retained');
  const replaced=replaceMarked(methodology);
  if(replaced!==null)methodology=replaced;
  else{
    const needle='</article></div></main>';
    if(!methodology.includes(needle))throw new Error('Methodology insertion point missing');
    methodology=methodology.replace(needle,BLOCK+needle);
  }
  const cssTag=`<link rel="stylesheet" href="${BASE}/assets/trust-consistency.css" data-v52-trust-consistency>`;
  if(!methodology.includes('/assets/trust-consistency.css'))methodology=methodology.replace('</head>',cssTag+'</head>');
  if(updates!==originalUpdates)fs.writeFileSync(updatesFile,updates);
  if(methodology!==originalMethodology)fs.writeFileSync(methodologyFile,methodology);
  validateTrustConsistency(root);
  return{changed:updates!==originalUpdates||methodology!==originalMethodology,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,candidateSetChanged:false};
}

export function validateTrustConsistency(root){
  requireRoot(root);
  const updates=fs.readFileSync(path.join(root,'updates/index.html'),'utf8');
  const methodology=fs.readFileSync(path.join(root,'methodology/index.html'),'utf8');
  const sources=fs.readFileSync(path.join(root,'sources/index.html'),'utf8');
  if(updates.includes('0개는 미매칭')||updates.includes('0개는 명칭 중복 확인'))throw new Error('Unsupported zero-status copy remains in updates');
  if(!updates.includes(NEW_UPDATE))throw new Error('Corrected update record missing');
  if((methodology.match(/data-v52-trust-gate="1"/g)||[]).length!==1)throw new Error('Methodology trust gate missing or duplicated');
  if((methodology.match(/data-v52-trust-gate-item=/g)||[]).length!==3)throw new Error('Methodology trust gate item count mismatch');
  for(const html of [sources,updates,methodology])for(const value of ['170','149','136'])if(!html.includes(value))throw new Error(`Trust count ${value} missing from a trust page`);
  for(const href of ['/sources/','/updates/','/disclaimer/'])if(!methodology.includes(`href="${BASE}${href}"`))throw new Error(`Methodology trust link missing ${href}`);
  if(!methodology.includes('/assets/trust-consistency.css')||!fs.existsSync(path.join(root,'assets/trust-consistency.css')))throw new Error('Trust consistency CSS missing');
  for(const html of [updates,methodology])if(!html.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))throw new Error('Preview noindex removed from trust page');
  if(!methodology.includes('<h1>계산 기준</h1>')||!updates.includes('<h1>데이터 변경 기록</h1>'))throw new Error('Trust page H1 changed unexpectedly');
  return{trustConsistency:true,catalog:170,officialMatched:149,publicCandidates:136,unsupportedZeroStatus:false};
}
