import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('interior-cost-core/v6-review');
const errors=[];
const pages={
  checklist:['인테리어 계약 체크리스트','data-contract-checklist','data-check-id','checklist-v6.js'],
  glossary:['인테리어 견적 용어','1식','양중','현장관리비','VAT'],
  standards:['12항목 견적 분해 기준','철거','폐기물','방수','현장관리비','VAT'],
  'data-method':['숫자 표시와 출처 원칙','OFFICIAL','REFERENCE','CALCULATED','QUOTE','80건'],
  changelog:['데이터·계산식 변경이력','견적 검사','모바일','가이드','통계'],
  about:['견적검수실','업체를 추천하거나 연결하지 않습니다','출처 없는 ‘전국 평균’'],
  contact:['오류·정정 요청','GitHub Issues','업체 추천, 견적 의뢰, 공사 중개'],
  privacy:['개인정보처리방침','localStorage','Google AdSense','서버로 견적 내용을 업로드'],
  terms:['서비스 이용 기준','정보형 도구','업체 연결·시공계약 체결·결제 중개'],
  disclaimer:['참고용 정보와 도구','시장 평균','법률','사용자 입력']
};
for(const [slug,tokens] of Object.entries(pages)){
 const file=path.join(root,slug,'index.html');if(!fs.existsSync(file)){errors.push(`missing:${slug}`);continue}
 const html=fs.readFileSync(file,'utf8');if(!html.includes('noindex,nofollow'))errors.push(`noindex:${slug}`);if((html.match(/<h1\b/g)||[]).length!==1)errors.push(`h1:${slug}`);for(const t of tokens)if(!html.includes(t))errors.push(`${slug}:${t}`);if(!html.includes('reference-v6.css'))errors.push(`reference-style:${slug}`)
}
for(const f of ['assets/reference-v6.css','assets/checklist-v6.js'])if(!fs.existsSync(path.join(root,f)))errors.push(`missing:${f}`);
const checklist=fs.readFileSync(path.join(root,'assets/checklist-v6.js'),'utf8');for(const t of ['interior-v6-contract-checklist','localStorage','data-check-progress','data-check-reset','window.print'])if(!checklist.includes(t))errors.push(`checklist-js:${t}`);
const search=fs.readFileSync(path.join(root,'assets/search-v6.js'),'utf8');for(const t of ['checklist/','standards/','glossary/','data-method/','changelog/','privacy/','terms/','disclaimer/','about/','contact/','data-trust-links'])if(!search.includes(t))errors.push(`completeness-search:${t}`);
const contact=fs.readFileSync(path.join(root,'contact/index.html'),'utf8');if(!contact.includes('https://github.com/5ggul/pm-lab/issues/new'))errors.push('contact-route');
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,pages:Object.keys(pages),checklist_items:12,contact:'github-issues',quote_input_storage:'localStorage',production_index:false},null,2));
