import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve('docs/interior-cost-preview');
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>fs.writeFileSync(path.join(ROOT,r),c);
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const refs=json('data/g2b-calculator-reference-v20.json',{}),ev=json('data/g2b-evidence-index-v20.json',{});
const evidenceByRef=Object.fromEntries((ev.evidence||[]).map(e=>[e.ref_id,{evidence_id:e.evidence_id,operation:e.operation,dataset_id:e.dataset_id,official_dataset_url:e.official_dataset_url,source_page:e.source_page}]));
const embedded=JSON.stringify({version:'20.11.0',rows:refs.rows||{},references:refs.references||[],evidence_by_ref:evidenceByRef}).replace(/</g,'\\u003c');
const launch=`<section class="v20-review-launch" data-v20-review-launch><h2>검수 결과 묶기</h2><p>현재 입력값과 직접 선택한 공식 참고 근거를 같은 탭의 임시 검수 패킷으로 묶습니다. 수량·단위·사양을 추정하지 않고 가격 적정성 판정도 만들지 않습니다.</p><button type="button" data-v20-review-open>검수 리포트 만들기</button><small>sessionStorage로 한 번 전달한 뒤 리포트에서 즉시 삭제 · 서버 전송 없음 · 영구 저장 없음</small><script type="application/json" data-v20-review-data>${embedded}</script></section>`;
let repaired=0;
for(const rel of ['quote-check/index.html','quote-compare/index.html']){
  let h=read(rel);
  if(!h.includes('<section class="v20-review-launch" data-v20-review-launch>')){h=h.replace('</main>',launch+'</main>');repaired++;}
  write(rel,h);
}
{
  const rel='quote-review-report/index.html';let h=read(rel);
  if(!h.includes('data-v20-review-hidden-fix'))h=h.replace('</head>','<style data-v20-review-hidden-fix>.v20-rp-actions[hidden]{display:none!important}</style></head>');
  write(rel,h);
}
const audit=json('data/g2b-review-packet-audit-v20.json',{});audit.launcher_repaired_count=repaired;audit.launcher_actual_count=['quote-check/index.html','quote-compare/index.html'].filter(p=>read(p).includes('<section class="v20-review-launch" data-v20-review-launch>')).length;audit.hidden_actions_fix=true;fs.writeFileSync(path.join(ROOT,'data','g2b-review-packet-audit-v20.json'),JSON.stringify(audit,null,2));
console.log(`v20 review packet batch7 fix: launcher repaired ${repaired} / actual ${audit.launcher_actual_count}`);
