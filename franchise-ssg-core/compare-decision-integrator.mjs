import fs from 'node:fs';
import path from 'node:path';
import {COMPARE_DECISION_JS,COMPARE_DECISION_CSS} from './compare-decision-assets.mjs';

const JS_START='/* v11.52 compare decision: start */';
const JS_END='/* v11.52 compare decision: end */';
const CSS_START='/* v11.52 compare decision css: start */';
const CSS_END='/* v11.52 compare decision css: end */';
const jsBlock=`${JS_START}\n${COMPARE_DECISION_JS}\n${JS_END}`;
const cssBlock=`${CSS_START}\n${COMPARE_DECISION_CSS}\n${CSS_END}`;
const replaceBlock=(text,start,end,block)=>{const a=text.indexOf(start),b=text.indexOf(end);if((a<0)!=(b<0))throw new Error(`Incomplete compare decision marker ${start}`);if(a<0)return text.trimEnd()+`\n\n${block}\n`;if(b<a)throw new Error(`Reversed compare decision marker ${start}`);return text.slice(0,a)+block+text.slice(b+end.length)};
export function applyCompareDecision(root){if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');const appPath=path.join(root,'assets/app.js'),cssPath=path.join(root,'assets/site.css');const app=fs.readFileSync(appPath,'utf8'),css=fs.readFileSync(cssPath,'utf8');const nextApp=replaceBlock(app,JS_START,JS_END,jsBlock),nextCss=replaceBlock(css,CSS_START,CSS_END,cssBlock);const changed=[];if(nextApp!==app){fs.writeFileSync(appPath,nextApp);changed.push('assets/app.js')}if(nextCss!==css){fs.writeFileSync(cssPath,nextCss);changed.push('assets/site.css')}validateCompareDecision(root);return{changedFiles:changed,productionDeploy:false,indexPolicyChanged:false};}
export function validateCompareDecision(root){const app=fs.readFileSync(path.join(root,'assets/app.js'),'utf8'),css=fs.readFileSync(path.join(root,'assets/site.css'),'utf8');if(!app.includes(jsBlock))throw new Error('Compare decision JS missing');if(!css.includes(cssBlock))throw new Error('Compare decision CSS missing');return{compareDecision:true};}
