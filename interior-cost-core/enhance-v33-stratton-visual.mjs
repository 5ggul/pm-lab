import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,c)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const exists=p=>fs.existsSync(path.join(ROOT,p));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]});
const photoPages={
 renovation:'https://unsplash.com/photos/interior-renovation-with-construction-materials-and-supplies-hPfrYoKkxp0',
 bathroom:'https://unsplash.com/photos/modern-bathroom-with-glass-shower-and-toilet-VSD5og2FSW0',
 kitchen:'https://unsplash.com/photos/modern-kitchen-with-island-and-stainless-steel-appliances-J77Yzq9_Hcg',
 floor:'https://unsplash.com/photos/sunlight-shines-on-a-polished-wooden-floor-inside-PYIHZs8y6Rk',
 framing:'https://unsplash.com/photos/interior-view-of-a-room-under-construction-with-wooden-framing-Ls6mShbvdpw',
 insulation:'https://unsplash.com/photos/interior-room-under-construction-with-exposed-brick-and-insulation-irnH6JieSgI',
 electrical:'https://unsplash.com/photos/interior-framing-and-wiring-during-construction-renovation-el9nujeXlvw',
 window:'https://unsplash.com/photos/an-empty-room-with-a-door-and-a-window-p9uDc9WQUTA'
};
const outDir=path.join(ROOT,'assets/v33');fs.mkdirSync(outDir,{recursive:true});
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&#x2F;','/').replaceAll('&quot;','"');
async function fetchPhoto(name,pageUrl){
 const html=await fetch(pageUrl,{headers:{'user-agent':'Mozilla/5.0 Chrome/128 Safari/537.36','accept-language':'en-US,en;q=0.9'}}).then(r=>{if(!r.ok)throw new Error(`${pageUrl} ${r.status}`);return r.text()});
 let m=html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
 if(!m)throw new Error(`og:image missing ${pageUrl}`);
 const u=new URL(decode(m[1]));
 if(!/images\.unsplash\.com$/.test(u.hostname))throw new Error(`unexpected image host ${u.hostname}`);
 u.searchParams.set('auto','format');u.searchParams.set('fit','crop');u.searchParams.set('w','1600');u.searchParams.set('q','80');
 const res=await fetch(u,{headers:{'user-agent':'Mozilla/5.0'}});if(!res.ok)throw new Error(`image ${res.status}`);
 const buf=Buffer.from(await res.arrayBuffer());if(buf.length<30000)throw new Error(`image too small ${name}`);
 fs.writeFileSync(path.join(outDir,`${name}.jpg`),buf);return {name,page_url:pageUrl,image_url:u.toString(),bytes:buf.length,license:'Unsplash License'};
}
const credits=[];for(const [name,url] of Object.entries(photoPages))credits.push(await fetchPhoto(name,url));
write('data/v33-photo-sources.json',JSON.stringify({version:'33.0.0',sources:credits},null,2));
const css=fs.readFileSync(path.resolve('interior-cost-core/site-v33-stratton-visual.css'),'utf8');write('assets/site-v33-stratton-visual.css',css);
const cssLink=`<link rel="stylesheet" href="${BASE}/assets/site-v33-stratton-visual.css?v=33">`;
const ticker=`<div class="v33-ticker" aria-label="주요 서비스"><div class="v33-ticker-track">${Array.from({length:2},()=>`<a href="${BASE}/quote-check/"><b>01</b>견적 확인</a><a href="${BASE}/quote-compare/"><b>02</b>업체 비교</a><a href="${BASE}/cost/"><b>03</b>공사별 비용</a><a href="${BASE}/data/g2b-all/"><b>337,984</b>가격 레코드</a><a href="${BASE}/interior-cost/"><b>24·30·32·34·40</b>평수별 비용</a>`).join('')}</div></div>`;
function photo(name,alt){return `<img src="${BASE}/assets/v33/${name}.jpg" alt="${alt}" loading="lazy" decoding="async">`}
const home=`<main id="main-content" class="v33-home">
<section class="v33-hero"><div><div class="v33-eyebrow">인테리어 견적 · 공사비 데이터</div><h1 class="v33-display">견적 확인.<br>업체 비교.<br><span class="v33-highlight">공사비 데이터.</span></h1><p class="v33-hero-copy">견적서의 누락·별도 비용을 확인하고, 업체 조건을 맞춰 비교한 뒤 공종별 공공 참고단가까지 바로 확인합니다.</p><div class="v33-hero-actions"><a class="v33-btn primary" href="${BASE}/quote-check/">견적 확인 시작</a><a class="v33-btn" href="${BASE}/quote-compare/">업체 견적 비교</a></div></div><div class="v33-hero-visual"><span class="v33-tape" aria-hidden="true"></span>${photo('renovation','실내 인테리어 공사 현장')}<div class="v33-audit-card"><header><span>견적검수실 DATA</span><span>PUBLIC</span></header><dl><div><dt>가격 레코드</dt><dd>337,984건</dd></div><div><dt>API 범위</dt><dd>11개</dd></div><div><dt>수집 페이지</dt><dd>351</dd></div><div><dt>공종</dt><dd class="accent">11개</dd></div></dl></div></div></section>
<section class="v33-section"><div class="v33-section-head"><h2>먼저 할 일</h2><p>설명부터 읽지 않아도 됩니다. 지금 가진 견적서 상태에 맞는 기능으로 바로 들어갑니다.</p></div><div class="v33-action-grid"><a class="v33-action" href="${BASE}/quote-check/"><span class="num">01</span><strong>견적서 확인</strong><small>누락 · 별도 비용 · 사양</small></a><a class="v33-action" href="${BASE}/quote-compare/"><span class="num">02</span><strong>업체 2~3곳 비교</strong><small>같은 조건으로 맞춰 비교</small></a><a class="v33-action" href="${BASE}/calculator/"><span class="num">03</span><strong>공사비 계산</strong><small>공종별 입력</small></a><a class="v33-action" href="${BASE}/compare/quote-lines/"><span class="num">04</span><strong>CSV · TXT 불러오기</strong><small>견적 항목 한 번에</small></a></div></section>
<section class="v33-section"><div class="v33-section-head"><h2>공사별 비용</h2><p>실제 공간 이미지를 보고 공종을 고른 뒤, 상세 페이지에서 공공 참고단가와 포함 조건을 확인합니다.</p></div><div class="v33-photo-grid"><a class="v33-photo-card" href="${BASE}/cost/bathroom/">${photo('bathroom','욕실 인테리어')}<span><em>Bathroom</em>욕실</span></a><a class="v33-photo-card" href="${BASE}/cost/kitchen/">${photo('kitchen','주방 인테리어')}<span><em>Kitchen</em>주방</span></a><a class="v33-photo-card" href="${BASE}/cost/floor/">${photo('floor','실내 바닥 마감')}<span><em>Floor</em>바닥</span></a><a class="v33-photo-card" href="${BASE}/cost/electrical/">${photo('electrical','실내 전기 공사')}<span><em>Electrical</em>전기·조명</span></a></div></section>
<section class="v33-section"><div class="v33-section-head"><h2>견적 보는 순서</h2><p>총액 하나보다 범위와 사양을 먼저 맞춥니다.</p></div><div class="v33-process"><div class="v33-step">${photo('renovation','인테리어 공사 현장')}<b>1. 공사 범위</b><p>철거·폐기물·양중·보양이 어디까지 포함인지 확인합니다.</p></div><div class="v33-step">${photo('framing','목공 골조 공사')}<b>2. 수량·사양</b><p>면적, 수량, 자재 규격이 비어 있지 않은지 봅니다.</p></div><div class="v33-step">${photo('insulation','단열 공사 현장')}<b>3. 공공 참고단가</b><p>민간 총액과 섞지 않고 단위가 맞는 공공 가격만 따로 봅니다.</p></div><div class="v33-step">${photo('kitchen','완성된 주방')}<b>4. 업체 비교</b><p>포함 조건이 같은 항목끼리 업체별 금액을 비교합니다.</p></div></div></section>
</main>`;
const mediaMap={bathroom:['bathroom',['철거 · 폐기물','방수 · 타일','도기 · 수전','공공 참고단가']],kitchen:['kitchen',['가구 · 상판','배관 · 전기','철거 · 폐기물','공공 참고단가']],window:['window',['창 개수','유리 사양','철거 · 양중','시공 범위']],wallpaper:['renovation',['시공 면적','벽지 사양','철거 여부','바탕면']],floor:['floor',['시공 면적','철거 여부','자재 사양','걸레받이']],carpentry:['framing',['천장 · 가벽','몰딩 · 문틀','자재 규격','마감 범위']],insulation:['insulation',['단열재 종류','두께 · 면적','기밀 시공','마감 범위']],electrical:['electrical',['회로','분전반','콘센트','조명']],plumbing:['framing',['급수 · 배수','배관 교체','설비 연결','철거 복구']],demolition:['renovation',['철거 범위','반출 동선','폐기물 처리','장비 · 인력']]};
function classify(p){for(const [k,v] of Object.entries(mediaMap))if(p.includes(`/cost/${k}/`)||p===`cost/${k}/index.html`)return v;if(p.startsWith('interior-cost/'))return ['floor',['평수 조건','공사 범위','욕실 · 주방','샷시 · 마감']];if(p.startsWith('data/'))return ['framing',['공식 출처','단위','게시일','원문']];if(p.startsWith('quote-')||p.startsWith('calculator/')||p.startsWith('compare/'))return ['renovation',['공사 범위','별도 비용','수량 · 단위','자재 사양']];if(p.startsWith('guides/'))return ['framing',['항목','포함 범위','사양','추가 비용']];return ['renovation',['견적 확인','업체 비교','공사별 비용','공식 자료']]}
function titleOf(h){return (h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)||[])[1]?.replace(/<[^>]+>/g,'').trim()||'인테리어 견적'}
function pageMedia(p,h){const [img,items]=classify(p);const title=titleOf(h);return `<section class="v33-page-media"><figure>${photo(img,`${title} 참고 이미지`)}</figure><aside><div><span>CHECK</span><strong>${title}</strong></div><ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul></aside></section>`}
for(const f of walk(ROOT).filter(f=>f.endsWith('.html'))){const p=path.relative(ROOT,f).split(path.sep).join('/');let h=read(p);if(!h.includes('site-v33-stratton-visual.css'))h=h.replace('</head>',`${cssLink}</head>`);h=h.replace(/<body class="([^"]*)"/,(_m,c)=>`<body class="${c} v33-stratton"`);if(!h.includes('class="v33-ticker"'))h=h.replace(/<\/header>/,`</header>${ticker}`);if(p==='index.html'){h=h.replace(/<main id="main-content"[\s\S]*?<\/main>/,home)}else if(!h.includes('v33-page-media')){const media=pageMedia(p,h);if(/<section class="(?:article-hero|tool-hero|v28-hub-title)"/.test(h)){h=h.replace(/(<section class="(?:article-hero|tool-hero|v28-hub-title)"[\s\S]*?<\/section>)/,`$1${media}`)}else h=h.replace(/<main id="main-content">/,`<main id="main-content">${media}`)}write(p,h)}
write('data/v33-stratton-visual.json',JSON.stringify({version:'33.0.0',reference:'stratton.market',visuals:'real interior/construction photography',photos:credits.map(x=>({name:x.name,page_url:x.page_url,license:x.license})),home_image_led:true,detail_media:true,tools_media:true,noindex_preserved:true},null,2));
console.log(JSON.stringify({version:'33.0.0',photos:credits.length,html:walk(ROOT).filter(f=>f.endsWith('.html')).length},null,2));