import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const files=['cars/index.html','cars/family/index.html','data-sources/index.html'];
const forbidden=['정규화','자동 고신뢰','자동 중신뢰','차종군','차량군','검수 상세','raw snapshot','hierarchy','enrichment','quality gate','원문 모델','원문 그룹','공식 원문','신고행','API 제공'];
const publicForbidden=['검수','검토 ','불러오는 중','숫자를 읽는 기준','갈립니다','연결 공지','준비 중','대표 답변','검수상태','검수 상태','정보 확인 중'];
const brokenCopy=['공식 데이터명 +','공식 데이터이','과거 데이터으로','기준으로차'];
const errors=[];
function visibleText(html){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<!--([\s\S]*?)-->/g,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim()}
for(const rel of files){const html=fs.readFileSync(path.join(root,rel),'utf8'),text=visibleText(html);for(const term of forbidden)if(text.includes(term))errors.push(`${rel}: forbidden visible term '${term}'`)}
function publicHtmlFiles(dir){const out=[];for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.isDirectory()&&['assets','data','scripts','qa'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())out.push(...publicHtmlFiles(file));else if(file.endsWith('.html'))out.push(file)}return out}
const publicFiles=publicHtmlFiles(root);
for(const file of publicFiles){const html=fs.readFileSync(file,'utf8'),text=visibleText(html);for(const term of publicForbidden)if(text.includes(term))errors.push(`${path.relative(root,file)}: forbidden visible term '${term}'`);for(const term of brokenCopy)if(text.includes(term)||html.includes(term))errors.push(`${path.relative(root,file)}: broken copy '${term}'`)}
const cars=fs.readFileSync(path.join(root,'cars/index.html'),'utf8');
if(!cars.includes('data-consumer-catalog-owner="true"')||!cars.includes('if(document.documentElement.dataset.consumerCatalogOwner==="true")return;'))errors.push('cars/index.html: hidden legacy table can overwrite consumer pagination URL');
if(!/<div class="view-switch"[^>]*hidden/.test(cars))errors.push('cars/index.html: internal catalog mode controls are not hidden');
if(cars.includes("view=p.get('view')==='raw'"))errors.push('cars/index.html: public catalog can still enter internal mode from URL');
if(!cars.includes("let view='family'"))errors.push('cars/index.html: public catalog is not locked to vehicle view');
if(!/<select id="filter"[^>]*hidden/.test(cars)&&!cars.includes('filterEl.hidden=true'))errors.push('cars/index.html: internal vehicle status filter is not hidden');
const family=fs.readFileSync(path.join(root,'cars/family/index.html'),'utf8');
if(family.includes('?view=raw'))errors.push('cars/family/index.html: internal catalog link still public');
if(!family.includes('차량 상세'))errors.push('cars/family/index.html: missing 차량 상세 wording');
if(!family.includes('.family-meta .badge{display:none}'))errors.push('cars/family/index.html: internal status badge is not hidden');
const dynamic=fs.readFileSync(path.join(root,'assets','family-universal.js'),'utf8');
for(const term of ['정규화','차종군','차량군','원문 모델','원문 그룹','공식 원문','신고행'])if(dynamic.includes(term))errors.push(`assets/family-universal.js: forbidden dynamic term '${term}'`);
if(!dynamic.includes('세금·에너지비')||!dynamic.includes('차량 비교'))errors.push('assets/family-universal.js: mobile action buttons missing');
if(dynamic.includes('1년 유지비'))errors.push('assets/family-universal.js: misleading annual maintenance label remains');
if(!dynamic.includes('공식 연비·전비 정보'))errors.push('assets/family-universal.js: consumer specification heading missing');
for(const rel of ['assets/vehicle-photos.js','assets/studio.js','scripts/build-studio.mjs']){
  const source=fs.readFileSync(path.join(root,rel),'utf8');
  if(source.includes('사진 준비 중')||source.includes('치수 정보 준비 중')||source.includes('연비 정보 준비 중'))errors.push(`${rel}: unfinished public placeholder wording remains`);
}
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,files:publicFiles.length,dynamic_detail_copy:true,consumer_catalog_only:true},null,2));
