import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve('docs/interior-cost-preview');const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const text=h=>h.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const checks={},fail=[];const ok=(n,v)=>{checks[n]=!!v;if(!v)fail.push(n)};
const home=read('index.html');ok('home_only_service_catalog',home.includes('v28-home')&&!home.includes('<section class="v6-section">'));ok('home_no_marketing_phrase',!text(home).includes('받은 인테리어 견적서, 빠진 비용부터 확인하세요'));
for(const p of ['interior-cost/index.html','cost/index.html','data/index.html','guides/index.html']){const h=read(p);ok(`${p}_hub_grid`,h.includes('v28-hub-grid'));ok(`${p}_no_direct_answer`,!h.includes('class="direct-answer"'));ok(`${p}_simple_footer`,h.includes('v28-simple-footer'));}
const data=read('data/index.html');ok('data_no_snapshot_table',!text(data).includes('현재 스냅샷'));ok('data_public_categories',/건설공사비지수/.test(text(data))&&/조달청/.test(text(data))&&/출처/.test(text(data)));
const p32=read('interior-cost/32-pyeong/index.html');ok('p32_literal_h1',/<h1>32평 인테리어 비용<\/h1>/.test(p32));ok('p32_literal_sections',/32평 주요 조건/.test(text(p32))&&/공통 확인 항목/.test(text(p32)));
const bath=read('cost/bathroom/index.html');ok('trade_literal_sections',/견적 항목/.test(text(bath))&&/비교 조건/.test(text(bath))&&/데이터 기준/.test(text(bath)));
const report={version:'28.1.0',checks,failures:fail};fs.writeFileSync(path.join(ROOT,'data/v28-refine-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(fail.length)throw new Error(fail.join(' | '));
