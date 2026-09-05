import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const files=['cars/index.html','cars/family/index.html','data-sources/index.html'];
const forbidden=['정규화','자동 고신뢰','자동 중신뢰','차종군','차량군','검수 상세','raw snapshot','hierarchy','enrichment','quality gate','원문 모델','원문 그룹','공식 원문','신고행','API 제공'];
const errors=[];
function visibleText(html){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<!--([\s\S]*?)-->/g,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim()}
for(const rel of files){const html=fs.readFileSync(path.join(root,rel),'utf8'),text=visibleText(html);for(const term of forbidden)if(text.includes(term))errors.push(`${rel}: forbidden visible term '${term}'`)}
const cars=fs.readFileSync(path.join(root,'cars/index.html'),'utf8');
if(!cars.includes('차종 보기'))errors.push('cars/index.html: missing 차종 보기');
if(!cars.includes('상세 사양 보기'))errors.push('cars/index.html: missing 상세 사양 보기');
if(!cars.includes('family-table th:nth-child(4)'))errors.push('cars/index.html: internal family status column is not hidden');
if(!cars.includes('filterEl.hidden=true'))errors.push('cars/index.html: internal family status filter is not hidden');
const family=fs.readFileSync(path.join(root,'cars/family/index.html'),'utf8');
if(!family.includes('차량 상세'))errors.push('cars/family/index.html: missing 차량 상세 wording');
if(!family.includes('.family-meta .badge{display:none}'))errors.push('cars/family/index.html: internal status badge is not hidden');
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,files:files.length,forbidden_visible_terms:forbidden.length},null,2));
