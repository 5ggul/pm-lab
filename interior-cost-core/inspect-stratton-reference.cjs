const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET = 'https://stratton.market/';
const OUT = path.resolve('interior-cost-core/stratton-reference-audit.json');

function cleanText(s=''){ return s.replace(/\s+/g,' ').trim().slice(0,220); }

async function inspect(page, name, width, height){
  await page.setViewportSize({width,height});
  await page.goto(TARGET,{waitUntil:'networkidle',timeout:90000});
  await page.waitForTimeout(2500);
  const result = await page.evaluate(() => {
    const visible = el => {
      const s=getComputedStyle(el), r=el.getBoundingClientRect();
      return s.display!=='none' && s.visibility!=='hidden' && +s.opacity!==0 && r.width>1 && r.height>1;
    };
    const snap = el => {
      if(!el || !visible(el)) return null;
      const s=getComputedStyle(el), r=el.getBoundingClientRect();
      return {
        tag:el.tagName.toLowerCase(),
        id:el.id||'',
        cls:(el.className&&typeof el.className==='string')?el.className.slice(0,240):'',
        text:(el.innerText||'').replace(/\s+/g,' ').trim().slice(0,220),
        box:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},
        style:{
          display:s.display,position:s.position,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,
          lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,color:s.color,background:s.backgroundColor,
          borderTop:s.borderTop,borderRadius:s.borderRadius,boxShadow:s.boxShadow,padding:s.padding,margin:s.margin,
          textTransform:s.textTransform,textAlign:s.textAlign,gap:s.gap
        }
      };
    };
    const all=[...document.querySelectorAll('body *')].filter(visible);
    const count=(arr,keyFn)=>Object.entries(arr.reduce((m,x)=>{const k=keyFn(x);if(k)m[k]=(m[k]||0)+1;return m;},{})).sort((a,b)=>b[1]-a[1]).slice(0,24);
    const root=getComputedStyle(document.documentElement);
    const cssVars={};
    for(let i=0;i<root.length;i++){const k=root[i];if(k.startsWith('--'))cssVars[k]=root.getPropertyValue(k).trim();}
    const areas=all.map(el=>({el,r:el.getBoundingClientRect()})).filter(x=>x.r.width*x.r.height>6000 && x.r.top<document.documentElement.scrollHeight).sort((a,b)=>a.r.top-b.r.top || b.r.width*b.r.height-a.r.width*a.r.height).slice(0,80).map(x=>snap(x.el));
    return {
      title:document.title,
      url:location.href,
      viewport:{w:innerWidth,h:innerHeight},
      page:{scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth},
      body:snap(document.body),
      header:snap(document.querySelector('header')),
      nav:snap(document.querySelector('nav')),
      main:snap(document.querySelector('main')),
      footer:snap(document.querySelector('footer')),
      headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0,40).map(snap),
      buttons:[...document.querySelectorAll('button,a,[role="button"]')].filter(visible).slice(0,50).map(snap),
      mainChildren:document.querySelector('main')?[...document.querySelector('main').children].filter(visible).slice(0,30).map(snap):[],
      largeVisibleBlocks:areas,
      palette:{
        backgrounds:count(all,el=>getComputedStyle(el).backgroundColor),
        textColors:count(all,el=>getComputedStyle(el).color),
        borderColors:count(all,el=>getComputedStyle(el).borderTopColor),
        fonts:count(all,el=>getComputedStyle(el).fontFamily),
        radii:count(all,el=>getComputedStyle(el).borderRadius),
        fontSizes:count(all,el=>getComputedStyle(el).fontSize),
        fontWeights:count(all,el=>getComputedStyle(el).fontWeight)
      },
      rootVars:cssVars,
      text:(document.body.innerText||'').replace(/\s+/g,' ').trim().slice(0,5000)
    };
  });
  await page.screenshot({path:`artifacts/stratton-${name}.png`,fullPage:true});
  return result;
}

(async()=>{
  fs.mkdirSync('artifacts',{recursive:true});
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  const desktop=await inspect(page,'desktop',1440,1000);
  const mobile=await inspect(page,'mobile',390,844);
  await browser.close();
  const report={capturedAt:new Date().toISOString(),target:TARGET,desktop,mobile};
  fs.writeFileSync(OUT,JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:true,title:desktop.title,desktopHeight:desktop.page.scrollHeight,mobileHeight:mobile.page.scrollHeight,desktopFonts:desktop.palette.fonts.slice(0,5),desktopBackgrounds:desktop.palette.backgrounds.slice(0,8)},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
