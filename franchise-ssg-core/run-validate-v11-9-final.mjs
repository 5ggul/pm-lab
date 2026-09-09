import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];

const home=await fs.readFile(path.join(out,'index.html'),'utf8');
const mega=await fs.readFile(path.join(out,'brands/mega-mgc-coffee/index.html'),'utf8');
const cafe=await fs.readFile(path.join(out,'categories/cafe/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const app=await fs.readFile(path.join(out,'assets/app.js'),'utf8');
const report=JSON.parse(await fs.readFile(path.join(out,'v11-9-motion-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));

if((home.match(/data-home-motion/g)||[]).length!==1)errors.push('home startup motion must exist exactly once');
if(!/class="startup-motion"[^>]*aria-hidden="true"/.test(home))errors.push('home startup motion must be decorative for screen readers');
if(!/home-intro-grid/.test(home))errors.push('home intro grid missing');
if(!/data-motion-chart/.test(mega))errors.push('brand detail charts are not motion-enabled');
if(!/data-motion-chart/.test(cafe))errors.push('category charts are not motion-enabled');
if(!css.includes('/* v11.9 restrained motion */'))errors.push('motion CSS marker missing');
if(!css.includes('@media(prefers-reduced-motion:reduce)'))errors.push('reduced-motion CSS missing');
if(!css.includes('loopingDecorativeMotion')&&/animation[^;]*infinite/i.test(css.slice(css.indexOf('/* v11.9 restrained motion */'))))errors.push('v11.9 decorative motion must not loop infinitely');
if(!app.includes('/* v11.9 chart motion */'))errors.push('motion JS marker missing');
if(!app.includes('IntersectionObserver'))errors.push('IntersectionObserver chart activation missing');
if(!app.includes("prefers-reduced-motion: reduce"))errors.push('JS reduced-motion guard missing');
if(report.uiVersion!=='11.9')errors.push(`motion report uiVersion ${report.uiVersion}`);
if(Number(report.motionChartCount)<40)errors.push(`motion chart coverage unexpectedly low: ${report.motionChartCount}`);
if(report.reducedMotionSupport!==true)errors.push('motion report reducedMotionSupport false');
if(report.loopingDecorativeMotion!==false)errors.push('motion report loopingDecorativeMotion must be false');
if(manifest.uiVersion!=='11.9')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_9?.homeStartupMotion!==true)errors.push('manifest homeStartupMotion missing');
if(manifest.v11_9?.scrollChartMotion!==true)errors.push('manifest scrollChartMotion missing');
if(manifest.v11_9?.reducedMotionSupport!==true)errors.push('manifest reducedMotionSupport missing');
if(manifest.v11_9?.loopingDecorativeMotion!==false)errors.push('manifest loopingDecorativeMotion must be false');

if(errors.length){
  console.error(JSON.stringify({v11_9Validation:'FAIL',errors,report},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_9Validation:'PASS',homeStartupMotion:true,motionChartCount:report.motionChartCount,reducedMotionSupport:true,loopingDecorativeMotion:false},null,2));
