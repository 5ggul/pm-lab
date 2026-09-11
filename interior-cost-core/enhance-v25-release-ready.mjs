import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const exists=r=>fs.existsSync(path.join(ROOT,r));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{
  const full=path.join(dir,ent.name);
  return ent.isDirectory()?walk(full):[full];
});
const rel=f=>path.relative(ROOT,f).split(path.sep).join('/');

const cssSource=fs.readFileSync(path.resolve('interior-cost-core/site-v25-release.css'),'utf8');
write('assets/site-v25-release.css',cssSource);
const cssLink=`<link rel="stylesheet" href="${BASE}/assets/site-v25-release.css?v=25">`;

const addReleaseShell=html=>{
  if(!html.includes('site-v25-release.css'))html=html.replace('</head>',`${cssLink}</head>`);
  html=html.replace(/<body class="([^"]*)"/,(_,cls)=>`<body class="${cls.includes('v25-release')?cls:`${cls} v25-release`.trim()}"`);
  return html;
};

const protectAndRewriteVisible=(html,rewriter)=>{
  const tokens=html.match(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]+>|[^<]+/gi)||[html];
  return tokens.map(token=>token.startsWith('<')?token:rewriter(token)).join('');
};

const rewriteVisitorText=text=>text
  .replace(/EDITORIAL REVIEW\s*·\s*V22/gi,'비교 조건')
  .replace(/REFERENCE FIX\s*·\s*V23/gi,'공법·규격 확인')
  .replace(/RELEASE CANDIDATE/gi,'주요 기능')
  .replace(/Release candidate/gi,'확인 경로')
  .replace(/WAVE\s*2\s*ANSWER/gi,'데이터 기준')
  .replace(/PRIMARY ANSWER/gi,'핵심 안내')
  .replace(/EVIDENCE TYPE/gi,'근거 구분')
  .replace(/QUOTE \(N gate\)/gi,'실제견적(N기준)')
  .replace(/\bOFFICIAL\b/g,'공식자료')
  .replace(/\bREFERENCE\b/g,'공공참고')
  .replace(/\bCALCULATED\b/g,'계산값')
  .replace(/\bQUOTE\b/g,'실제견적')
  .replace(/\bRELEASE\b/gi,'확인 가능')
  .replace(/\bHOLD\b/gi,'추가 확인')
  .replace(/출시 후보/g,'확인 경로')
  .replace(/검수 후보/g,'확인 경로')
  .replace(/\bPREVIEW\b/gi,'')
  .replace(/프리뷰/g,'')
  .replace(/\bNOINDEX\b/gi,'')
  .replace(/\bnoindex\b/gi,'')
  .replace(/Search Console/gi,'검색 등록')
  .replace(/production 전환/gi,'운영 전환')
  .replace(/\bproduction\b/gi,'운영')
  .replace(/광고 활성화/g,'광고 설정')
  .replace(/\b[Vv](?:1[0-9]|2[0-9])(?:\.\d+(?:\.\d+)?)?\b/g,'')
  .replace(/\s+·\s+·/g,' · ')
  .replace(/\s{2,}/g,' ');

const removeSectionByClass=(html,className)=>html.replace(new RegExp(`<section class="[^"]*${className}[^"]*"[\\s\\S]*?<\\/section>`,'g'),'');

const surfacePaths=new Set([
  'index.html','data/index.html','quote-check/index.html','quote-compare/index.html','calculator/index.html',
  'compare/quote-lines/index.html','compare/reference-layers/index.html','interior-cost/matrix/index.html'
]);
if(exists('interior-cost/matrix')){
  for(const f of walk(path.join(ROOT,'interior-cost','matrix')).filter(x=>x.endsWith('.html')))surfacePaths.add(rel(f));
}

// Repair legacy answer links that were rendered as literal href="undefined".
if(exists('data/answers-v11/index.html')){
  let answers=read('data/answers-v11/index.html');
  answers=answers.replace(/<a\s+href=["']undefined["']([^>]*)>([\s\S]*?)<\/a>/gi,'<span$1>$2</span>');
  write('data/answers-v11/index.html',answers);
}

// Home: remove release-engineering status strips and retain only visitor actions/data.
if(exists('index.html')){
  let h=read('index.html');
  h=removeSectionByClass(h,'v18-release-strip');
  h=removeSectionByClass(h,'v16-wave-strip');
  h=h.replace(/<div><span>현재 상태<\/span><strong>[\s\S]*?<\/strong><\/div>/,'');
  h=h.replace(/<a href="\/pm-lab\/interior-cost-preview\/data\/answers-v16\/">최신 답변<\/a>/,'');
  h=h.replace('INTERIOR COST DATA / PREVIEW','INTERIOR COST DATA');
  h=h.replace(/검수 (\d{4}-\d{2}-\d{2})<br>데이터 [Vv][^<]+/,'검수 $1');
  h=h.replace('OFFICIAL·REFERENCE·QUOTE·CALCULATED','공식자료·공공참고·실제견적·계산값');
  h=addReleaseShell(h);
  h=protectAndRewriteVisible(h,rewriteVisitorText);
  write('index.html',h);
}

// Data hub: keep public evidence, remove internal launch/ad/SEO operation consoles.
if(exists('data/index.html')){
  let h=read('data/index.html');
  h=h.replace('출처, 공표 기간, 단위와 데이터 유형을 분리해 확인하는 운영·근거 데이터입니다.','출처, 공표 기간, 단위와 데이터 유형을 분리해 확인하는 근거 데이터입니다.');
  h=removeSectionByClass(h,'v12-section');
  h=removeSectionByClass(h,'v11-section');
  h=removeSectionByClass(h,'v13-prelaunch-link');
  h=removeSectionByClass(h,'v15-release-link');
  h=removeSectionByClass(h,'v16-priority-link');
  h=h.replace(/<a href="\/pm-lab\/interior-cost-preview\/data\/publisher-readiness\/">[\s\S]*?<\/a>/,'');
  h=h.replace(/<a href="\/pm-lab\/interior-cost-preview\/data\/answers\/">[\s\S]*?<\/a>/,'');
  h=h.replace(/<p>검수 (\d{4}-\d{2}-\d{2}) · 데이터 [Vv][^<]+<\/p>/,'<p>검수 $1</p>');
  h=h.replace('OFFICIAL·REFERENCE·QUOTE·CALCULATED','공식자료·공공참고·실제견적·계산값');
  h=h.replace('OFFICIAL / QUOTE / CALCULATED','공식자료 / 실제견적 / 계산값');
  h=addReleaseShell(h);
  h=protectAndRewriteVisible(h,rewriteVisitorText);
  write('data/index.html',h);
}

// Matrix hub: replace engineering/release notes with a concise comparison boundary.
if(exists('interior-cost/matrix/index.html')){
  let h=read('interior-cost/matrix/index.html');
  h=h.replace('24·30·32·34·40평과 욕실·도배·바닥·목공·단열 25개 조합을 실제 작업수량 기준으로 확인합니다.','24·30·32·34·40평과 욕실·도배·바닥·목공·단열 25개 경로에서 공법·규격·공공 참고단가를 확인합니다.');
  h=h.replace('PYEONG × TRADE MATRIX','평수 × 공종');
  h=h.replace('24·30·32·34·40평과 욕실·도배·바닥·목공·단열을 교차해 실제 작업수량 기준으로 확인합니다.','24·30·32·34·40평과 욕실·도배·바닥·목공·단열을 교차해 필요한 경로를 바로 찾습니다.');
  h=h.replace(/<div class="v21-boundary"><p><strong>데이터 레이어를 합치지 않습니다\.<\/strong><\/p>[\s\S]*?<\/div>/,`<div class="v25-source-legend"><strong>비교 기준</strong><p><b>내 견적</b>, <b>공공 시공 참고</b>, <b>조달청 자재 참고</b>, <b>계산 결과</b>는 서로 다른 값입니다. 같은 단위·규격·포함 범위를 확인한 뒤 각각 비교하며 자동으로 합산하거나 적정가격으로 판정하지 않습니다.</p></div>`);
  h=h.replace(/<p>v23에서 누락됐던[\s\S]*?<\/p>/,'');
  h=h.replace(/<div class="v21-boundary" data-v23-release-note>[\s\S]*?<\/div>/,'');
  h=h.replace('<span>출시 후보</span><strong>25개</strong>','<span>확인 경로</span><strong>25개</strong>');
  h=h.replace(/견적 확인<small>출시 후보<\/small>/g,'견적 기준 보기<small>공공 참고</small>');
  h=h.replace(/견적 확인<small>편집 검수 완료<\/small>/g,'견적 기준 보기<small>공법·규격</small>');
  h=h.replace(/견적 확인<small>단열 참조 복구<\/small>/g,'견적 기준 보기<small>단열 ㎡ 참고</small>');
  h=h.replace(/견적 확인<small>추가 검토<\/small>/g,'견적 기준 보기<small>추가 확인</small>');
  h=addReleaseShell(h);
  h=protectAndRewriteVisible(h,rewriteVisitorText);
  write('interior-cost/matrix/index.html',h);
}

// Tool/core pages: legacy release strips are internal QA, not visitor content.
for(const p of ['quote-check/index.html','quote-compare/index.html','calculator/index.html','compare/quote-lines/index.html','compare/reference-layers/index.html']){
  if(!exists(p))continue;
  let h=read(p);
  h=removeSectionByClass(h,'v15-rc-strip');
  h=removeSectionByClass(h,'v18-release-strip');
  h=h.replace('OFFICIAL·REFERENCE·QUOTE·CALCULATED','공식자료·공공참고·실제견적·계산값');
  h=addReleaseShell(h);
  h=protectAndRewriteVisible(h,rewriteVisitorText);
  write(p,h);
}

// Matrix detail pages: preserve all data/FAQ but remove implementation-version language.
for(const p of [...surfacePaths].filter(x=>x.startsWith('interior-cost/matrix/')&&x!=='interior-cost/matrix/index.html')){
  if(!exists(p))continue;
  let h=read(p);
  h=h.replace('EDITORIAL REVIEW · V22','비교 조건');
  h=h.replace('REFERENCE FIX · V23','공법·규격 확인');
  h=h.replace('이 편집 검수는 검색용 문구를 늘리기 위한 것이 아니라, 같은 템플릿에서 평수 숫자만 바뀌는 페이지가 되지 않도록 실제 비교 조건과 판단 경계를 조합별로 분리한 것입니다.','같은 평수라도 공정 수량과 포함 범위가 다르면 총액을 바로 비교하지 않고 조건을 먼저 맞춥니다.');
  h=h.replace('평수는 검색 문맥일 뿐 작업면적 대체값이 아닙니다. 공공 시공 참고와 조달청 자재 참고는 서로 다른 레이어로 유지합니다.','평수는 주택 크기를 구분하는 정보이며 실제 단열 수량은 작업면적을 사용합니다. 공공 시공 참고와 조달청 자재 참고는 각각 확인합니다.');
  h=addReleaseShell(h);
  h=protectAndRewriteVisible(h,rewriteVisitorText);
  write(p,h);
}

const report={
  version:'25.0.0',reviewed_on:'2026-09-12',
  fixed_undefined_links:true,
  visitor_surface_count:surfacePaths.size,
  matrix_mobile_card_layout:true,
  quote_mobile_compact_layout:true,
  internal_release_copy_removed:true,
  preview_noindex_preserved:true,
  production_switch:false,search_console_submission:false,ads_injected:false,merge_to_main:false
};
write('data/v25-release-ready-enhancement.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
