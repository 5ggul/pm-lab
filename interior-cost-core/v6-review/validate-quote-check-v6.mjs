import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('interior-cost-core/v6-review');
const errors=[];
const need=['quote-check/index.html','assets/quote-check-v6.css','assets/quote-check-v6.js','assets/search-v6.js','index.html','guides/index.html'];
for(const f of need)if(!fs.existsSync(path.join(root,f)))errors.push(`missing:${f}`);
const html=fs.readFileSync(path.join(root,'quote-check/index.html'),'utf8');
for(const t of ['noindex,nofollow','인테리어 견적서 검사','data-quote-checker','data-qc-rows','data-qc-status','data-qc-coverage','data-qc-normalized','data-qc-questions','업체 질문 복사','견적서 표시 총액','표준 12항목','quote-check-v6.css','quote-check-v6.js'])if(!html.includes(t))errors.push(`checker-html:${t}`);
if((html.match(/<h1\b/g)||[]).length!==1)errors.push('checker-h1');
for(const t of ['철거','폐기물','방수','욕실','주방','도배','바닥','목공','전기','창호','현장관리비','VAT'])if(!html.includes(t))errors.push(`checker-item-copy:${t}`);
const js=fs.readFileSync(path.join(root,'assets/quote-check-v6.js'),'utf8');
for(const t of ['qcItems','qcRequired','qcEvaluate','interior-v6-quote-check','data-qc-state','data-qc-amount','data-qc-notation','data-qc-note','비교 가능','조건 부족','비교 불가','separateUnknown','criticalMissing','qcPriorities','qcNextAction','qcEnsureActionPanel','data-qc-action-panel','data-qc-priority-list','data-qc-next-action','data-qc-next-link','guides/vat/','guides/waste-separate/','guides/management-fee/','guides/window-included-excluded/','work-match/','checklist/','quote-compare/','navigator.share','navigator.clipboard','window.print','data-qc-copy-questions'])if(!js.includes(t))errors.push(`checker-js:${t}`);
if(/\bexport\s+(?:function|const|let|class)\b/.test(js))errors.push('checker-classic-script-export');
const prioritiesBlock=(js.match(/function qcPriorities\(r\)\{([\s\S]*?)return out\.slice\(0,4\)\}/)||[])[1]||'';const priorityOrder=['criticalMissing','separateUnknown','r.spec','ordinary'];let last=-1;for(const token of priorityOrder){const at=prioritiesBlock.indexOf(token);if(at<0||at<last)errors.push(`priority-order:${token}`);last=at}
const itemIds=['demolition','waste','waterproof','bathroom','kitchen','wallpaper','flooring','carpentry','electrical','windows','management','vat'];
for(const id of itemIds)if(!js.includes(`id:'${id}'`))errors.push(`checker-item:${id}`);
if(js.includes('KOSIS_API_KEY')||js.includes('apiKey='))errors.push('checker-client-api-key');
const css=fs.readFileSync(path.join(root,'assets/quote-check-v6.css'),'utf8');
for(const t of ['.checker-grid','.condition-sheet','.check-row','.status-stamp','.question-list','.qc-action-panel','.qc-priority-block','.qc-next-action','@media print','position:sticky'])if(!css.includes(t))errors.push(`checker-css:${t}`);
if(/@keyframes|animation\s*:|transition\s*:/i.test(css))errors.push('checker-animation');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const t of ['quote-check/','견적 검사'])if(!home.includes(t))errors.push(`home-checker-funnel:${t}`);
const guides=fs.readFileSync(path.join(root,'guides/index.html'),'utf8');
for(const t of ['../quote-check/','견적서 검사','읽고 바로 검사'])if(!guides.includes(t))errors.push(`guide-checker-funnel:${t}`);
const search=fs.readFileSync(path.join(root,'assets/search-v6.js'),'utf8');
for(const t of ["['견적서 검사','quote-check/']","['견적 검사','quote-check/']","['누락','quote-check/']","['견적서','quote-check/']"])if(!search.includes(t))errors.push(`search-checker:${t}`);
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,standard_items:itemIds.length,states:['기재','별도','미기재'],verdicts:['비교 가능','조건 부족','비교 불가'],priority_order:['핵심 누락','별도금액','1식·사양','일반 누락','비교'],next_actions:['가이드','공종 매칭','체크리스트','A/B/C 비교'],checklist_auto_complete:false,storage:'localStorage',server_upload:false,funnel:['home','guides','search']},null,2));