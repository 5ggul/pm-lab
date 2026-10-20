import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const file=path.join(root,'recalls/index.html');
let html=fs.readFileSync(file,'utf8');
const start='<!-- official-issues-hub:start -->',end='<!-- official-issues-hub:end -->';
const recallStart='<!-- official-issues-recalls:start -->',recallEnd='<!-- official-issues-recalls:end -->';
if(html.includes(start)){
 const original=html.split(recallStart)[1]?.split(recallEnd)[0];
 if(!original)throw new Error('Official issues hub: original recall content missing');
 html=html.slice(0,html.indexOf(start))+original+html.slice(html.indexOf(end)+end.length);
}
html=html.replace(/<script\b[^>]*src="[^\"]*official-issues\.js(?:\?[^\"]*)?"[^>]*><\/script>/g,'');
const begin=html.indexOf('<form id="recall-search"');
const finish=html.indexOf('</main>',begin);
if(begin<0||finish<0)throw new Error('Official issues hub: recall DOM not found');
const recall=html.slice(begin,finish);
const hub=`${start}
<nav class="official-issues-tabs" aria-label="공식 자료 종류">
 <a id="issues-tab-recalls" href="?tab=recalls#issues-recalls" data-issues-tab="recalls">리콜</a>
 <a id="issues-tab-reports" href="?tab=reports#issues-reports" data-issues-tab="reports">공식 신고 현황</a>
 <a id="issues-tab-free-repairs" href="?tab=free-repairs#issues-free-repairs" data-issues-tab="free-repairs">무상수리</a>
</nav>
<section id="issues-recalls" class="official-issues-panel" aria-labelledby="issues-tab-recalls" data-issues-panel="recalls">${recallStart}${recall}${recallEnd}</section>
<section id="issues-reports" class="official-issues-panel" aria-labelledby="issues-tab-reports" data-issues-panel="reports">
 <div class="issues-section-head"><h2>공식 제작결함 신고</h2><p>신고는 확정 결함이나 고장률이 아닙니다.</p></div>
 <p id="issues-source-status" class="issues-source-status" role="status">공개 자료의 수록 범위를 확인하고 있습니다.</p>
 <form id="issues-filter" class="issues-filter" action="./" method="get" hidden>
  <input type="hidden" name="tab" value="reports">
  <div class="issues-search-fields"><label>차량 검색<input type="search" id="issues-q" name="reportQ" placeholder="그랜저, 쏘렌토, BMW…" autocomplete="off"></label><label>제조사<select id="issues-maker" name="maker"><option value="">전체 제조사</option></select></label></div>
  <p id="issues-match-count" class="issues-filter-caption"></p>
  <div id="issues-family-list" class="issues-family-list" aria-label="차량 선택"></div>
  <button id="issues-more" class="issues-more" type="button" hidden>차량 더 보기</button>
  <div id="issues-selected" class="issues-selected" hidden><div><span>선택 차량</span><strong id="issues-family-name"></strong></div><button id="issues-clear" type="button">다른 차 선택</button></div>
  <div id="issues-period-fields" class="issues-period-fields" hidden><label>모델연도<select id="issues-model-year" name="modelYear"><option value="">전체 모델연도</option></select></label><label>접수 시작월<input type="month" id="issues-from" name="from"></label><label>접수 종료월<input type="month" id="issues-to" name="to"></label></div>
  <p id="issues-filter-error" class="issues-filter-error" role="alert" hidden></p>
 </form>
 <div id="issues-report-result" class="issues-report-result" aria-live="polite" aria-atomic="false"></div>
 <details class="issues-method"><summary>자료 기준</summary><div id="issues-method-content"><p>한국교통안전공단의 제작결함 신고정보 공개 파일을 차종·모델연도·접수월별로 집계합니다. 개별 신고 내용과 수리비는 제공되지 않습니다.</p></div><p>신고 건수는 판매량·운행 대수·확정 결함 여부를 반영하지 않습니다. 신고 수만으로 차량 간 안전성이나 고장률을 비교할 수 없습니다.</p><p><a href="https://www.data.go.kr/data/15016450/fileData.do" target="_blank" rel="noopener noreferrer">제작결함 신고정보 원문 (외부)</a></p></details>
 <noscript><p>차종별 집계와 필터를 사용하려면 JavaScript를 켜 주세요. <a href="https://www.data.go.kr/data/15016450/fileData.do">공식 신고정보 파일 확인</a></p></noscript>
</section>
<section id="issues-free-repairs" class="official-issues-panel" aria-labelledby="issues-tab-free-repairs" data-issues-panel="free-repairs">
 <div class="issues-section-head"><h2>무상점검·수리</h2><p>리콜과 별도로 진행되는 제작사의 무상 조치입니다.</p></div>
 <div class="issues-service-body"><p>자동차리콜센터에서 차종을 검색한 뒤 대상 생산기간과 조치 내용을 확인하세요.</p><a class="issues-official-link" href="https://www.car.go.kr/ri/grts/list.do" target="_blank" rel="noopener noreferrer">공식 무상점검·수리 공지 보기 (외부)</a><p class="issues-filter-caption">현재 픽마이카에서 무상수리 공지를 자동 집계하지 않습니다. 대상 여부는 공식 공지와 제작사에서 확인하세요.</p></div>
</section>
${end}`;
html=html.slice(0,begin)+hub+html.slice(finish);
html=html.replace(/<h1>[^<]*<\/h1>/,'<h1>리콜·신고 현황</h1>');
html=html.replace(/<p class="decision-intro">[^<]*<\/p>/,'<p class="decision-intro">내 차의 공식 신고 기록과 조치 공지를 확인하세요.</p>');
html=html.replace(/최근 리콜 공지 \| 픽마이카/g,'리콜·신고 현황 | 픽마이카');
html=html.replace(/"name":"최근 리콜 공지"/g,'"name":"리콜·신고 현황"');
html=html.replace(/자동차리콜센터에서 자동 갱신한 최근 공지의 생산기간과 시정방법을 확인하세요\./g,'내 차의 공식 신고 기록과 조치 공지를 확인하세요.');
html=html.replace('</body>','<script src="../assets/official-issues.js" defer></script></body>');
fs.writeFileSync(file,html);
console.log('Official issues hub: three tabs added; original recall search, notices and legacy aliases preserved.');
