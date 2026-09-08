import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const version=name=>createHash('sha256').update(fs.readFileSync(path.join(root,'assets',name))).digest('hex').slice(0,10);
const css=version('reference-ui.css'),js=version('reference-ui.js');
const text=s=>s.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const navLabel=({id,title})=>({efficiency:'연비',cost:'유지비',recall:'리콜',compare:'비교',calculate:'내 비용 계산',specs:'사양별 연비'}[id]||(/출처/.test(title)?'출처·계산 기준':/질문/.test(title)?'자주 묻는 질문':/차체/.test(title)?'제원':title));
let count=0,matrices=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['assets','data','scripts'].includes(e.name))continue;const f=path.join(dir,e.name);if(e.isDirectory()){walk(f);continue;}if(!f.endsWith('.html'))continue;
 let s=fs.readFileSync(f,'utf8'),rel=path.relative(root,f).replaceAll('\\','/'),pre='../'.repeat(rel.split('/').length-1)||'./';
 const kind=rel==='index.html'?'home':rel==='cars/index.html'?'catalog':rel.startsWith('cars/')?'vehicle':rel==='compare/index.html'?'calculator':rel.startsWith('compare/')?'comparison':rel.startsWith('tools/')?'calculator':rel.startsWith('rankings/')?'ranking':rel.startsWith('recalls/')?'recall':rel.startsWith('guide/')?'guide':'information';
 s=s.replace(/ data-reference-(?:page|matrix)="[^"]*"/g,'').replace('<body',`<body data-reference-page="${kind}"`);
 s=s.replace(/<!-- REF:MATRIX:START -->[\s\S]*?<!-- REF:MATRIX:END -->/g,'').replace(/<!-- REF:NAV:START -->[\s\S]*?<!-- REF:NAV:END -->/g,'');
 s=s.replace(/<link[^>]*href="[^"]*assets\/reference-ui\.css[^"]*"[^>]*>/g,'').replace(/<script[^>]*src="[^"]*assets\/reference-ui\.js[^"]*"[^>]*><\/script>/g,'');
 if(kind==='comparison'){
  const cards=[...s.matchAll(/<article\b[^>]*(?:data-pilot-car|data-decision-side)[^>]*>[\s\S]*?<\/article>/g)].map(m=>m[0]);
  if(cards.length===2){const sets=cards.map(c=>[...c.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map(m=>[text(m[1]),text(m[2])])),names=cards.map(c=>text(c.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1]||'차량'));
   const rows=sets[0].filter(([k])=>sets[1].some(([b])=>b===k)).map(([k,a])=>{const b=sets[1].find(([key])=>key===k)[1];return `<tr data-equal="${a===b}"><th scope="row">${esc(k)}</th><td>${esc(a)}</td><td>${esc(b)}</td></tr>`;});
   if(rows.length){const matrix=`<!-- REF:MATRIX:START --><section class="reference-specs" id="specs-at-a-glance"><div class="reference-specs-head"><h2>사양 한눈에</h2><label class="reference-diff" hidden><input type="checkbox" data-differences> 다른 항목만</label></div><div class="reference-table-scroll"><table class="reference-matrix"><caption class="studio-sr-only">${esc(names.join('와 '))} 사양 비교</caption><thead><tr><th scope="col">항목</th>${names.map((n,i)=>`<th scope="col"><span class="reference-car-letter">${i?'B':'A'}</span>${esc(n)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div><p class="reference-no-difference" hidden>표시된 사양은 모두 같습니다.</p></section><!-- REF:MATRIX:END -->`;
    const last=s.indexOf(cards[1])+cards[1].length,sectionEnd=s.indexOf('</section>',last)+10;s=s.slice(0,sectionEnd)+matrix+s.slice(sectionEnd);s=s.replace('<body ', '<body data-reference-matrix="true" ');matrices++;
   }
  }
 }
 if(['vehicle','guide'].includes(kind)){
  s=s.replace(/ id="reference-section-\d+"/g,'');
  const links=[];let n=0;
  s=s.replace(/<section\b([^>]*)>([\s\S]*?)<\/section>/g,(whole,attrs,inside)=>{const h=inside.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/);if(!h||links.length>=6)return whole;const title=text(h[1]);if(title.length>28)return whole;const id=attrs.match(/\bid="([^"]+)"/)?.[1]||`reference-section-${++n}`;links.push({id,title});return `<section${/\bid=/.test(attrs)?attrs:attrs+` id="${id}"`}>${inside}</section>`;});
  if(links.length>=3){const nav=`<!-- REF:NAV:START --><nav class="reference-section-nav" aria-label="이 페이지에서">${links.map(l=>`<a href="#${l.id}">${esc(navLabel(l))}</a>`).join('')}</nav><!-- REF:NAV:END -->`;const start=s.indexOf('<main'),end=s.indexOf('</section>',start)+10;if(start>=0&&end>9)s=s.slice(0,end)+nav+s.slice(end);}
 }
 s=s.replace('</head>',`<link rel="stylesheet" href="${pre}assets/reference-ui.css?v=${css}"><script defer src="${pre}assets/reference-ui.js?v=${js}"></script></head>`);
 fs.writeFileSync(f,s);count++;
}}
walk(root);console.log(`Reference design: ${count} pages, ${matrices} static comparison matrices.`);
