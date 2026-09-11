import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='23.0.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};

const v22=json('data/v22-quote-lines-config.json',{});
const release21=json('data/release-url-set-v21.json',{});
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
if(v22.version!=='22.0.0'||!Array.isArray(v22.trades)||Object.keys(v22.references||{}).length<300)throw new Error('v23 requires v22 quote line config');
if(release21.total_count!==85)throw new Error('v23 requires unchanged v21 release set');

const aliases={
  item:['항목','항목명','공사항목','품명','내역','description','item','name'],
  trade:['공종','분류','category','trade'],
  unit:['단위','unit'],
  qty:['수량','면적','quantity','qty'],
  price:['단가','견적단가','내견적단가','unitprice','price'],
  total:['금액','합계','총액','amount','total']
};
const plainFormats=[
  '항목,공종,단위,수량,단가',
  '항목\t공종\t단위\t수량\t단가',
  '실크벽지 도배 ㎡ 42.5 50000'
];
const importConfig={
  version:VERSION,reviewed_on:reviewed,max_rows:Number(v22.rules?.max_lines||12),
  accepted:['paste-text','csv','tsv','txt-file','csv-file'],
  header_aliases:aliases,
  unit_aliases:{'㎡':'㎡','m2':'㎡','M2':'㎡','m²':'㎡','M²':'㎡','m^2':'㎡','M^2':'㎡','m':'M','M':'M'},
  rules:{client_side_only:true,upload_to_server:false,auto_select_official_reference:false,auto_confirm_scope:false,pyeong_context_only:true,derive_unit_price_from_total_when_qty_present:true,rows_over_limit_truncated:true,empty_rows_ignored:true},
  examples:plainFormats
};
write('data/v23-quote-import-config.json',JSON.stringify(importConfig,null,2));

const css22=read('assets/site-v22-bundle.css'),js22=read('assets/app-v22-bundle.js');
const css23=fs.readFileSync(path.join(CORE,'site-v23.css'),'utf8'),js23=fs.readFileSync(path.join(CORE,'app-v23.js'),'utf8');
const hash=crypto.createHash('sha1').update(css22+'\n'+css23+'\n'+js22+'\n'+js23).digest('hex').slice(0,12);
write('assets/site-v23-bundle.css',css22+'\n/* v23 quote import */\n'+css23);
write('assets/app-v23-bundle.js',js22+'\n/* v23 quote import */\n'+js23);
const cssRef=`<link rel="stylesheet" href="${BASE}/assets/site-v23-bundle.css?v=${hash}">`;
const jsRef=`<script src="${BASE}/assets/app-v23-bundle.js?v=${hash}" defer></script>`;

const pagePath='compare/quote-lines/index.html';
let page=read(pagePath);
page=page.replace(/<link rel="stylesheet" href="[^"]*site-v22-bundle\.css[^"]*">/,cssRef).replace(/<script src="[^"]*app-v22-bundle\.js[^"]*" defer><\/script>/,jsRef);
const importer=`<section class="v23-import" data-v23-import><div class="v23-import__head"><div><p class="kicker">PASTE · CSV · TSV</p><h2>견적서 붙여넣기</h2></div><p>브라우저 안에서만 분석 · 서버 전송 없음</p></div><label for="v23-import-text">견적서 텍스트 또는 CSV</label><textarea id="v23-import-text" data-v23-import-text rows="8" placeholder="항목,공종,단위,수량,단가&#10;실크벽지,도배,㎡,10,50000&#10;석고보드 목공,목공,㎡,5,30000"></textarea><div class="v23-import-actions"><label class="v23-file"><span>CSV/TXT 파일</span><input data-v23-import-file type="file" accept=".csv,.txt,text/csv,text/plain"></label><button type="button" data-v23-parse>분석</button><button type="button" data-v23-apply disabled>비교표에 채우기</button><button type="button" data-v23-clear>지우기</button></div><div class="v23-import-status" data-v23-status>헤더가 있으면 자동 인식하고, 없으면 항목·공종·단위·수량·단가 순서를 우선 해석합니다.</div><div class="v23-import-preview" data-v23-preview hidden></div><details class="v23-format"><summary>지원 형식</summary><p>CSV·탭 구분·일반 텍스트를 지원합니다. 총액만 있고 수량이 있으면 단가를 총액÷수량으로 산술 계산합니다. 공종은 항목명 키워드로 보조 추론하지만 공식 참고항목은 자동 선택하지 않습니다.</p><code>항목,공종,단위,수량,단가</code></details></section>`;
if(!page.includes('data-v23-import'))page=page.replace('<div class="v22-lines" data-v22-lines>',importer+'<div class="v22-lines" data-v22-lines>');
write(pagePath,page);

const audit={version:VERSION,reviewed_on:reviewed,page:pagePath,max_rows:importConfig.max_rows,accepted:importConfig.accepted,checks:{page_injected:page.includes('data-v23-import'),v23_css:page.includes('site-v23-bundle.css'),v23_js:page.includes('app-v23-bundle.js'),preview_noindex:page.includes('noindex,nofollow'),release_set_unchanged:release21.total_count===85,client_side_only:importConfig.rules.client_side_only,server_upload_off:importConfig.rules.upload_to_server===false,no_auto_reference:importConfig.rules.auto_select_official_reference===false,no_auto_confirmation:importConfig.rules.auto_confirm_scope===false,pyeong_context_only:importConfig.rules.pyeong_context_only===true},production_switch:false,search_console_submission:false,ads_injected:false,bundle_hash:hash};
write('data/v23-quote-import-audit.json',JSON.stringify(audit,null,2));
write('data/v23-browser-contract.json',JSON.stringify({version:VERSION,routes:[pagePath],required_ready:'v23Ready',csv_rows:2,expected_user_sum:650000,max_rows:importConfig.max_rows},null,2));
write('data/v23-report.json',JSON.stringify({version:VERSION,page:pagePath,release_v21_count:release21.total_count,audit},null,2));
if(Object.values(audit.checks).some(v=>v!==true))throw new Error(`v23 quote import gate failed ${JSON.stringify(audit.checks)}`);
console.log(JSON.stringify({version:VERSION,page:pagePath,max_rows:importConfig.max_rows,checks:audit.checks},null,2));
