import fs from 'node:fs';
import path from 'node:path';

const START='<!-- v11.52 publisher value: start -->';
const END='<!-- v11.52 publisher value: end -->';
function requireRoot(root){if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');}
function replaceMarked(text,block){
  const a=text.indexOf(START),b=text.indexOf(END);
  if((a<0)!=(b<0))throw new Error('Incomplete publisher value marker');
  if(a<0)return null;
  if(b<a)throw new Error('Reversed publisher value marker');
  return text.slice(0,a)+block+text.slice(b+END.length);
}
const block=START+'<section class="block v52-publisher-value" data-v52-publisher-value="1" aria-labelledby="v52-publisher-value-title"><h2 id="v52-publisher-value-title">원천 공개데이터에 더하는 것</h2><p>이 사이트는 공공데이터 레코드를 그대로 나열하는 데서 끝내지 않습니다. 서로 다른 공개값을 같은 기준으로 정규화하고, 결측값을 0으로 바꾸지 않은 상태에서 사용자가 실제 비교와 자금 검토에 쓸 수 있는 파생 지표와 도구를 만듭니다.</p><div class="check-grid"><div class="check-item"><strong>식별·정규화</strong><span>브랜드명·법인명·공식 식별 관계를 교차 확인하고 천원·만원, 기준연도, 면적 기준을 같은 화면에서 구분합니다.</span></div><div class="check-item"><strong>업종 분포 계산</strong><span>유효한 공식 공개값만으로 P25·중앙값·P75와 업종 내 위치를 계산합니다. 단순 평균 한 줄로 브랜드를 평가하지 않습니다.</span></div><div class="check-item"><strong>점포 변화 해석</strong><span>연속 공개 기준년도의 가맹점·신규·종료·해지를 분리하고, 변화율이나 점포 수 증가를 수익성 점수로 바꾸지 않습니다.</span></div><div class="check-item"><strong>공개비용과 실제 준비자금 분리</strong><span>공정위 공개비용, 가맹본부 현재 개설비, 임대·권리금·별도공사·운전자금을 섞지 않고 계산기에서 따로 합산합니다.</span></div><div class="check-item"><strong>비교·시뮬레이션</strong><span>브랜드 비교, 업종 중앙값, 손익분기, 월 고정비, 점포 밀도 등 원천 API에 없는 의사결정 도구를 제공합니다.</span></div><div class="check-item"><strong>저장 후 변화 확인</strong><span>관심 브랜드를 브라우저에 저장해 다음 데이터 갱신 때 저장 당시 공개값과 현재 공개값의 차이를 다시 확인할 수 있습니다.</span></div></div><h2>페이지가 만들어지고 검수되는 방식</h2><p>브랜드·업종 페이지는 검증된 데이터 스냅샷을 기반으로 자동 생성됩니다. 자동화는 같은 계산식을 일관되게 적용하기 위한 용도이며, 출처에서 확인되지 않은 숫자나 후기를 만들어 채우지 않습니다. 신뢰 게이트를 통과하지 못한 레코드는 공개 후보에서 제외하고, 생성 후에는 링크·단일 H1·모바일 레이아웃·비교/계산기 상호작용을 브라우저 회귀검사로 다시 확인합니다.</p><p>브랜드별 해석 문장은 해당 브랜드의 비용 구성, 업종 중앙값과의 차이, 점포 이력처럼 실제 공개값에서 계산 가능한 신호만 사용합니다. 이 해석은 추천·수익 보장·투자 등급이 아니며, 계약 전에는 최신 정보공개서와 가맹본부 견적을 다시 확인해야 합니다.</p></section>'+END;

export function applyPublisherValue(root){
  requireRoot(root);
  const file=path.join(root,'methodology/index.html');
  let html=fs.readFileSync(file,'utf8'),before=html;
  const replaced=replaceMarked(html,block);
  if(replaced!==null)html=replaced;
  else{
    const needle='</article>';
    if(!html.includes(needle))throw new Error('Methodology article insertion point missing');
    html=html.replace(needle,block+needle);
  }
  if(html!==before)fs.writeFileSync(file,html);
  validatePublisherValue(root);
  return{changed:html!==before,publisherValue:true,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,candidateSetChanged:false};
}
export function validatePublisherValue(root){
  requireRoot(root);
  const html=fs.readFileSync(path.join(root,'methodology/index.html'),'utf8');
  if((html.match(/data-v52-publisher-value="1"/g)||[]).length!==1)throw new Error('Publisher value section missing or duplicated');
  for(const token of ['원천 공개데이터에 더하는 것','업종 분포 계산','공개비용과 실제 준비자금 분리','저장 후 변화 확인','페이지가 만들어지고 검수되는 방식','출처에서 확인되지 않은 숫자나 후기를 만들어 채우지 않습니다'])if(!html.includes(token))throw new Error('Publisher value copy missing '+token);
  if((html.match(/class="check-item"/g)||[]).length<6)throw new Error('Publisher value check items missing');
  return{publisherValue:true,valueItems:6,automationDisclosure:true,originalAnalysisDisclosure:true};
}
