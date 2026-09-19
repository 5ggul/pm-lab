import fs from 'node:fs';
import path from 'node:path';

const CSS_START='/* v11.52 visual integrity: start */';
const CSS_END='/* v11.52 visual integrity: end */';
const IMG_RE=/<img\b[^>]*src="https:\/\/images\.unsplash\.com\/[^"]+"[^>]*>/gi;

function requireRoot(root){if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');}
function walk(dir,out){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p,out);else if(ent.isFile()&&ent.name.endsWith('.html'))out.push(p)}}
function routeFromFile(root,file){const rel=path.relative(root,file).replace(/\\/g,'/');if(rel==='index.html')return '/';return '/'+rel.replace(/index\.html$/,'');}
function addBodyMarker(html){
  return html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{
    let a=attrs||'';
    a=a.replace(/\bclass="([^"]*)"/i,(m,c)=>{const list=c.split(/\s+/).filter(Boolean);if(!list.includes('v52-visual-integrity'))list.push('v52-visual-integrity');return `class="${list.join(' ')}"`});
    if(!/\bclass="/i.test(a))a+=' class="v52-visual-integrity"';
    a=a.replace(/\sdata-v52-visual-integrity="[^"]*"/gi,'');
    a+=' data-v52-visual-integrity="1"';
    return `<body${a}>`;
  });
}
function localVisual(route,html){
  if(route==='/')return '<span class="v52-local-visual v52-local-visual-home" data-v52-local-visual="home" aria-hidden="true"></span>';
  if(html.includes('data-v10-brand="1"'))return '<span class="v52-local-visual v52-local-visual-brand" data-v52-local-visual="brand" aria-hidden="true"></span>';
  if(html.includes('data-v10-category="1"'))return '<span class="v52-local-visual v52-local-visual-category" data-v52-local-visual="category" aria-hidden="true"></span>';
  return '<span class="v52-local-visual" data-v52-local-visual="generic" aria-hidden="true"></span>';
}
function stripCssBlock(css){
  const a=css.indexOf(CSS_START),b=css.indexOf(CSS_END);
  if((a<0)!=(b<0))throw new Error('Incomplete visual integrity CSS marker');
  if(a<0)return css.trimEnd();
  if(b<a)throw new Error('Reversed visual integrity CSS marker');
  return (css.slice(0,a)+css.slice(b+CSS_END.length)).trimEnd();
}
const CSS=`
${CSS_START}
body.v52-visual-integrity .v52-local-visual{position:absolute;inset:0;display:block;overflow:hidden;background-color:#0d120e;background-image:linear-gradient(rgba(202,255,56,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(202,255,56,.055) 1px,transparent 1px),radial-gradient(circle at 72% 28%,rgba(202,255,56,.16),transparent 23%),linear-gradient(135deg,#151b16 0%,#0a0d0b 68%);background-size:46px 46px,46px 46px,100% 100%,100% 100%}
body.v52-visual-integrity .v52-local-visual::before{content:"";position:absolute;left:9%;right:9%;bottom:18%;height:1px;background:rgba(220,231,222,.22);box-shadow:0 -72px 0 rgba(220,231,222,.16),0 -144px 0 rgba(220,231,222,.11),0 -216px 0 rgba(220,231,222,.075)}
body.v52-visual-integrity .v52-local-visual::after{content:"";position:absolute;left:12%;bottom:18%;width:64%;height:34%;clip-path:polygon(0 84%,12% 72%,26% 78%,40% 49%,54% 58%,68% 33%,82% 41%,100% 4%,100% 10%,83% 50%,68% 42%,54% 66%,40% 57%,26% 86%,12% 80%,0 93%);background:linear-gradient(90deg,rgba(202,255,56,.4),rgba(202,255,56,.96))}
body.v52-visual-integrity .v41-shot-main{background:#0d120e}
body.v52-visual-integrity .v41-shot-main .v52-local-visual-home{transform:none!important}
body.v52-visual-integrity .v41-home-media::after{background:linear-gradient(180deg,rgba(7,8,7,.02),rgba(7,8,7,.12) 58%,rgba(7,8,7,.48)),linear-gradient(90deg,rgba(7,8,7,.2),transparent 34%)}
body.v52-visual-integrity .v41-detail-photo .v52-local-visual-brand{background-size:54px 54px,54px 54px,100% 100%,100% 100%;filter:none}
body.v52-visual-integrity .v41-category-photo .v52-local-visual-category{background-size:58px 58px,58px 58px,100% 100%,100% 100%;filter:none}
body.v52-visual-integrity .v41-detail-photo::after,body.v52-visual-integrity .v41-category-photo::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,10,8,.04),rgba(8,10,8,.3) 54%,rgba(8,10,8,.68));pointer-events:none}
body.v52-visual-integrity .v41-kicker{letter-spacing:.08em}
body.v52-visual-integrity .v41-frame-label span,body.v52-visual-integrity .v41-category-type span,body.v52-visual-integrity .v41-category-type em{letter-spacing:.06em}
@media(max-width:760px){body.v52-visual-integrity .v52-local-visual::before{box-shadow:0 -52px 0 rgba(220,231,222,.15),0 -104px 0 rgba(220,231,222,.1),0 -156px 0 rgba(220,231,222,.07)}}
${CSS_END}
`;

export function applyVisualIntegrity(root){
  requireRoot(root);
  const files=[];walk(root,files);
  let changed=0,removedStockImages=0,affectedPages=0,homePages=0,brandPages=0,categoryPages=0;
  for(const file of files){
    let html=fs.readFileSync(file,'utf8'),before=html;
    const route=routeFromFile(root,file);
    const matches=html.match(IMG_RE)||[];
    if(matches.length){
      removedStockImages+=matches.length;affectedPages++;
      if(route==='/')homePages++;
      else if(html.includes('data-v10-brand="1"'))brandPages++;
      else if(html.includes('data-v10-category="1"'))categoryPages++;
      const replacement=localVisual(route,html);
      html=html.replace(IMG_RE,replacement);
      html=addBodyMarker(html);
    }
    if(route==='/'){
      html=html.replaceAll('KOREA · FRANCHISE INTELLIGENCE','국내 프랜차이즈 공개데이터');
      html=html.replaceAll('FIELD / COST / SALES','비용 · 점포 · 매출');
    }
    if(html.includes('data-v10-category="1"')){
      html=html.replace(/<span>SECTOR<\/span>/g,'<span>업종 데이터</span>');
      html=html.replace(/<em>PUBLIC DATA \/ 2025<\/em>/g,'<em>공개자료 · 2025</em>');
    }
    if(html!==before){fs.writeFileSync(file,html);changed++}
  }
  const cssFile=path.join(root,'assets/site.css');
  if(!fs.existsSync(cssFile))throw new Error('site.css missing');
  let css=fs.readFileSync(cssFile,'utf8');const beforeCss=css;
  css=stripCssBlock(css)+'\n\n'+CSS.trim()+'\n';
  if(css!==beforeCss)fs.writeFileSync(cssFile,css);
  validateVisualIntegrity(root);
  return{changed,removedStockImages,affectedPages,homePages,brandPages,categoryPages,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,candidateSetChanged:false};
}

export function validateVisualIntegrity(root){
  requireRoot(root);
  const files=[];walk(root,files);
  let stock=0,marked=0,homeVisuals=0,brandVisuals=0,categoryVisuals=0,brandPages=0,categoryScenes=0;
  for(const file of files){
    const html=fs.readFileSync(file,'utf8');
    stock+=(html.match(/https:\/\/images\.unsplash\.com\//g)||[]).length;
    if(html.includes('data-v52-visual-integrity="1"'))marked++;
    homeVisuals+=(html.match(/data-v52-local-visual="home"/g)||[]).length;
    brandVisuals+=(html.match(/data-v52-local-visual="brand"/g)||[]).length;
    categoryVisuals+=(html.match(/data-v52-local-visual="category"/g)||[]).length;
    if(html.includes('data-v10-brand="1"'))brandPages++;
    if(html.includes('v41-category-scene'))categoryScenes++;
  }
  const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
  if(stock!==0)throw new Error(`Remote stock images remain: ${stock}`);
  if(homeVisuals!==1)throw new Error(`Home local visual coverage ${homeVisuals}/1`);
  if(brandVisuals!==brandPages||brandPages!==136)throw new Error(`Brand local visual coverage ${brandVisuals}/${brandPages}`);
  if(categoryVisuals!==categoryScenes||categoryScenes!==16)throw new Error(`Category local visual coverage ${categoryVisuals}/${categoryScenes}`);
  if(marked!==1+brandPages+categoryScenes)throw new Error(`Visual marker coverage ${marked}/${1+brandPages+categoryScenes}`);
  for(const bad of ['KOREA · FRANCHISE INTELLIGENCE','FIELD / COST / SALES'])if(home.includes(bad))throw new Error(`Home decorative English retained: ${bad}`);
  for(const good of ['국내 프랜차이즈 공개데이터','비용 · 점포 · 매출'])if(!home.includes(good))throw new Error(`Home Korean visual label missing: ${good}`);
  for(const file of files){
    const html=fs.readFileSync(file,'utf8');
    if(html.includes('v41-category-scene')){
      if(html.includes('<span>SECTOR</span>')||html.includes('<em>PUBLIC DATA / 2025</em>'))throw new Error(`Category decorative English retained ${path.relative(root,file)}`);
      if(!html.includes('<span>업종 데이터</span>')||!html.includes('<em>공개자료 · 2025</em>'))throw new Error(`Category Korean visual labels missing ${path.relative(root,file)}`);
    }
  }
  const css=fs.readFileSync(path.join(root,'assets/site.css'),'utf8');
  if((css.match(/\/\* v11\.52 visual integrity: start \*\//g)||[]).length!==1||(css.match(/\/\* v11\.52 visual integrity: end \*\//g)||[]).length!==1)throw new Error('Visual integrity CSS marker missing or duplicated');
  for(const token of ['.v52-local-visual','.v52-local-visual::before','.v52-local-visual::after'])if(!css.includes(token))throw new Error(`Visual integrity CSS missing ${token}`);
  return{visualIntegrity:true,stockImages:0,homeVisuals,brandVisuals,categoryVisuals,markedPages:marked,decorativeEnglishRemoved:true};
}
