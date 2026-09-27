import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=new URL('../',import.meta.url);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function compactRecall(html,notice){
 if(html.includes('class="recall-details"'))return html;
 const names=[...new Set(notice.production.map(p=>p.model))];
 const scope=names.slice(0,2).join(', ')+(names.length>2?` 외 ${names.length-2}개 차종`:'');
 html=html.replace(/<p class="decision-intro">[\s\S]*?<\/p>/,`<p class="decision-intro">대상: ${escape(scope)}</p>`);
 const facts=html.match(/<section class="recall-facts">[\s\S]*?<\/section>/)?.[0];
 if(!facts)throw Error('Missing recall facts: '+notice.id);
 html=html.replace(facts,`<section class="recall-facts"><dl><dt>시정 시작일</dt><dd>${escape(notice.recall_start)}</dd></dl></section>`);
 const content=html.match(/<section><h2>대상 차종과 생산기간<\/h2>[\s\S]*?(?=<section><h2>공식 원문<\/h2>)/)?.[0];
 if(!content)throw Error('Missing recall detail: '+notice.id);
 return html.replace(content,`<details class="recall-details"><summary>상세 내용 · 대상 차량과 수리 방법</summary>${content}<section><h2>자료 기준</h2>${facts}</section></details>`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const notices=JSON.parse(fs.readFileSync(new URL('data/recalls.json',root),'utf8')).notices;
 for(const n of notices){const f=new URL('recalls/'+n.slug+'/index.html',root);fs.writeFileSync(f,compactRecall(fs.readFileSync(f,'utf8'),n));}
 console.log(`Compacted ${notices.length} recall details; original data retained`);
}
