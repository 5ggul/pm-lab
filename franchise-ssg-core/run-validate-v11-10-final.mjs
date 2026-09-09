import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const home=await fs.readFile(path.join(out,'index.html'),'utf8');
const mega=await fs.readFile(path.join(out,'brands/mega-mgc-coffee/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const report=JSON.parse(await fs.readFile(path.join(out,'v11-10-mobile-visual-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));

if(!/<h1>프랜차이즈 <span class="home-title-tail">창업비용 비교<\/span><\/h1>/.test(home))errors.push('balanced home title markup missing');
if(!home.includes('data-home-motion'))errors.push('home startup motion disappeared');
if(!mega.includes('class="chart-svg history-three-year"'))errors.push('mega history chart missing');
if(!css.includes('/* v11.10 mobile visual QA */'))errors.push('mobile visual QA CSS missing');
if(!/\.history-three-year\{min-width:0!important;width:100%!important/.test(css))errors.push('mobile history chart overflow override missing');
if(!/\.history-three-year text\{font-size:22px\}/.test(css))errors.push('mobile history chart text sizing missing');
if(!/\.home-title-tail\{display:block\}/.test(css))errors.push('mobile balanced title rule missing');
if(report.uiVersion!=='11.10')errors.push(`report uiVersion ${report.uiVersion}`);
if(Number(report.historyCharts)<100)errors.push(`history chart coverage unexpectedly low: ${report.historyCharts}`);
if(report.balancedMobileHeroTitle!==true||report.responsiveHistoryCharts!==true)errors.push('report visual QA flags missing');
if(manifest.uiVersion!=='11.10')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_10?.balancedMobileHeroTitle!==true)errors.push('manifest balancedMobileHeroTitle missing');
if(manifest.v11_10?.responsiveHistoryCharts!==true)errors.push('manifest responsiveHistoryCharts missing');

if(errors.length){
  console.error(JSON.stringify({v11_10Validation:'FAIL',errors,report},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_10Validation:'PASS',balancedMobileHeroTitle:true,responsiveHistoryCharts:true,historyCharts:report.historyCharts},null,2));
