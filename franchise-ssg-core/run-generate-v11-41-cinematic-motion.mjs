import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const cssPath=path.join(out,'assets/site.css');
const jsPath=path.join(out,'assets/v41-motion.js');
const manifestPath=path.join(out,'route-manifest.json');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const start='/* v11.41 cinematic motion */', end='/* v11.41 cinematic motion end */';

const PHOTO={
  cafe:'https://images.unsplash.com/photo-1765472992935-3a5b35d592fc?auto=format&fit=crop&w=2200&q=82',
  food:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2200&q=82',
  work:'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=2200&q=82',
  salon:'https://images.unsplash.com/photo-1781450090585-1a511b7066d9?auto=format&fit=crop&w=2200&q=82'
};
const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
const routeFor=file=>{const rel=path.relative(out,path.dirname(file)).replaceAll(path.sep,'/');return rel?`/${rel}/`:'/'};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const textOf=(html,re)=>{const m=html.match(re);return m?m[1].replace(/<[^>]+>/g,'').trim():''};
function photoFor(route,html){
  const category=textOf(html,/<div class="brand-category">([\s\S]*?)<\/div>/i)||textOf(html,/<div class="v25-cathead">[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)||textOf(html,/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if(/헤어|미용|뷰티/.test(category))return PHOTO.salon;
  if(/카페|커피|베이커리|디저트|주점|맥주/.test(category))return PHOTO.cafe;
  if(/편의점|스터디|교육|영어|세탁|자동차|펫|반려|서비스/.test(category))return PHOTO.work;
  return PHOTO.food;
}
function bodyPatch(html){
  let next=html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{
    let a=attrs||'';
    if(/\bclass="[^"]*"/i.test(a))a=a.replace(/\bclass="([^"]*)"/i,(m,c)=>`class="${[...new Set([...c.split(/\s+/).filter(Boolean),'v41-cinematic-ui'])].join(' ')}"`);
    else a=` class="v41-cinematic-ui"${a}`;
    if(!/data-v41-cinematic=/i.test(a))a+=' data-v41-cinematic="1"';
    return `<body${a}>`;
  });
  if(!next.includes('data-v41-scroll-progress'))next=next.replace(/<body\b[^>]*>/i,m=>`${m}<div class="v41-scroll-progress" data-v41-scroll-progress aria-hidden="true"><i></i></div>`);
  if(!next.includes('v41-global-tape'))next=next.replace(/<\/header>/i,`</header><div class="v41-global-tape" aria-hidden="true"><div><span>FRANCHISE DATA</span><b>창업비용</b><span>STORE COUNT</span><b>가맹점</b><span>SALES DISCLOSURE</span><b>평균매출</b><span>PUBLIC DATA</span><b>공개자료</b><span>FRANCHISE DATA</span><b>창업비용</b><span>STORE COUNT</span><b>가맹점</b></div></div>`);
  if(!next.includes('/assets/v41-motion.js'))next=next.replace('</body>','<script defer src="/pm-lab/franchise-ssg-preview/assets/v41-motion.js"></script></body>');
  return next;
}
function orbit(){return '<div class="v41-orbit" aria-hidden="true"><i></i><i></i><b></b><span>DATA / FIELD / 2025</span></div>'}
function homePatch(html){
  if(!html.includes('<section class="v25-head">')||html.includes('v41-home-hero'))return html;
  let next=html.replace('<section class="v25-head">','<section class="v41-home-hero" data-v41-hero><div class="v41-home-copy"><div class="v41-kicker">KOREA · FRANCHISE INTELLIGENCE</div><section class="v25-head">');
  const close='</section><section class="v25-sec">';
  const pos=next.indexOf(close);
  if(pos>=0){
    const media=`</section></div><div class="v41-home-media" data-v41-parallax><figure class="v41-shot v41-shot-main"><img src="${PHOTO.cafe}" alt="야간 상권의 매장 외관" fetchpriority="high" decoding="async"></figure><figure class="v41-shot v41-shot-inset"><img src="${PHOTO.food}" alt="운영 중인 외식 매장 내부" loading="lazy" decoding="async"></figure>${orbit()}<div class="v41-frame-label"><b>01</b><span>FIELD / COST / SALES</span></div></div></section><section class="v41-photo-break" data-v41-reveal><div class="v41-break-photo" data-v41-parallax><img src="${PHOTO.food}" alt="창업 업종을 보여주는 매장 공간" loading="lazy" decoding="async"></div><div class="v41-break-type" aria-hidden="true"><span>COMPARE</span><b>REAL DATA</b><span>BEFORE OPENING</span></div></section><section class="v25-sec">`;
    next=next.slice(0,pos)+media+next.slice(pos+close.length);
  }
  return next;
}
function brandPatch(html,route){
  if(!/class="[^"]*v25-brand/.test(html)||html.includes('v41-detail-hero'))return html;
  const photo=photoFor(route,html), name=textOf(html,/<header class="brand-header">[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)||'브랜드';
  html=html.replace('<article><header class="brand-header">',`<article><section class="v41-detail-hero" data-v41-hero><div class="v41-detail-photo" data-v41-parallax><img src="${photo}" alt="${esc(name)} 업종을 연상시키는 실제 매장 공간" fetchpriority="high" decoding="async"></div><div class="v41-detail-wash"></div>${orbit()}<div class="v41-detail-index" aria-hidden="true">BRAND / 2025 / PUBLIC DISCLOSURE</div><header class="brand-header">`);
  const marker='</header><section id="answer"';
  const at=html.indexOf(marker);
  if(at>=0)html=html.slice(0,at)+`</header><div class="v41-scroll-cue" aria-hidden="true"><i></i><span>SCROLL TO DATA</span></div></section><section id="answer"`+html.slice(at+marker.length);
  return html;
}
function categoryPatch(html,route){
  if(!/class="[^"]*v25-category/.test(html)||html.includes('v41-category-scene'))return html;
  const photo=photoFor(route,html), title=textOf(html,/<div class="v25-cathead">[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)||'업종 데이터';
  const scene=`<section class="v41-category-scene" data-v41-hero><div class="v41-category-photo" data-v41-parallax><img src="${photo}" alt="${esc(title)} 업종의 실제 사업 공간" fetchpriority="high" decoding="async"></div><div class="v41-category-shade"></div><div class="v41-category-type" aria-hidden="true"><span>SECTOR</span><b>${esc(title)}</b><em>PUBLIC DATA / 2025</em></div>${orbit()}</section>`;
  return html.replace(/(<nav class="crumbs"[\s\S]*?<\/nav>)/i,`$1${scene}`);
}
function genericPatch(html,route){
  if(route==='/'||/class="[^"]*v25-brand/.test(html)||/class="[^"]*v25-category/.test(html)||html.includes('v41-generic-scene'))return html;
  const title=textOf(html,/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if(!title)return html;
  const photo=photoFor(route,html);
  const scene=`<section class="v41-generic-scene" data-v41-reveal><div class="v41-generic-photo" data-v41-parallax><img src="${photo}" alt="창업 데이터 분석을 위한 실제 사업 공간" loading="eager" decoding="async"></div><div class="v41-generic-copy" aria-hidden="true"><span>DATA TOOL / RESEARCH</span><b>${esc(title)}</b></div>${orbit()}</section>`;
  if(/<nav class="crumbs"/i.test(html))return html.replace(/(<nav class="crumbs"[\s\S]*?<\/nav>)/i,`$1${scene}`);
  return html.replace(/<main\b([^>]*)>/i,m=>`${m}${scene}`);
}

let patched=0,brandHeroes=0,categoryScenes=0,genericScenes=0;
for(const file of htmlFiles){
  const route=routeFor(file); let html=await fs.readFile(file,'utf8'), next=bodyPatch(html);
  if(route==='/')next=homePatch(next);
  const beforeBrand=next; next=brandPatch(next,route); if(next!==beforeBrand)brandHeroes++;
  const beforeCat=next; next=categoryPatch(next,route); if(next!==beforeCat)categoryScenes++;
  const beforeGen=next; next=genericPatch(next,route); if(next!==beforeGen)genericScenes++;
  if(next!==html){await fs.writeFile(file,next,'utf8');patched++;}
}

let css=await fs.readFile(cssPath,'utf8');
css=css.replace(new RegExp('/\\* v11\\.41 cinematic motion \\*/[\\s\\S]*?/\\* v11\\.41 cinematic motion end \\*/','g'),'').trimEnd();
const cinematic=String.raw`
${start}
body.v41-cinematic-ui{--v41-accent:#caff38;--v41-black:#070807;--v41-ink:#f3f4ee;--v41-dim:#90978f;background:#070807;overflow-x:hidden}
body.v41-cinematic-ui .shell{width:min(1480px,calc(100% - 56px))}
.v41-scroll-progress{position:fixed;top:0;left:0;right:0;height:2px;z-index:120;pointer-events:none}.v41-scroll-progress i{display:block;width:0;height:100%;background:#caff38;box-shadow:0 0 18px rgba(202,255,56,.55)}
.v41-global-tape{height:32px;overflow:hidden;border-bottom:1px solid #202520;background:#080a08;color:#7d857e;white-space:nowrap}.v41-global-tape>div{width:max-content;display:flex;align-items:center;gap:28px;height:100%;animation:v41-marquee 24s linear infinite;font:10px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.1em}.v41-global-tape b{color:#caff38;font-weight:700}.v41-global-tape span{color:#5f675f}
@keyframes v41-marquee{to{transform:translateX(-50%)}}
.v41-home-hero{position:relative;min-height:calc(100svh - 100px);display:grid;grid-template-columns:minmax(0,1.04fr) minmax(420px,.96fr);border-bottom:1px solid #252c25;background:#070807;overflow:hidden}
.v41-home-copy{display:flex;align-items:center;padding:72px max(28px,calc((100vw - 1480px)/2)) 64px max(28px,calc((100vw - 1480px)/2));padding-right:42px;position:relative;z-index:4}.v41-home-copy>.v41-kicker{position:absolute;top:36px;left:max(28px,calc((100vw - 1480px)/2));font:10px/1.2 ui-monospace,monospace;letter-spacing:.15em;color:#899088}.v41-home-copy .v25-head{width:100%;padding:0;border:0;margin:0}.v41-home-copy .v25-head h1{max-width:720px;font-size:clamp(64px,7vw,116px);line-height:.82;letter-spacing:-.075em;text-transform:uppercase}.v41-home-copy .v25-search{margin-top:34px;max-width:720px}.v41-home-copy .v25-rail{margin-top:34px;border-top-color:#343b34;border-bottom-color:#343b34}.v41-home-media{position:relative;min-height:620px;overflow:hidden;background:#111}.v41-home-media::after,.v41-detail-photo::after,.v41-category-photo::after,.v41-generic-photo::after,.v41-break-photo::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(7,8,7,.04),rgba(7,8,7,.14) 54%,rgba(7,8,7,.66)),repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 4px);mix-blend-mode:multiply}.v41-shot{position:absolute;margin:0;overflow:hidden;background:#151815}.v41-shot img,.v41-detail-photo img,.v41-category-photo img,.v41-generic-photo img,.v41-break-photo img{width:100%;height:100%;object-fit:cover;display:block;transform:scale(1.035);transition:transform 1.2s cubic-bezier(.2,.7,.2,1);filter:saturate(.78) contrast(1.08)}.v41-shot-main{inset:0;clip-path:polygon(8% 0,100% 0,100% 100%,0 100%,0 10%)}.v41-shot-inset{left:5%;bottom:7%;width:39%;height:27%;z-index:3;border:1px solid rgba(255,255,255,.44);box-shadow:0 22px 60px rgba(0,0,0,.35)}.v41-shot-inset img{filter:grayscale(.25) contrast(1.12)}.v41-frame-label{position:absolute;right:24px;bottom:22px;z-index:5;display:flex;gap:12px;align-items:center;color:#fff;font:10px/1 ui-monospace,monospace;letter-spacing:.1em}.v41-frame-label b{font-size:22px;color:#caff38}.v41-orbit{position:absolute;width:210px;height:210px;right:7%;top:10%;z-index:5;border:1px solid rgba(202,255,56,.45);border-radius:50%;mix-blend-mode:screen;animation:v41-float 5s ease-in-out infinite}.v41-orbit i,.v41-orbit b{position:absolute;inset:18px;border:1px solid rgba(255,255,255,.24);border-radius:50%;animation:v41-spin 13s linear infinite}.v41-orbit i:nth-child(2){inset:48px;border-color:rgba(202,255,56,.75);animation-direction:reverse;animation-duration:8s}.v41-orbit b{inset:92px;background:#caff38;border:0;box-shadow:0 0 24px rgba(202,255,56,.55)}.v41-orbit i::after{content:"";position:absolute;width:8px;height:8px;background:#caff38;border-radius:50%;top:-4px;left:50%}.v41-orbit span{position:absolute;left:50%;top:calc(100% + 10px);transform:translateX(-50%);white-space:nowrap;color:#caff38;font:9px/1 ui-monospace,monospace;letter-spacing:.12em}
@keyframes v41-spin{to{transform:rotate(360deg)}}@keyframes v41-float{50%{transform:translateY(-12px)}}
.v41-photo-break{position:relative;width:100vw;margin-left:calc(50% - 50vw);height:min(68vw,720px);min-height:520px;overflow:hidden;border-bottom:1px solid #262d27}.v41-break-photo{position:absolute;inset:0}.v41-break-photo img{filter:grayscale(.15) saturate(.68) contrast(1.08)}.v41-break-type{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 max(28px,calc((100vw - 1480px)/2));z-index:3;color:#fff;text-transform:uppercase;pointer-events:none}.v41-break-type span,.v41-break-type b{font-size:clamp(48px,10vw,150px);font-weight:780;line-height:.77;letter-spacing:-.075em}.v41-break-type b{color:#caff38;margin-left:9vw}.v41-break-type span:last-child{margin-left:18vw;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.78)}
.v41-detail-hero{position:relative;width:100vw;margin-left:calc(50% - 50vw);min-height:min(76svh,820px);overflow:hidden;border-top:1px solid #252b25;border-bottom:1px solid #252b25;background:#0b0d0b}.v41-detail-photo{position:absolute;inset:0}.v41-detail-photo img{filter:saturate(.58) contrast(1.15);transform:scale(1.06)}.v41-detail-wash{position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,8,7,.94) 0%,rgba(7,8,7,.74) 36%,rgba(7,8,7,.22) 72%,rgba(7,8,7,.12) 100%),linear-gradient(0deg,rgba(7,8,7,.72),transparent 45%);z-index:2}.v41-detail-hero .brand-header{position:relative;z-index:4;width:min(1480px,calc(100% - 56px));margin:0 auto;padding:30vh 0 36px;border:0}.v41-detail-hero .brand-header-main{align-items:end}.v41-detail-hero .brand-category{color:#caff38;font:10px/1 ui-monospace,monospace;letter-spacing:.13em;text-transform:uppercase}.v41-detail-hero .brand-header h1{font-size:clamp(62px,9.5vw,138px);line-height:.82;letter-spacing:-.075em;max-width:1040px;margin-top:14px;text-shadow:0 10px 40px rgba(0,0,0,.28)}.v41-detail-hero .meta-line{margin-top:22px;color:#b8beb7}.v41-detail-hero .meta-line b{color:#fff}.v41-detail-hero .brand-actions .button{backdrop-filter:blur(10px)}.v41-detail-hero .brand-toc{margin-top:30px;border-color:rgba(255,255,255,.2)}.v41-detail-hero .brand-toc a{color:#b4bbb4}.v41-detail-index{position:absolute;left:max(28px,calc((100vw - 1480px)/2));top:30px;z-index:4;color:#7e877f;font:9px/1 ui-monospace,monospace;letter-spacing:.14em}.v41-detail-hero>.v41-orbit{top:12%;right:8%}.v41-scroll-cue{position:absolute;right:max(28px,calc((100vw - 1480px)/2));bottom:30px;z-index:5;display:flex;align-items:center;gap:10px;color:#aeb5ae;font:9px/1 ui-monospace,monospace;letter-spacing:.12em}.v41-scroll-cue i{width:44px;height:1px;background:#caff38;position:relative;overflow:hidden}.v41-scroll-cue i::after{content:"";position:absolute;inset:0;background:#fff;animation:v41-scan 1.8s ease-in-out infinite}@keyframes v41-scan{0%{transform:translateX(-100%)}100%{transform:translateX(120%)}}
body.v41-cinematic-ui.v25-brand .v35-kpis{position:relative;z-index:6;margin-top:-42px;border:1px solid #343c35;background:rgba(8,10,8,.9);backdrop-filter:blur(18px)}body.v41-cinematic-ui.v25-brand .v35-kpis>div{min-height:112px;padding-top:20px;padding-bottom:20px}body.v41-cinematic-ui.v25-brand .v35-kpis strong{font-size:clamp(22px,2.3vw,34px)}
.v41-category-scene{position:relative;width:100vw;margin-left:calc(50% - 50vw);height:min(58svh,660px);min-height:430px;overflow:hidden;background:#101310;border-bottom:1px solid #272d27}.v41-category-photo{position:absolute;inset:0}.v41-category-photo img{filter:saturate(.62) contrast(1.12)}.v41-category-shade{position:absolute;inset:0;z-index:2;background:linear-gradient(90deg,rgba(7,8,7,.92),rgba(7,8,7,.48) 52%,rgba(7,8,7,.12)),linear-gradient(0deg,rgba(7,8,7,.6),transparent 55%)}.v41-category-type{position:absolute;left:max(28px,calc((100vw - 1480px)/2));bottom:48px;right:28px;z-index:4;display:grid;gap:8px}.v41-category-type span,.v41-category-type em{color:#caff38;font:10px/1 ui-monospace,monospace;letter-spacing:.14em;font-style:normal}.v41-category-type b{font-size:clamp(64px,11vw,160px);line-height:.78;letter-spacing:-.08em;color:#fff}.v41-category-scene>.v41-orbit{right:8%;top:12%}body.v41-cinematic-ui.v25-category .v25-cathead{position:relative;z-index:5;margin-top:-1px;padding:26px 0 20px;border-bottom:1px solid #343b34}body.v41-cinematic-ui.v25-category .v25-cathead h1{font-size:18px;letter-spacing:-.02em;color:#aeb6ae}
.v41-generic-scene{position:relative;width:100vw;margin-left:calc(50% - 50vw);height:min(42svh,460px);min-height:320px;overflow:hidden;border-bottom:1px solid #262d27;background:#0d100d}.v41-generic-photo{position:absolute;inset:0}.v41-generic-photo img{filter:grayscale(.2) saturate(.55) contrast(1.1)}.v41-generic-scene::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,8,7,.94),rgba(7,8,7,.56) 58%,rgba(7,8,7,.18));z-index:2}.v41-generic-copy{position:absolute;z-index:4;left:max(28px,calc((100vw - 1480px)/2));bottom:36px;right:28px;display:grid;gap:12px}.v41-generic-copy span{color:#caff38;font:9px/1 ui-monospace,monospace;letter-spacing:.14em}.v41-generic-copy b{max-width:1080px;font-size:clamp(46px,7vw,96px);line-height:.86;letter-spacing:-.065em;color:#fff}.v41-generic-scene>.v41-orbit{right:9%;top:10%}
body.v41-motion-enabled .v35-panel,body.v41-motion-enabled .block,body.v41-motion-enabled .v25-sec,body.v41-motion-enabled .v39-evidence,body.v41-motion-enabled .v41-photo-break,body.v41-motion-enabled .v41-generic-scene{opacity:0;transform:translateY(34px);transition:opacity .72s ease,transform .9s cubic-bezier(.2,.7,.2,1)}body.v41-motion-enabled .v41-visible{opacity:1;transform:none}.v35-cost-stack i,.v25-bar i b,.v26-area-row i b,.v34-bar i{transform-origin:left center;transition:transform .95s cubic-bezier(.2,.7,.2,1)}body.v41-motion-enabled .v35-panel:not(.v41-visible) .v35-cost-stack i,body.v41-motion-enabled .v25-sec:not(.v41-visible) .v25-bar i b,body.v41-motion-enabled .block:not(.v41-visible) .v26-area-row i b{transform:scaleX(0)}body.v41-motion-enabled .v41-visible svg circle{animation:v41-dot .52s cubic-bezier(.2,.8,.2,1) both;transform-box:fill-box;transform-origin:center}@keyframes v41-dot{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
body.v41-cinematic-ui .site-header{transition:min-height .25s ease,background .25s ease}body.v41-scrolled .site-header{background:rgba(7,8,7,.93);box-shadow:0 12px 28px rgba(0,0,0,.2)}body.v41-scrolled .header-inner{min-height:56px}body.v41-scrolled .site-header nav a{min-height:56px}
@media(max-width:980px){body.v41-cinematic-ui .shell{width:min(100% - 36px,1480px)}.v41-home-hero{grid-template-columns:1fr;min-height:auto}.v41-home-copy{padding:72px 24px 40px}.v41-home-copy>.v41-kicker{left:24px}.v41-home-copy .v25-head h1{font-size:clamp(58px,13vw,96px)}.v41-home-media{min-height:54svh}.v41-shot-inset{width:36%;height:31%}.v41-detail-hero{min-height:70svh}.v41-detail-hero .brand-header{width:calc(100% - 36px);padding-top:28svh}.v41-detail-hero .brand-header-main{grid-template-columns:1fr}.v41-detail-hero .brand-actions{justify-content:flex-start}.v41-detail-hero .brand-header h1{font-size:clamp(58px,13vw,104px)}.v41-category-type{left:18px}.v41-generic-copy{left:18px}.v41-orbit{width:150px;height:150px}.v41-orbit b{inset:66px}.v41-orbit i:nth-child(2){inset:36px}.v41-photo-break{height:64svh}}
@media(max-width:620px){.v41-global-tape{height:28px}.v41-home-copy{padding-top:60px}.v41-home-copy .v25-head h1{font-size:clamp(50px,18vw,78px)}.v41-home-copy .v25-search{grid-template-columns:1fr 82px}.v41-home-copy .v25-rail{display:grid;grid-template-columns:1fr 1fr;overflow:visible}.v41-home-copy .v25-rail>div{min-width:0;border-right:1px solid #262d27}.v41-home-media{min-height:48svh}.v41-shot-inset{display:none}.v41-orbit{width:118px;height:118px;right:18px;top:18px}.v41-orbit i{inset:12px}.v41-orbit i:nth-child(2){inset:28px}.v41-orbit b{inset:51px}.v41-orbit span{display:none}.v41-photo-break{min-height:460px}.v41-break-type span,.v41-break-type b{font-size:clamp(42px,15vw,72px)}.v41-detail-hero{min-height:72svh}.v41-detail-wash{background:linear-gradient(0deg,rgba(7,8,7,.94),rgba(7,8,7,.25) 72%)}.v41-detail-hero .brand-header{padding-top:34svh;padding-bottom:46px}.v41-detail-hero .brand-header h1{font-size:clamp(54px,17vw,82px)}.v41-detail-hero .brand-toc nav{gap:14px}.v41-detail-hero>.v41-orbit{top:26px;right:18px}.v41-scroll-cue{display:none}body.v41-cinematic-ui.v25-brand .v35-kpis{margin-top:-18px;grid-template-columns:1fr 1fr}.v41-category-scene{height:54svh;min-height:390px}.v41-category-type b{font-size:clamp(54px,17vw,90px)}.v41-generic-scene{height:40svh;min-height:300px}.v41-generic-copy b{font-size:clamp(40px,12vw,62px)}}
@media(prefers-reduced-motion:reduce){.v41-global-tape>div,.v41-orbit,.v41-orbit i,.v41-scroll-cue i::after{animation:none!important}.v41-shot img,.v41-detail-photo img,.v41-category-photo img,.v41-generic-photo img,.v41-break-photo img{transform:none!important;transition:none!important}body.v41-motion-enabled .v35-panel,body.v41-motion-enabled .block,body.v41-motion-enabled .v25-sec,body.v41-motion-enabled .v39-evidence,body.v41-motion-enabled .v41-photo-break,body.v41-motion-enabled .v41-generic-scene{opacity:1!important;transform:none!important;transition:none!important}}
${end}`;
await fs.writeFile(cssPath,`${css}\n\n${cinematic}\n`,'utf8');

const motion=String.raw`(()=>{const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;const body=document.body;const progress=document.querySelector('[data-v41-scroll-progress] i');const update=()=>{const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);if(progress)progress.style.width=Math.min(100,scrollY/max*100)+'%';body.classList.toggle('v41-scrolled',scrollY>48)};addEventListener('scroll',update,{passive:true});update();if(reduce)return;body.classList.add('v41-motion-enabled');const targets=[...document.querySelectorAll('[data-v41-reveal],.v35-panel,.block,.v25-sec,.v39-evidence')];const seen=new WeakSet();const animateKpis=root=>{root.querySelectorAll?.('[data-v35-kpi][data-v35-value] strong').forEach(el=>{const box=el.closest('[data-v35-kpi]');const target=Number(box?.dataset.v35Value);if(!Number.isFinite(target)||seen.has(el))return;seen.add(el);const original=el.textContent;const suffix=original.replace(/[\d,.-]+/g,'').trim();const decimals=Math.abs(target)%1?1:0;const t0=performance.now(),dur=760;const tick=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3),v=target*e;el.textContent=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:decimals}).format(v)+(suffix?' '+suffix:'');if(p<1)requestAnimationFrame(tick);else el.textContent=original};requestAnimationFrame(tick)})};const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('v41-visible');animateKpis(e.target);io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -8%'});targets.forEach(t=>io.observe(t));const hero=document.querySelector('[data-v41-hero]');if(hero)animateKpis(hero);if(matchMedia('(pointer:fine)').matches){document.querySelectorAll('[data-v41-parallax]').forEach(node=>{const img=node.querySelector('img');if(!img)return;node.addEventListener('pointermove',e=>{const r=node.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;img.style.transform='scale(1.07) translate('+(-x*10)+'px,'+(-y*10)+'px)'},{passive:true});node.addEventListener('pointerleave',()=>{img.style.transform=''},{passive:true})})}})();`;
await fs.writeFile(jsPath,motion,'utf8');

const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.41';manifest.v11_41={cinematicLayout:true,photography:true,motionGraphics:true,scrollReveal:true,parallax:true,globalHtmlCoverage:htmlFiles.length,brandHeroes,categoryScenes,genericScenes,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,productionDeployed:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
const report={schemaVersion:1,uiVersion:'11.41',generatedAt:new Date().toISOString(),reference:'https://stratton.market/',scope:'STRUCTURAL_LAYOUT_PHOTOGRAPHY_MOTION',allHtmlPages:htmlFiles.length,patchedHtmlPages:patched,brandHeroes,categoryScenes,genericScenes,candidatePages:candidates.length,photoSources:['Unsplash free-use photography'],motion:['marquee','orbit graphic','scroll progress','intersection reveal','chart/bar reveal','KPI count-up','pointer parallax'],retained:['trusted official data semantics','v11.39 evidence','v11.38 mobile safeguards','preview noindex','184 candidate set'],productionDeployed:false};
await fs.writeFile(path.join(out,'v11-41-cinematic-motion.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
