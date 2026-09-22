import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const BASE='/pm-lab/franchise-ssg-preview';
const START='<!-- v11.52 trust consistency: start -->';
const END='<!-- v11.52 trust consistency: end -->';
const OP_START='<!-- v11.52 operator evidence: start -->';
const OP_END='<!-- v11.52 operator evidence: end -->';
const OLD_UPDATE='2026-09-12: 2025 기준 공식 스냅샷 11,724건을 확인했고 기존 170개 카탈로그 중 149개를 정확명 또는 수동검토 별칭으로 매칭했습니다. 0개는 미매칭, 0개는 명칭 중복 확인이 필요합니다.';
const NEW_UPDATE='2026-09-12: 2025 기준 공식 스냅샷 11,724건을 확인했고 기존 170개 브랜드 카탈로그 중 149개는 공식 데이터와 식별자 매칭을 확인했습니다. 이후 공식 키·헤더·브랜드명·법인명 교차 검증을 통과한 136개를 공개 후보로 남겼습니다. 각 단계는 서로 다른 검수 게이트이므로 단계 밖 항목을 하나의 미매칭 사유로 단정하지 않습니다.';
const OLD_SOURCE_DESC='브랜드별 창업비용·가맹점 수·평균매출·점포 변동에 사용하는 공정위·공공데이터포털 등 1차 출처와 기준연도를 안내합니다.';
const NEW_SOURCE_DESC='공정위 공개데이터의 기준연도와 함께, 가맹본부 공식 페이지에서 직접 확인한 현재 개설비 근거 범위·확인일·원문 링크를 구분해 안내합니다.';
const BLOCK=`${START}<section class="v52-trust-gate" data-v52-trust-gate="1" aria-labelledby="v52-trust-gate-title"><div class="v52-trust-gate-head"><span>데이터 검수 단계</span><h2 id="v52-trust-gate-title">공개 데이터가 남는 과정</h2><p>카탈로그 수, 공식 데이터 식별자 매칭 수, 공개 후보 수는 같은 기준의 숫자가 아닙니다. 단계별 조건을 통과한 범위를 따로 표시합니다.</p></div><ol class="v52-trust-gate-grid"><li data-v52-trust-gate-item="catalog"><small>01 · 카탈로그 범위</small><strong>170개</strong><p>검수 시작점으로 사용하는 기존 브랜드 식별자 범위입니다.</p></li><li data-v52-trust-gate-item="matched"><small>02 · 공식 데이터 식별자 매칭</small><strong>149개</strong><p>공식 데이터에서 브랜드·법인 식별 관계를 확인한 범위입니다.</p></li><li data-v52-trust-gate-item="trusted"><small>03 · 공개 후보 신뢰 게이트</small><strong>136개</strong><p>공식 키·헤더·브랜드명·법인명 교차 검증을 통과해 현재 공개 후보로 남긴 범위입니다.</p></li></ol><p class="v52-trust-gate-note">단계 간 차이는 단일 실패 사유를 뜻하지 않습니다. 결측·식별·구조 검수 기준은 <a href="${BASE}/sources/">데이터 출처</a>와 <a href="${BASE}/updates/">변경 기록</a>을 함께 확인하고, 실제 계약 판단 전에는 <a href="${BASE}/disclaimer/">면책 고지</a>도 확인하세요.</p></section>${END}`;

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function requireRoot(root){if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');}
function replaceMarked(text,start,end,block,label){
  const a=text.indexOf(start),b=text.indexOf(end);
  if((a<0)!=(b<0))throw new Error(`Incomplete ${label} marker`);
  if(a<0)return null;
  if(b<a)throw new Error(`Reversed ${label} marker`);
  return text.slice(0,a)+block+text.slice(b+end.length);
}
function loadOperatorEvidence(){
  const data=JSON.parse(fs.readFileSync(path.join(here,'operator-opening-costs.json'),'utf8'));
  const brands=Object.entries(data.brands||{}).sort(([a],[b])=>a.localeCompare(b,'ko'));
  if(brands.length!==12)throw new Error(`Operator evidence release scope expected 12 brands, got ${brands.length}`);
  const generatedMs=Date.parse(`${data.generatedAt}T00:00:00Z`),dates=[];
  if(!Number.isFinite(generatedMs))throw new Error('Operator evidence generatedAt invalid');
  for(const [name,entry] of brands){
    const checked=Date.parse(`${entry.checkedOn}T00:00:00Z`),age=(generatedMs-checked)/86400000;
    if(!Number.isFinite(checked)||age<0||age>45)throw new Error(`Operator evidence freshness gate failed ${name}`);
    let source;try{source=new URL(entry.sourceUrl)}catch{}
    if(!source||source.protocol!=='https:')throw new Error(`Operator evidence source must be HTTPS ${name}`);
    if(!Array.isArray(entry.rows)||!entry.rows.length)throw new Error(`Operator evidence rows missing ${name}`);
    dates.push(entry.checkedOn);
  }
  dates.sort();
  return{data,brands,count:brands.length,oldest:dates[0],newest:dates.at(-1),freshnessDays:45};
}
function operatorBlock(evidence){
  const rows=evidence.brands.map(([name,entry])=>{
    const first=entry.rows[0];
    const shape=`${entry.rows.length}개 공개행 · ${first?.label||'공개 기준'}`;
    return `<tr data-v52-operator-brand="${esc(name)}"><th scope="row">${esc(name)}</th><td>${esc(entry.checkedOn)}</td><td>${esc(shape)}</td><td><a href="${esc(entry.sourceUrl)}" rel="external noopener">가맹본부 원문</a></td></tr>`;
  }).join('');
  return `${OP_START}<section class="v52-operator-evidence" data-v52-operator-evidence="1" aria-labelledby="v52-operator-evidence-title"><div class="v52-operator-head"><span>가맹본부 직접 확인</span><h2 id="v52-operator-evidence-title">현재 본사 개설비 직접 검증 범위</h2><p>공정위 공개 창업비용과 섞지 않고, 가맹본부 자체 공개 페이지에서 직접 재현할 수 있는 값만 별도 근거층으로 관리합니다. 확인할 수 없는 브랜드는 추정해서 채우지 않습니다.</p></div><div class="v52-operator-stats"><div><small>직접 검증 브랜드</small><strong>${evidence.count}개</strong></div><div><small>확인일 범위</small><strong>${esc(evidence.oldest)} ~ ${esc(evidence.newest)}</strong></div><div><small>신선도 게이트</small><strong>${evidence.freshnessDays}일 이내</strong></div></div><div class="v52-operator-table-wrap"><table class="data-table v52-operator-table" data-v52-operator-table="1"><thead><tr><th>브랜드</th><th>확인일</th><th>공식 페이지 공개 형태</th><th>원문</th></tr></thead><tbody>${rows}</tbody></table></div><p class="v52-operator-note">확인일은 해당 공식 페이지를 직접 검수한 날짜이며 정보 자체의 기준시점과 같다는 뜻은 아닙니다. 브랜드마다 면적·VAT·보증금·시설 범위가 달라 이 표의 금액을 같은 기준의 순위로 재가공하지 않습니다. 원문이 과거 정보공개서 기준, 기간 한정 프로모션, 내부 합계 불일치 등을 명시하는 경우 브랜드 상세의 <b>별도 확인 항목</b>에 그대로 남깁니다.</p></section>${OP_END}`;
}

export function applyTrustConsistency(root){
  requireRoot(root);
  const updatesFile=path.join(root,'updates/index.html');
  const methodologyFile=path.join(root,'methodology/index.html');
  const sourcesFile=path.join(root,'sources/index.html');
  let updates=fs.readFileSync(updatesFile,'utf8');
  let methodology=fs.readFileSync(methodologyFile,'utf8');
  let sources=fs.readFileSync(sourcesFile,'utf8');
  const originalUpdates=updates,originalMethodology=methodology,originalSources=sources;
  if(!updates.includes('<h1>데이터 변경 기록</h1>')||!methodology.includes('<h1>계산 기준</h1>')||!sources.includes('data-v47-source-funnel="1"'))throw new Error('Trust page shape mismatch');
  if(updates.includes(OLD_UPDATE))updates=updates.replace(OLD_UPDATE,NEW_UPDATE);
  else if(!updates.includes(NEW_UPDATE))throw new Error('Updates baseline sentence changed; refusing an unverified rewrite');
  if(updates.includes('0개는 미매칭'))throw new Error('Contradictory unmatched copy retained');
  const replaced=replaceMarked(methodology,START,END,BLOCK,'trust consistency');
  if(replaced!==null)methodology=replaced;
  else{
    const needle='</article></div></main>';
    if(!methodology.includes(needle))throw new Error('Methodology insertion point missing');
    methodology=methodology.replace(needle,BLOCK+needle);
  }
  const evidence=loadOperatorEvidence(),opBlock=operatorBlock(evidence);
  const opReplaced=replaceMarked(sources,OP_START,OP_END,opBlock,'operator evidence');
  if(opReplaced!==null)sources=opReplaced;
  else{
    const needle='</article></div></main>';
    if(!sources.includes(needle))throw new Error('Sources insertion point missing');
    sources=sources.replace(needle,opBlock+needle);
  }
  if(sources.includes(OLD_SOURCE_DESC))sources=sources.replace(OLD_SOURCE_DESC,NEW_SOURCE_DESC);
  else if(!sources.includes(NEW_SOURCE_DESC))throw new Error('Sources meta description baseline changed; refusing an unverified rewrite');
  const cssTag=`<link rel="stylesheet" href="${BASE}/assets/trust-consistency.css" data-v52-trust-consistency>`;
  if(!methodology.includes('/assets/trust-consistency.css'))methodology=methodology.replace('</head>',cssTag+'</head>');
  if(!sources.includes('/assets/trust-consistency.css'))sources=sources.replace('</head>',cssTag+'</head>');
  if(updates!==originalUpdates)fs.writeFileSync(updatesFile,updates);
  if(methodology!==originalMethodology)fs.writeFileSync(methodologyFile,methodology);
  if(sources!==originalSources)fs.writeFileSync(sourcesFile,sources);
  validateTrustConsistency(root);
  return{changed:updates!==originalUpdates||methodology!==originalMethodology||sources!==originalSources,operatorEvidenceBrands:evidence.count,operatorEvidenceOldest:evidence.oldest,operatorEvidenceNewest:evidence.newest,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,candidateSetChanged:false};
}

export function validateTrustConsistency(root){
  requireRoot(root);
  const updates=fs.readFileSync(path.join(root,'updates/index.html'),'utf8');
  const methodology=fs.readFileSync(path.join(root,'methodology/index.html'),'utf8');
  const sources=fs.readFileSync(path.join(root,'sources/index.html'),'utf8');
  const evidence=loadOperatorEvidence();
  if(updates.includes('0개는 미매칭')||updates.includes('0개는 명칭 중복 확인'))throw new Error('Unsupported zero-status copy remains in updates');
  if(!updates.includes(NEW_UPDATE))throw new Error('Corrected update record missing');
  if((methodology.match(/data-v52-trust-gate="1"/g)||[]).length!==1)throw new Error('Methodology trust gate missing or duplicated');
  if((methodology.match(/data-v52-trust-gate-item=/g)||[]).length!==3)throw new Error('Methodology trust gate item count mismatch');
  for(const html of [sources,updates,methodology])for(const value of ['170','149','136'])if(!html.includes(value))throw new Error(`Trust count ${value} missing from a trust page`);
  for(const href of ['/sources/','/updates/','/disclaimer/'])if(!methodology.includes(`href="${BASE}${href}"`))throw new Error(`Methodology trust link missing ${href}`);
  if((sources.match(/data-v52-operator-evidence="1"/g)||[]).length!==1)throw new Error('Sources operator evidence summary missing or duplicated');
  if((sources.match(/data-v52-operator-brand=/g)||[]).length!==evidence.count)throw new Error('Sources operator evidence row count mismatch');
  for(const [name,entry] of evidence.brands){
    if(!sources.includes(`data-v52-operator-brand="${esc(name)}"`))throw new Error(`Sources operator brand missing ${name}`);
    if(!sources.includes(`href="${esc(entry.sourceUrl)}"`))throw new Error(`Sources operator official link missing ${name}`);
    if(!sources.includes(entry.checkedOn))throw new Error(`Sources operator check date missing ${name}`);
  }
  for(const marker of [`>${evidence.count}개<`,evidence.oldest,evidence.newest,`${evidence.freshnessDays}일 이내`])if(!sources.includes(marker))throw new Error(`Sources operator evidence summary marker missing ${marker}`);
  if(!sources.includes(NEW_SOURCE_DESC))throw new Error('Sources meta description did not include operator evidence scope');
  if(!methodology.includes('/assets/trust-consistency.css')||!sources.includes('/assets/trust-consistency.css')||!fs.existsSync(path.join(root,'assets/trust-consistency.css')))throw new Error('Trust consistency CSS missing');
  for(const html of [sources,updates,methodology])if(!html.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))throw new Error('Preview noindex removed from trust page');
  if(!methodology.includes('<h1>계산 기준</h1>')||!updates.includes('<h1>데이터 변경 기록</h1>')||!sources.includes('<h1>데이터</h1>'))throw new Error('Trust page H1 changed unexpectedly');
  return{trustConsistency:true,catalog:170,officialMatched:149,publicCandidates:136,operatorEvidenceBrands:evidence.count,operatorEvidenceOldest:evidence.oldest,operatorEvidenceNewest:evidence.newest,operatorFreshnessGateDays:evidence.freshnessDays,unsupportedZeroStatus:false};
}
