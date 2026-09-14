import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/generated/catalog.json'),'utf8'));
const calc=JSON.parse(fs.readFileSync(path.join(root,'data/generated/all-car-calc-index.json'),'utf8'));
const version=name=>createHash('sha256').update(fs.readFileSync(path.join(root,'assets',name))).digest('hex').slice(0,10);
const cssVersion=version('motion-ui.css');
const jsVersion=version('motion-ui.js');
const featured=calc.rows.find(row=>row.family_id==='hyundai-ioniq-6'&&row.combined_efficiency===6.3&&row.range_km===437&&row.tax_ready);
if(!featured)throw new Error('Homepage data signal requires the reviewed IONIQ 6 hero specification.');
const number=value=>Math.round(value).toLocaleString('ko-KR');
const homeSignal=`<!-- MOTION:HERO:START --><div class="hero-data-stream" aria-label="아이오닉 6 기본형 2WD 18인치 신고 사양"><span><svg class="hero-signal-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M6 22a10 10 0 0 1 20 0M16 22l6-7"/><circle cx="16" cy="22" r="1.5"/></svg><small>아이오닉 6 · 공식 복합전비</small><strong>${featured.combined_efficiency} km/kWh</strong></span><span><svg class="hero-signal-icon" viewBox="0 0 32 32" aria-hidden="true"><rect x="8" y="5" width="16" height="22" rx="2"/><path d="M12 11h8M12 16h8M12 21h4"/></svg><small>전기 승용 신차 · 자동차세</small><strong>130,000원</strong></span><span><svg class="hero-signal-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M17 3 9 17h7l-1 12 8-15h-7z"/></svg><small>기본형 2WD 18인치 · 주행거리</small><strong>${number(featured.range_km)} km</strong></span></div><!-- MOTION:HERO:END -->`;
let pages=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);
 if(entry.isDirectory()){if(!['assets','data','scripts'].includes(entry.name))walk(file);continue}
 if(!file.endsWith('.html'))continue;
 let html=fs.readFileSync(file,'utf8');
 const rel=path.relative(root,file).replaceAll('\\','/'),pre='../'.repeat(rel.split('/').length-1)||'./';
 html=html.replace(/<!-- MOTION:HERO:START -->[\s\S]*?<!-- MOTION:HERO:END -->/g,'');
 html=html.replace(/<link[^>]*href="[^"]*assets\/motion-ui\.css[^"]*"[^>]*>/g,'');
 html=html.replace(/<script[^>]*src="[^"]*assets\/motion-ui\.js[^"]*"[^>]*><\/script>/g,'');
 if(rel==='index.html')html=html.replace(/(<figure class="hero-photograph"[\s\S]*?<\/figure>)/,'$1'+homeSignal);
 html=html.replace('</head>',`<link rel="stylesheet" href="${pre}assets/motion-ui.css?v=${cssVersion}"></head>`);
 html=html.replace('</body>',`<script defer src="${pre}assets/motion-ui.js?v=${jsVersion}"></script></body>`);
 fs.writeFileSync(file,html);pages++;
}}
walk(root);
console.log(`Motion UI: ${pages} pages, homepage data signal and one-shot metric reveals.`);
