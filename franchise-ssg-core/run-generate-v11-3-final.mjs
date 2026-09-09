import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v11-2-final.mjs?v113=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const decoderRoute='/tools/disclosure-decoder/';
const decoderPath=path.join(out,'tools/disclosure-decoder/index.html');
const homePath=path.join(out,'index.html');
const toolsPath=path.join(out,'tools/index.html');
const escReg=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

const decoderLink=`<a href="${BASE}${decoderRoute}"><strong>정보공개서 비용 항목 계산</strong><span>가맹비·교육비·보증금·기타비·인테리어를 분리해 합계를 확인합니다.</span></a>`;

let decoder=await fs.readFile(decoderPath,'utf8');
decoder=decoder.replace('<main id="main">','<main id="main" data-v11-tool="disclosure-decoder">');
const liveTool=`<div class="tool-live disclosure-decoder" data-tool="disclosure-decoder">
  <div class="decoder-layout">
    <form class="decoder-form" novalidate>
      <label>가맹비 <span>만원</span><input name="franchise" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0"></label>
      <label>교육비 <span>만원</span><input name="education" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0"></label>
      <label>보증금 <span>만원</span><input name="deposit" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0"></label>
      <label>기타비용 <span>만원</span><input name="etc" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0"></label>
      <label>인테리어 <span>만원</span><input name="interior" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0"></label>
      <div class="decoder-actions"><button class="button" type="submit">입력값 계산</button><button class="button secondary" type="button" data-reset>초기화</button></div>
    </form>
    <section class="decoder-result" aria-live="polite" aria-atomic="true">
      <span class="label">입력 항목 합계</span><b class="decoder-total" data-total>0만원</b>
      <dl>
        <div><dt>가맹금 관련 4개 항목</dt><dd data-franchise-total>0만원</dd></div>
        <div><dt>인테리어 입력액</dt><dd data-interior-total>0만원</dd></div>
        <div><dt>가장 큰 입력항목</dt><dd data-largest>입력 전</dd></div>
      </dl>
      <p>이 결과는 입력한 다섯 항목의 단순 합계입니다. 임대보증금·권리금·철거·전기증설·냉난방·초도물품·운전자금 등이 빠질 수 있으므로 실제 총투자금으로 보지 않습니다.</p>
    </section>
  </div>
  <p class="tool-note">금액은 모두 만원 단위로 입력합니다. 입력값은 브라우저 안에서만 계산하며 서버로 전송하지 않습니다.</p>
</div>`;
decoder=decoder.replace(/<div class="tool-static">[\s\S]*?<\/div>/,liveTool)
  .replace(/해독 결과 = 공개 항목 분류 \+ 계약 확인 항목 \+ 점포별 별도비용 목록/,'입력 합계 = 가맹비 + 교육비 + 보증금 + 기타비용 + 인테리어 입력액')
  .replace(/<section class="block"><h2>기본 계산에서 제외하는 항목<\/h2><ul>[\s\S]*?<\/ul><\/section>/,`<section class="block"><h2>이 계산에 자동으로 포함되지 않는 비용</h2><ul><li>점포 임대보증금과 권리금</li><li>철거·전기증설·냉난방·소방·외부공사</li><li>초도물품과 오픈 초기 운전자금</li><li>원문에서 기타비용에 이미 포함된 항목의 중복 여부</li></ul></section>`);
const decoderScript=`<script>(()=>{const root=document.querySelector('[data-tool="disclosure-decoder"]');if(!root)return;const form=root.querySelector('form');const names=['franchise','education','deposit','etc','interior'];const labels={franchise:'가맹비',education:'교육비',deposit:'보증금',etc:'기타비용',interior:'인테리어'};const read=n=>{const v=Number(form.elements[n].value);return Number.isFinite(v)&&v>0?v:0};const money=v=>v.toLocaleString('ko-KR',{maximumFractionDigits:1})+'만원';const render=()=>{const values=Object.fromEntries(names.map(n=>[n,read(n)]));const franchise=values.franchise+values.education+values.deposit+values.etc;const total=franchise+values.interior;const largest=names.reduce((a,n)=>values[n]>values[a]?n:a,names[0]);root.querySelector('[data-total]').textContent=money(total);root.querySelector('[data-franchise-total]').textContent=money(franchise);root.querySelector('[data-interior-total]').textContent=money(values.interior);root.querySelector('[data-largest]').textContent=total>0?labels[largest]+' · '+money(values[largest]):'입력 전'};form.addEventListener('submit',e=>{e.preventDefault();render()});form.addEventListener('input',render);root.querySelector('[data-reset]').addEventListener('click',()=>{form.reset();render()});render()})();</script>`;
if(!decoder.includes('data-franchise-total'))throw new Error('Disclosure decoder live form injection failed');
decoder=decoder.replace('</body>',`${decoderScript}</body>`);
await fs.writeFile(decoderPath,decoder,'utf8');

for(const file of [homePath,toolsPath]){
  let html=await fs.readFile(file,'utf8');
  if(!html.includes(`${BASE}${decoderRoute}`)){
    const anchor=file===homePath?`${BASE}/tools/monthly-profit-simulator/`:`${BASE}/tools/startup-cost/`;
    const re=new RegExp(`(<a href="${escReg(anchor)}">[\\s\\S]*?<\\/a>)`);
    html=html.replace(re,`$1${decoderLink}`);
  }
  await fs.writeFile(file,html,'utf8');
}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.3 disclosure decoder */')){
  css+=`\n/* v11.3 disclosure decoder */\n.tool-live{margin:24px 0 30px}.decoder-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:24px;align-items:start}.decoder-form{display:grid;grid-template-columns:1fr 1fr;gap:14px}.decoder-form label{display:grid;grid-template-columns:1fr auto;gap:7px 10px;font-weight:700}.decoder-form label span{font-size:12px;color:#6b645c;align-self:end}.decoder-form input{grid-column:1/-1;width:100%;min-height:46px;border:1px solid #cfc7bb;background:#fff;padding:10px 12px;font:inherit}.decoder-form input:focus{outline:2px solid #2457d6;outline-offset:1px}.decoder-actions{grid-column:1/-1;display:flex;gap:9px;margin-top:4px}.decoder-result{border-top:3px solid #1c1916;padding:18px 0 0}.decoder-result>.label{display:block;font-size:13px;color:#6b645c}.decoder-total{display:block;font-size:34px;letter-spacing:-1px;margin:4px 0 18px}.decoder-result dl{margin:0}.decoder-result dl div{display:flex;justify-content:space-between;gap:18px;padding:11px 0;border-top:1px solid #e6dfd4}.decoder-result dt{color:#6b645c}.decoder-result dd{margin:0;font-weight:700;text-align:right}.decoder-result p,.tool-note{font-size:13px;line-height:1.65;color:#6b645c}.tool-note{margin-top:12px}@media(max-width:720px){.decoder-layout{grid-template-columns:1fr}.decoder-form{grid-template-columns:1fr}.decoder-actions{position:static}.decoder-total{font-size:30px}}\n`;
  await fs.writeFile(cssPath,css,'utf8');
}

const v11Path=path.join(out,'v11-quality-report.json');
const v11=JSON.parse(await fs.readFile(v11Path,'utf8'));
const productionUrls=new Set(v11.indexPolicy?.productionCandidateUrls||[]);
productionUrls.add(decoderRoute);
v11.indexPolicy.productionCandidateUrls=[...productionUrls].sort();
v11.qualityPolicy.tools='startup-cost, monthly-profit-simulator, and disclosure-decoder are production candidates; remaining tools stay noindex until they truly work';
await fs.writeFile(v11Path,JSON.stringify(v11,null,2),'utf8');

const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const manifestUrls=new Set(manifest.indexPolicy?.productionCandidateUrls||[]);
manifestUrls.add(decoderRoute);
const finalUrls=[...manifestUrls].sort();
manifest.uiVersion='11.3';
manifest.v11_3={liveDisclosureDecoder:true,productionToolCandidates:3};
manifest.indexPolicy={...(manifest.indexPolicy||{}),productionCandidates:finalUrls.length,productionCandidateUrls:finalUrls};
const htmlFiles=[];async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p)}}await walk(out);
manifest.environmentPolicy={...(manifest.environmentPolicy||{}),indexedHtml:PREVIEW?0:finalUrls.length,noindexHtml:htmlFiles.length-(PREVIEW?0:finalUrls.length),productionCandidateCount:finalUrls.length,productionFailsIfCandidateNoindex:true};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

if(!PREVIEW){
  let html=await fs.readFile(decoderPath,'utf8');
  html=html.replace(/<meta name="robots" content="[^"]*">/,'<meta name="robots" content="index,follow">').replace(/<meta name="googlebot" content="[^"]*">/,'<meta name="googlebot" content="index,follow">').replace(/<meta name="bingbot" content="[^"]*">/,'<meta name="bingbot" content="index,follow">');
  await fs.writeFile(decoderPath,html,'utf8');
  const lastmod=JSON.parse(await fs.readFile(path.join(here,'operator-opening-costs.json'),'utf8')).generatedAt||new Date().toISOString().slice(0,10);
  const urls=finalUrls.map(r=>`<url><loc>${SITE}${r==='/'?'':r}</loc><lastmod>${lastmod}</lastmod></url>`).join('');
  await fs.writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,'utf8');
}

const base=JSON.parse(await fs.readFile(path.join(out,'v11-2-quality-report.json'),'utf8'));
const report={schemaVersion:1,generatedAt:new Date().toISOString(),uiVersion:'11.3',previewMode:PREVIEW,productionCandidates:finalUrls.length,strictEligibleBrands:base.strictEligibleBrands,operatorOpeningCostCoverage:base.operatorOpeningCostCoverage,productionTools:['/tools/startup-cost/','/tools/monthly-profit-simulator/',decoderRoute],disclosureDecoder:{live:true,clientOnly:true,inputUnit:'만원',fields:['가맹비','교육비','보증금','기타비용','인테리어']},remainingProductionBlockers:base.remainingProductionBlockers};
await fs.writeFile(path.join(out,'v11-3-quality-report.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_3:'PASS',productionCandidates:report.productionCandidates,productionTools:report.productionTools.length,operatorOpeningCostCoverage:report.operatorOpeningCostCoverage},null,2));
