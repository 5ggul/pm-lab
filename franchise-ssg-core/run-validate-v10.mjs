import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const BASE='/pm-lab/franchise-ssg-preview';
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v10-quality-report.json'),'utf8'));
if(manifest.uiVersion!==10)throw new Error(`Expected uiVersion 10, got ${manifest.uiVersion}`);
if(manifest.dataMode!=='FTC_OFFICIAL_MATCHED_ONLY')throw new Error(`Unexpected dataMode ${manifest.dataMode}`);
if(manifest.officialPresentation?.syntheticFallback!==false)throw new Error('Synthetic fallback must be false');
if(quality.official?.records<10000)throw new Error('Official snapshot coverage unexpectedly low');
if(quality.indexPolicy?.brandIndexCandidates<20)throw new Error('Too few quality-gated brand candidates');

const files=[];async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}await walk(out);
if(files.length<277)throw new Error(`HTML coverage regressed: ${files.length}`);
const titles=new Map(),broken=[],badCss=[],badRobots=[],multipleH1=[],badVisible=[];
for(const f of files){const h=await fs.readFile(f,'utf8');const rel=path.relative(out,f);const css=[...h.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(x=>x[1]);if(css.length!==1||!css[0].endsWith('/assets/site.css'))badCss.push(`${rel}:${css.join(',')}`);if(!h.includes('noindex,nofollow,noarchive,nosnippet'))badRobots.push(rel);const t=h.match(/<title>([^<]+)<\/title>/)?.[1];if(t){if(titles.has(t))throw new Error(`Duplicate title: ${t} (${titles.get(t)}, ${rel})`);titles.set(t,rel)}const h1=(h.match(/<h1(?:\s|>)/g)||[]).length;if(h1>1)multipleH1.push(`${rel}:${h1}`);const body=h.split('<body>')[1]||h;if(/>\s*(?:undefined|NaN|null)\s*</.test(body))badVisible.push(rel);for(const m of h.matchAll(/href="([^"]+)"/g)){let href=m[1];if(!href.startsWith(BASE))continue;href=href.slice(BASE.length).split('#')[0].split('?')[0];try{href=decodeURIComponent(href)}catch{}const target=href===''||href==='/'?path.join(out,'index.html'):href.endsWith('/')?path.join(out,href.replace(/^\//,''),'index.html'):path.join(out,href.replace(/^\//,''));try{await fs.stat(target)}catch{broken.push(`${rel} -> ${m[1]}`)}}}
if(badCss.length)throw new Error(`Unified CSS coverage failed: ${badCss.slice(0,10).join(' | ')}`);
if(badRobots.length)throw new Error(`Preview noindex missing: ${badRobots.slice(0,10).join(' | ')}`);
if(multipleH1.length)throw new Error(`Multiple H1: ${multipleH1.slice(0,10).join(' | ')}`);
if(badVisible.length)throw new Error(`Visible null/undefined/NaN: ${badVisible.slice(0,10).join(' | ')}`);
if(broken.length)throw new Error(`Broken internal links: ${broken.slice(0,12).join(' | ')}`);

const css=await fs.readFile(path.join(out,'assets','site.css'),'utf8');
if(/\.data-table\s+th\s*\{[^}]*position\s*:\s*sticky/i.test(css))throw new Error('Broad .data-table th sticky rule detected');
if(!/\.data-table\s+thead\s+th\s*\{[^}]*position\s*:\s*sticky/i.test(css))throw new Error('Scoped thead sticky rule missing');
if(!/\.data-table\s+tbody\s+th\s*\{[^}]*position\s*:\s*static/i.test(css))throw new Error('tbody th static containment missing');
for(const banned of ['linear-gradient(','radial-gradient(','font-family:Georgia','Noto Serif'])if(css.includes(banned))throw new Error(`Legacy visual pattern remains in active CSS: ${banned}`);
for(const old of ['v7.css','v8.css','v9.css']){try{await fs.stat(path.join(out,'assets',old));throw new Error(`Legacy CSS output still exists: ${old}`)}catch(e){if(!String(e.message).includes('ENOENT')&&!String(e.message).includes('Legacy CSS output'))throw e;if(String(e.message).includes('Legacy CSS output'))throw e}}

const read=async rel=>fs.readFile(path.join(out,rel,'index.html'),'utf8');
const keyRels=['','brands','brands/mega-mgc-coffee','brands/compose-coffee','categories/cafe','compare/mega-mgc-coffee-vs-compose-coffee','tools','tools/startup-cost','tools/monthly-profit-simulator','guide/low-price-coffee','sources','methodology','about','privacy','terms','disclaimer','contact','updates'];
const decorative=['FRANCHISE DATA DIRECTORY','FRANCHISE SCREENER','SIDE BY SIDE','CALCULATOR','>DATABASE<','>TOOLS<','>COMPARE<'];
for(const rel of keyRels){const h=await read(rel);for(const word of decorative)if(h.includes(word))throw new Error(`${rel||'home'} retains decorative English: ${word}`);if(h.includes('공식 데이터 연결 전')||h.includes('프리뷰 수치')||h.includes('SYNTHETIC_STRUCTURE_PREVIEW'))throw new Error(`${rel||'home'} leaks preview/synthetic data copy`)}

const home=await read('');for(const m of ['data-v10-home="1"','프랜차이즈 창업','업종별 공개 창업비용 중앙값','공식 원본 레코드'])if(!home.includes(m))throw new Error(`Home missing ${m}`);
const directory=await read('brands');for(const m of ['data-v10-directory="1"','directory-controls','directoryTable','공식 매칭'])if(!directory.includes(m))throw new Error(`Directory missing ${m}`);const directoryRows=(directory.match(/<tr data-name=/g)||[]).length;if(directoryRows!==170)throw new Error(`Directory rows ${directoryRows}/170`);

let brandPages=0,candidates=0;for(const f of files){const h=await fs.readFile(f,'utf8');if(h.includes('data-v10-brand="1"')){brandPages++;if(h.includes('data-index-candidate="1"'))candidates++;}}
if(brandPages!==170)throw new Error(`v10 brand coverage ${brandPages}/170`);
if(candidates!==quality.indexPolicy.brandIndexCandidates)throw new Error(`Candidate count mismatch ${candidates}/${quality.indexPolicy.brandIndexCandidates}`);
for(const rel of ['brands/mega-mgc-coffee','brands/compose-coffee']){const h=await read(rel);for(const m of ['2025 정보공개서','공개합계 ≠ 실제 총투자금','30초 데이터 요약','chart-svg','업종 중앙값','계약 전에 무엇을 추가로 검사','공공데이터포털'])if(!h.includes(m))throw new Error(`${rel} missing ${m}`);if(h.includes('8,956만원')||h.includes('6,283만원'))throw new Error(`${rel} appears to retain old synthetic headline values`)}
const mammoth=await read('brands/mammoth-coffee');if(!mammoth.includes('공식 데이터와의 명칭 매칭을 검토 중')||mammoth.includes('data-index-candidate="1"'))throw new Error('Unmatched Mammoth must stay explicit/noindex-candidate');

const compare=await read('compare/mega-mgc-coffee-vs-compose-coffee');for(const m of ['data-v10-compare="1"','한줄 답','compare-table-desktop','mobile-compare','이 비교가 틀릴 수 있는 조건','chart-svg'])if(!compare.includes(m))throw new Error(`Compare missing ${m}`);if(/승(?:자|리)|추천 브랜드/.test(compare))throw new Error('Compare contains winner/recommendation language');
const compareCols=(compare.match(/<th/g)||[]).length;if(compareCols<4)throw new Error('Compare desktop table missing');
const low=await read('guide/low-price-coffee');if(!low.includes('data-v10-pillar="low-price-coffee"'))throw new Error('Low price coffee pillar missing');const faqs=(low.match(/<details><summary>/g)||[]).length;if(faqs<10)throw new Error(`Low price coffee FAQ ${faqs}/10`);for(const m of ['이 업종을 지금 하면 안 되는 사람','공식 창업비용과 실제 총투자금','월손익 시나리오 3개','상권·평수·인건비','저가커피라는 업종이 공정위 공식 분류'])if(!low.includes(m))throw new Error(`Pillar missing ${m}`);
for(const rel of ['tools/startup-cost','tools/monthly-profit-simulator']){const h=await read(rel);for(const m of ['data-v10-calculator-page','data-copy-url','계산식','입력값'])if(!h.includes(m))throw new Error(`${rel} missing ${m}`)}

for(const rel of ['about','sources','methodology','privacy','terms','disclaimer','contact']){const h=await read(rel);if(!h.includes('<h1>'))throw new Error(`${rel} missing H1`)}
const sources=await read('sources');for(const m of ['공정거래위원회','사용 필드','갱신 방식'])if(!sources.includes(m))throw new Error(`sources missing ${m}`);
const privacy=await read('privacy');if(!privacy.includes('Google AdSense'))throw new Error('Privacy missing future AdSense/cookie disclosure');
const contact=await read('contact');if(/@[a-z0-9.-]+\.[a-z]{2,}/i.test(contact))throw new Error('Contact page invents an email');

const sitemap=await fs.readFile(path.join(out,'sitemap.xml'),'utf8');if(!PREVIEW && !sitemap.includes('<url>'))throw new Error('Production sitemap empty');
const robotsTxt=await fs.readFile(path.join(out,'robots.txt'),'utf8');if(!robotsTxt.includes('Disallow: /'))throw new Error('Preview robots.txt must disallow all');

console.log(JSON.stringify({v10Validation:'PASS',htmlPages:files.length,uniqueTitles:titles.size,brokenInternalLinks:0,brandPages,candidates,directoryRows,officialRecords:quality.official.records,matched:quality.official.matched,unmatched:quality.official.unmatched,ambiguous:quality.official.ambiguous,legacyCssLinks:0,previewNoindex:true},null,2));

const PREVIEW=true;