import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
if(manifest.uiVersion!==9)throw new Error(`Expected uiVersion 9, got ${manifest.uiVersion}`);
for(const k of ['referenceLedVisualSystem','editorialHome','denseDirectory','profileDetail','sideBySideCompare','calculatorReportLayout','aiDashboardPatternRemoved','legacyVisualCssRemoved','referenceSpecificHubs','roundedCardPatternRemoved'])if(!manifest.productEnhancements?.[k])throw new Error(`Missing v9 enhancement: ${k}`);

const files=[];async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}await walk(out);
if(files.length<277)throw new Error(`HTML coverage regressed: ${files.length}`);
let css9=0,legacyCss=0,noindex=0;const titles=new Set();const BASE='/pm-lab/franchise-ssg-preview';const broken=[];
for(const f of files){const h=await fs.readFile(f,'utf8');if(h.includes('/assets/v9.css'))css9++;if(h.includes('/assets/v7.css')||h.includes('/assets/v8.css'))legacyCss++;if(h.includes('noindex'))noindex++;const t=h.match(/<title>([^<]+)<\/title>/)?.[1];if(t){if(titles.has(t))throw new Error(`Duplicate title: ${t}`);titles.add(t)}for(const m of h.matchAll(/href="([^"]+)"/g)){let href=m[1];if(!href.startsWith(BASE))continue;href=href.slice(BASE.length).split('#')[0].split('?')[0];try{href=decodeURIComponent(href)}catch{}const target=href===''||href==='/'?path.join(out,'index.html'):href.endsWith('/')?path.join(out,href.replace(/^\//,''),'index.html'):path.join(out,href.replace(/^\//,''));try{await fs.stat(target)}catch{broken.push(`${path.relative(out,f)} -> ${m[1]}`)}}}
if(css9!==files.length)throw new Error(`v9 css coverage mismatch ${css9}/${files.length}`);
if(legacyCss!==0)throw new Error(`Legacy v7/v8 CSS still linked on ${legacyCss} pages`);
if(noindex!==files.length)throw new Error(`Preview noindex coverage mismatch ${noindex}/${files.length}`);
if(broken.length)throw new Error(`Broken internal links: ${broken.slice(0,8).join(' | ')}`);

const read=async p=>fs.readFile(path.join(out,p,'index.html'),'utf8');
const home=await read('');for(const m of ['data-v9-home="1"','FRANCHISE DATA DIRECTORY','home-directory-grid','data-table'])if(!home.includes(m))throw new Error(`Home missing ${m}`);for(const banned of ['quick-grid','home-table','rounded','프랜차이즈 창업비용과 가맹점 현황 비교'])if(home.includes(banned))throw new Error(`Home retains old pattern: ${banned}`);
const brands=await read('brands');for(const m of ['data-v9-directory="1"','directory-shell','directory-filter','directoryTable'])if(!brands.includes(m))throw new Error(`Directory missing ${m}`);const rows=[...brands.matchAll(/class="brand-card"/g)].length;if(rows!==170)throw new Error(`Directory rows ${rows}/170`);

let profiles=0,compares=0,rankings=0,calcs=0;
for(const f of files){const h=await fs.readFile(f,'utf8');if(h.includes('data-v9-profile="1"'))profiles++;if(h.includes('data-v9-compare="1"'))compares++;if(h.includes('data-v9-ranking="1"'))rankings++;if(h.includes('data-v9-calculator-page="1"'))calcs++;}
if(profiles!==170)throw new Error(`Profile coverage ${profiles}/170`);if(compares!==10)throw new Error(`Compare coverage ${compares}/10`);if(rankings!==20)throw new Error(`Ranking coverage ${rankings}/20`);if(calcs<2)throw new Error(`Calculator v9 coverage ${calcs}/2`);

const profile=await read('brands/mega-mgc-coffee');for(const m of ['profile-hero','profile-kpis','profile-tabs','profile-grid','cost-stack','benchmark-track'])if(!profile.includes(m))throw new Error(`Profile missing ${m}`);for(const banned of ['brand-hero-v8','kpi-grid-v8','viz-panel-v8'])if(profile.includes(banned))throw new Error(`Profile retains v8 structure: ${banned}`);
const compare=await read('compare/mega-mgc-coffee/compose-coffee');for(const m of ['compare-shell-v9','compare-columns','difference-band','data-table'])if(!compare.includes(m))throw new Error(`Compare missing ${m}`);if(compare.includes('compare-hero-v8'))throw new Error('Compare retains v8 hero');
const ranking=await read('rankings/cafe');for(const m of ['rank-header','data-v9-ranking="1"','data-table'])if(!ranking.includes(m))throw new Error(`Ranking missing ${m}`);
const startup=await read('tools/startup-cost');const profit=await read('tools/monthly-profit-simulator');for(const h of [startup,profit])for(const m of ['data-v9-calculator-page="1"','v9-calculator','calc-form-panel-head'])if(!h.includes(m))throw new Error(`Calculator missing ${m}`);
for(const [p,m] of [['categories','data-v9-category-hub="1"'],['compare','data-v9-compare-hub="1"'],['tools','data-v9-tools-hub="1"']])if(!(await read(p)).includes(m))throw new Error(`${p} hub missing v9 structure`);

const report=JSON.parse(await fs.readFile(path.join(out,'official-match-report.json'),'utf8'));if(report.coverage.matched+report.coverage.unmatched+report.coverage.ambiguous!==report.coverage.catalogBrands)throw new Error('Official match partition mismatch');if(Boolean(report.active)!==Boolean(manifest.officialMerge?.active))throw new Error('Official merge state mismatch');
console.log(JSON.stringify({v9Validation:'PASS',htmlPages:files.length,uniqueTitles:titles.size,brokenInternalLinks:0,v9CssCoverage:css9,legacyCssLinks:legacyCss,profiles,compares,rankings,calculators:calcs,directoryRows:rows},null,2));