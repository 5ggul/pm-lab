import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve('docs/interior-cost-preview');
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const j=r=>JSON.parse(read(r));
const health=j('data/g2b-source-health-v20.json');
const audit=j('data/g2b-source-health-audit-v20.json');
if(health.version!=='20.9.0'||audit.version!=='20.9.0')throw new Error('source health stripfix version mismatch');
const statusText=health.stale_fallback_count?`${health.stale_fallback_count}개 원천은 최근 정상 스냅샷 사용`:'3개 원천 모두 이번 갱신 정상 수집';
const style='<style data-v20-source-health-strip-style>.v20-sh-strip{margin:20px 0;padding:12px 0;border-top:1px solid #d7dde3;border-bottom:1px solid #d7dde3;display:flex;justify-content:space-between;gap:16px;align-items:center}.v20-sh-strip span{font-size:12px;color:#5c6875}.v20-sh-strip a{font-size:12px;font-weight:800;text-decoration:underline;text-underline-offset:3px}@media(max-width:760px){.v20-sh-strip{align-items:flex-start;flex-direction:column}}</style>';
const strip=`<div class="site-shell"><aside class="v20-sh-strip" data-v20-source-health-strip><span>${statusText} · 공식 원천 3개 · 근거 ${Number(health.evidence_count||0).toLocaleString('ko-KR')}개</span><a href="/pm-lab/interior-cost-preview/data/g2b-source-health/">공식 데이터 수집 상태</a></aside></div>`;
let actual=0;
for(const rel of audit.strip_targets||[]){let h=read(rel);if(!h.includes('data-v20-source-health-strip-style'))h=h.replace('</head>',style+'</head>');if(!h.includes('<aside class="v20-sh-strip" data-v20-source-health-strip>'))h=h.replace('</main>',strip+'</main>');write(rel,h);if(h.includes('<aside class="v20-sh-strip" data-v20-source-health-strip>'))actual++}
audit.strip_injected_count=actual;audit.stripfix=true;write('data/g2b-source-health-audit-v20.json',JSON.stringify(audit,null,2));
console.log(`v20 source health stripfix: repaired ${audit.strip_targets?.length||0}, actual ${actual}`);
