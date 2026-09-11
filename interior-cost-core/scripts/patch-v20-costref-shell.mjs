import fs from 'node:fs';

const file='interior-cost-core/enhance-v20-g2b-costrefs.mjs';
let source=fs.readFileSync(file,'utf8');
const oldCss=`const cssRef=hub.match(/<link rel=\"stylesheet\" href=\"[^\"]*site-v19-bundle\\.css[^\"]*\">/)?.[0]||'';`;
const oldJs=`const jsRef=hub.match(/<script src=\"[^\"]*app-v19-bundle\\.js[^\"]*\" defer><\\/script>/)?.[0]||'';`;
const oldGuard=`if(!header||!cssRef||!jsRef)throw new Error('v20 cost refs require v19 preview shell');`;
const newCss=`const cssRef=hub.match(/<link rel=\"stylesheet\" href=\"[^\"]*site-v20-bundle\\.css[^\"]*\">/)?.[0]||hub.match(/<link rel=\"stylesheet\" href=\"[^\"]*site-v19-bundle\\.css[^\"]*\">/)?.[0]||'';`;
const newJs=`const jsRef=hub.match(/<script src=\"[^\"]*app-v20-bundle\\.js[^\"]*\" defer><\\/script>/)?.[0]||hub.match(/<script src=\"[^\"]*app-v19-bundle\\.js[^\"]*\" defer><\\/script>/)?.[0]||'';`;
const newGuard=`if(!header||!cssRef||!jsRef)throw new Error('v20 cost refs require generated preview shell');`;
for(const [from,to,label] of [[oldCss,newCss,'css'],[oldJs,newJs,'js'],[oldGuard,newGuard,'guard']]){
  const count=source.split(from).length-1;
  if(count!==1)throw new Error(`Expected one ${label} shell marker, found ${count}`);
  source=source.replace(from,to);
}
fs.writeFileSync(file,source);
console.log('patched v20 cost reference shell compatibility');
