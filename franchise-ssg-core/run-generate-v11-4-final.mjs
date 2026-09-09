import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const homePath=path.join(out,'index.html');
const brandsPath=path.join(out,'brands/index.html');
const cssPath=path.join(out,'assets/site.css');

async function replaceRequired(file,replacements){
  let text=await fs.readFile(file,'utf8');
  for(const [from,to,label] of replacements){
    if(!text.includes(from))throw new Error(`${label||from}: source text not found`);
    text=text.replace(from,to);
  }
  await fs.writeFile(file,text,'utf8');
}

await replaceRequired(homePath,[
  ['<title>프랜차이즈 창업비용·가맹점 데이터 비교 | 창업데이터랩</title>','<title>프랜차이즈 창업비용 비교 | 브랜드·가맹점·평균매출</title>','home title'],
  ['<meta name="description" content="공정거래위원회 공개자료를 같은 단위로 정리해 브랜드 창업비용, 가맹점 변화, 업종 중앙값을 비교하고 내 점포 조건으로 계산합니다.">','<meta name="description" content="170개 프랜차이즈 브랜드의 창업비용, 가맹점 수, 가맹점 증감, 평균매출을 확인하고 창업비용을 계산할 수 있습니다.">','home description'],
  ['<h1>프랜차이즈 창업,<br>숫자로 먼저 비교하세요</h1>','<h1>프랜차이즈 창업비용 비교</h1>','home h1'],
  ['<p>브랜드별 창업비용, 가맹점 변화, 업종 중앙값과 공개 매출지표를 같은 기준으로 비교하고 내 점포 조건을 계산합니다.</p>','<p>브랜드별 창업비용, 가맹점 수, 가맹점 증감, 평균매출을 확인하고 비용을 계산할 수 있습니다.</p>','home lead'],
  ['>브랜드 탐색</span>','>브랜드</span>','home metric brand'],
  ['>업종 비교</span>','>업종</span>','home metric category'],
  ['>핵심 계산기</span>','>계산기</span>','home metric tools'],
  ['<h2>대표 브랜드 데이터</h2>','<h2>브랜드 창업비용</h2>','home section brands'],
  ['<th class="num">공개 창업비용</th>','<th class="num">창업비용</th>','home cost header'],
  ['<th class="num">가맹점</th>','<th class="num">가맹점 수</th>','home stores header'],
  ['<th class="num">이전 기준 증감</th>','<th class="num">가맹점 증감</th>','home growth header'],
  ['<h2>업종별 공개 창업비용 중앙값</h2>','<h2>업종별 창업비용 중앙값</h2>','home category section'],
  ['>업종 데이터 보기</a>','>업종별 보기</a>','home category link'],
  ['<h2>바로 쓰는 도구</h2>','<h2>계산기</h2>','home tools section'],
  ['<h2>데이터 리포트</h2>','<h2>창업비용 자료</h2>','home report section'],
  ['>두 브랜드 비교</a>','>브랜드 비교</a>','home quick compare'],
  ['>창업비용 계산</a>','>창업비용 계산기</a>','home quick calculator']
]);

await replaceRequired(brandsPath,[
  ['<meta name="description" content="170개 프랜차이즈 브랜드를 업종, 공개 창업비용, 가맹점 수, 이전 기준 점포 변화로 찾습니다. 미매칭 값은 0으로 채우지 않습니다.">','<meta name="description" content="170개 프랜차이즈 브랜드를 업종, 창업비용, 가맹점 수, 가맹점 증감으로 검색하고 정렬할 수 있습니다.">','directory description'],
  ['<div class="page-head"><h1>프랜차이즈 브랜드 찾기</h1><p>공식 레코드가 확인된 브랜드만 숫자를 표시합니다. 검색·필터 결과 URL은 정식 공개 시 색인하지 않습니다.</p></div>','<div class="page-head"><h1>프랜차이즈 브랜드 찾기</h1><p>브랜드명, 업종, 창업비용, 가맹점 수, 가맹점 증감으로 검색하고 정렬할 수 있습니다.</p></div>','directory lead'],
  ['>최대 공개비용<select','>최대 창업비용<select','directory cost filter'],
  ['<span>공식 매칭 146 · 미매칭 23 · 확인 필요 1</span>','<span>창업비용 · 가맹점 수 · 가맹점 증감으로 정렬</span>','directory summary'],
  ['<th class="num">공개비용</th>','<th class="num">창업비용</th>','directory cost header'],
  ['<th class="num">가맹점</th>','<th class="num">가맹점 수</th>','directory stores header'],
  ['<th class="num">이전 기준 증감</th>','<th class="num">가맹점 증감</th>','directory growth header']
]);

// Keep navigation and footer wording short and functional across the preview.
const htmlFiles=[];
async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
for(const file of htmlFiles){
  let html=await fs.readFile(file,'utf8');
  html=html
    .replace(/>업종 데이터<\/a>/g,'>업종별 보기</a>')
    .replace(/>두 브랜드 비교<\/a>/g,'>브랜드 비교</a>')
    .replace(/>데이터 리포트<\/a>/g,'>창업 자료</a>')
    .replace(/공개자료를 같은 단위와 기준으로 정리해 프랜차이즈 비용·점포 변화를 비교합니다\./g,'프랜차이즈 창업비용, 가맹점 수, 평균매출과 계산기를 제공합니다.');
  await fs.writeFile(file,html,'utf8');
}

let css=await fs.readFile(cssPath,'utf8');
const stickyRule='.data-table thead th{position:sticky;top:68px;z-index:3;background:#F1EDE5}';
const staticRule='.data-table thead th{position:static;top:auto;z-index:auto;background:#F1EDE5;background-clip:padding-box}';
if(!css.includes(stickyRule))throw new Error('Expected sticky table header rule not found');
css=css.replace(stickyRule,staticRule);
css=css.replace('.data-table,table{width:100%;border-collapse:collapse;background:var(--paper);table-layout:auto}', '.data-table,table{width:100%;border-collapse:separate;border-spacing:0;background:var(--paper);table-layout:auto}');
if(!css.includes('/* v11.4 table stability */')){
  css+='\n/* v11.4 table stability */\n.table-scroll,.table-wrap{isolation:isolate}.data-table thead,.data-table thead tr{position:static;background:#F1EDE5}.data-table thead th{box-shadow:inset 0 -1px 0 var(--line)}.data-table th,.data-table td{vertical-align:middle}\n';
}
await fs.writeFile(cssPath,css,'utf8');

const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.v11_4={directHomeCopy:true,directDirectoryCopy:true,stickyTableHeaders:false,separateTableBorders:true};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const report={schemaVersion:1,generatedAt:new Date().toISOString(),uiVersion:'11.4',copyPolicy:'functional labels only',tablePolicy:'static header; no sticky overlap',htmlPages:htmlFiles.length};
await fs.writeFile(path.join(out,'v11-4-quality-report.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_4:'PASS',htmlPages:htmlFiles.length,stickyTableHeaders:false},null,2));
