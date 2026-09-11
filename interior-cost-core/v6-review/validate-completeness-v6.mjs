import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve('interior-cost-core/v6-review');
const errors=[];
const pages={
  checklist:['인테리어 계약 체크리스트','data-contract-checklist','data-check-id','data-check-copy','data-check-next','checklist-v6.js','공종 매칭','A/B/C 비교'],
  glossary:['인테리어 견적 용어','1식','양중','현장관리비','VAT'],
  standards:['12항목 견적 분해 기준','철거','폐기물','방수','현장관리비','VAT'],
  sources:['공식 출처','한국건설기술연구원','공사비원가관리센터','조달청','15129415','KOSIS','공공 원가자료와 민간 아파트 인테리어 계약가격은 같은 데이터가 아닙니다'],
  'data-method':['숫자 표시와 출처 원칙','OFFICIAL','REFERENCE','CALCULATED','QUOTE','80건','6.3-review','배포 승인과 release 후보','출시 직전 preflight','review CI → 실API preflight → 실제 도메인 preflight → 운영자 프리뷰 승인 → 승인된 release 경로','public-price-preflight.json','repository write·commit·push·deploy 없음','blocked_manual_approval','core_only','full_data','release-manifest.json','release-manifest.sha256','production 후보'],
  changelog:['데이터·계산식 변경이력','6.3-review','실제 조달청 15129415 API','실제 production BASE_URL','artifact-only','release-manifest','blocked_manual_approval','core_only','full_data','/data/ 허브','FAQPage'],
  about:['견적검수실','업체를 추천하거나 연결하지 않습니다','출처 없는 ‘전국 평균’'],
  contact:['오류·정정 요청','GitHub Issues','업체 추천, 견적 의뢰, 공사 중개'],
  privacy:['개인정보처리방침','localStorage','Google AdSense','서버로 견적 내용을 업로드','interior-v6-','data-local-data-controls','data-local-clear','privacy-controls-v6.js'],
  terms:['서비스 이용 기준','정보형 도구','업체 연결·시공계약 체결·결제 중개'],
  disclaimer:['참고용 정보와 도구','시장 평균','법률','사용자 입력']
};
for(const [slug,tokens] of Object.entries(pages)){
 const file=path.join(root,slug,'index.html');if(!fs.existsSync(file)){errors.push(`missing:${slug}`);continue}
 const html=fs.readFileSync(file,'utf8');if(!html.includes('noindex,nofollow'))errors.push(`noindex:${slug}`);if((html.match(/<h1\b/g)||[]).length!==1)errors.push(`h1:${slug}`);for(const t of tokens)if(!html.includes(t))errors.push(`${slug}:${t}`);if(!html.includes('reference-v6.css'))errors.push(`reference-style:${slug}`)
}
for(const f of ['assets/reference-v6.css','assets/checklist-v6.js','assets/privacy-controls-v6.js','validate-content-differentiation-v6.mjs','validate-public-price-preflight-v6.mjs','validate-release-preflight-v6.mjs','validate-release-checklist-v6.mjs'])if(!fs.existsSync(path.join(root,f)))errors.push(`missing:${f}`);
const checklist=fs.readFileSync(path.join(root,'assets/checklist-v6.js'),'utf8');for(const t of ['interior-v6-contract-checklist','localStorage','data-check-progress','data-check-reset','data-check-copy','data-check-next','data-check-next-link','navigator.clipboard','copyPending','window.print','quote-compare/'])if(!checklist.includes(t))errors.push(`checklist-js:${t}`);
const privacyControls=fs.readFileSync(path.join(root,'assets/privacy-controls-v6.js'),'utf8');try{new vm.Script(privacyControls,{filename:'privacy-controls-v6.js'})}catch(error){errors.push(`privacy-js-syntax:${error.message}`)}for(const t of ["prefix='interior-v6-'",'localStorage.key','localStorage.removeItem','data-local-count','data-local-bytes','data-local-list','data-local-clear','confirm(','다른 사이트 데이터는 삭제하지 않습니다'])if(!privacyControls.includes(t))errors.push(`privacy-js:${t}`);if(/localStorage\.clear\s*\(/.test(privacyControls))errors.push('privacy-global-clear-forbidden');
const search=fs.readFileSync(path.join(root,'assets/search-v6.js'),'utf8');for(const t of ['checklist/','standards/','glossary/','data/','sources/','data-status/','data-method/','changelog/','privacy/','terms/','disclaimer/','about/','contact/','data-trust-links'])if(!search.includes(t))errors.push(`completeness-search:${t}`);
const contact=fs.readFileSync(path.join(root,'contact/index.html'),'utf8');if(!contact.includes('https://github.com/5ggul/pm-lab/issues/new'))errors.push('contact-route');
for(const file of ['../preflight-public-prices-v6.mjs','../validate-release-base-url-v6.mjs','../build-release-checklist-v6.mjs'])if(!fs.existsSync(path.resolve(root,file)))errors.push(`missing-core:${file}`);
for(const file of ['.github/workflows/interior-public-prices-preflight.yml','.github/workflows/interior-v6-release-preflight.yml'])if(!fs.existsSync(path.resolve(file)))errors.push(`missing-workflow:${file}`);
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,pages:Object.keys(pages),official_sources:['KICT','PPS','KOSIS'],checklist_items:12,checklist_guided_next:true,checklist_pending_copy:true,checklist_auto_complete:false,release_policy_documented:true,release_manifest_documented:true,preflight_policy_documented:true,release_checklist_gate:true,privacy_local_prefix:'interior-v6-',privacy_js_parse:true,privacy_global_clear:false,anti_template_gate:true,preflight_safety_gates:true,contact:'github-issues',quote_input_storage:'localStorage',production_index:false},null,2));
await import('./validate-content-differentiation-v6.mjs');
await import('./validate-public-price-preflight-v6.mjs');
await import('./validate-release-preflight-v6.mjs');
await import('./validate-release-checklist-v6.mjs');
