import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const targets={
  '404.html':'요청한 페이지를 찾을 수 없습니다. 주소를 다시 확인하거나 견적 검사·공식 참고단가 비교·예산 계산·가이드에서 필요한 정보를 찾아보세요.',
  'disclaimer/index.html':'견적·계약·세무·하자 관련 정보가 제공하는 참고 범위와 한계를 설명하고, 실제 의사결정 전에 별도 확인이 필요한 항목을 안내합니다.',
  'search/index.html':'평수·공종·견적 항목·도구·가이드를 검색해 견적 검사, 공식 참고단가 비교, 예산 계산에 필요한 페이지를 빠르게 찾습니다.',
  'terms/index.html':'견적 검사·비교·예산 설계 결과의 이용 범위와 제한, 사용자 책임, 서비스 사용 시 확인해야 할 기본 조건을 설명합니다.'
};
for(const [rel,description] of Object.entries(targets)){
  const file=path.join(ROOT,rel);
  let html=fs.readFileSync(file,'utf8');
  const re=/<meta\s+name=["']description["']\s+content=["'][^"']*["'][^>]*>/i;
  if(!re.test(html))throw new Error(`v25 meta description missing: ${rel}`);
  html=html.replace(re,`<meta name="description" content="${description}">`);
  fs.writeFileSync(file,html);
}
console.log(JSON.stringify({version:'25.0.0',meta_descriptions_polished:Object.keys(targets),lengths:Object.fromEntries(Object.entries(targets).map(([k,v])=>[k,v.length]))},null,2));
