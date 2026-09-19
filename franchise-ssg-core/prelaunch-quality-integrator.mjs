import fs from 'node:fs';
import path from 'node:path';

const CSS_START='/* v11.52 prelaunch quality: start */';
const CSS_END='/* v11.52 prelaunch quality: end */';
const FAQ_START='<!-- v11.52 visible rankings faq: start -->';
const FAQ_END='<!-- v11.52 visible rankings faq: end -->';

function requireRoot(root){if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');}
function esc(v){return String(v??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));}
function walk(dir,out){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p,out);else if(ent.isFile()&&ent.name.endsWith('.html'))out.push(p)}}
function stripMarked(text,start,end){
  const a=text.indexOf(start),b=text.indexOf(end);
  if((a<0)!=(b<0))throw new Error(`Incomplete marker ${start}`);
  if(a<0)return text;
  if(b<a)throw new Error(`Reversed marker ${start}`);
  return text.slice(0,a)+text.slice(b+end.length);
}
function parseRankingFaq(html){
  const raw=html.match(/<script type="application\/ld\+json" data-v32-ranking-faq>([\s\S]*?)<\/script>/)?.[1];
  if(!raw)throw new Error('Rankings FAQPage JSON-LD missing');
  const faq=JSON.parse(raw);
  if(faq['@type']!=='FAQPage'||!Array.isArray(faq.mainEntity)||faq.mainEntity.length!==4)throw new Error('Rankings FAQPage shape changed');
  for(const item of faq.mainEntity){
    if(item?.['@type']!=='Question'||!String(item.name||'').trim()||item.acceptedAnswer?.['@type']!=='Answer'||!String(item.acceptedAnswer?.text||'').trim())throw new Error('Rankings FAQ item invalid');
  }
  return faq;
}
function visibleFaq(faq){
  const rows=faq.mainEntity.map(item=>`<details data-v52-ranking-faq-item><summary>${esc(item.name)}</summary><p>${esc(item.acceptedAnswer.text)}</p></details>`).join('');
  return `${FAQ_START}<section class="block v52-ranking-faq" data-v52-ranking-faq-visible="1" aria-labelledby="v52-ranking-faq-title"><div class="section-head"><h2 id="v52-ranking-faq-title">업종 순위 FAQ</h2></div><div class="v52-ranking-faq-list">${rows}</div></section>${FAQ_END}`;
}
function stripCss(css){
  const a=css.indexOf(CSS_START),b=css.indexOf(CSS_END);
  if((a<0)!=(b<0))throw new Error('Incomplete prelaunch quality CSS marker');
  if(a<0)return css.trimEnd();
  if(b<a)throw new Error('Reversed prelaunch quality CSS marker');
  return (css.slice(0,a)+css.slice(b+CSS_END.length)).trimEnd();
}
const CSS=`
${CSS_START}
body.v40-market-ui .history-coverage-note{color:#dbe3dc;background:#101610;border-left-color:#c8ff3d}
body.v40-market-ui .history-coverage-note strong{color:#f3f5ef}
body.v52-brand-decision :is(#answer,#cost,#benchmark,#stores,#raw-data,#evidence,#official-current-cost,#source){scroll-margin-top:104px}
.v52-ranking-faq{border-top:1px solid #303831;padding-top:22px}
.v52-ranking-faq-list{border-top:1px solid #303831}
.v52-ranking-faq-list details{margin:0;border-bottom:1px solid #242a25}
.v52-ranking-faq-list summary{display:flex;align-items:center;min-height:48px;padding:10px 34px 10px 0;color:#eef4ed;font-size:13px;font-weight:750;line-height:1.45;cursor:pointer}
.v52-ranking-faq-list details[open] summary{color:#c8ff3d}
.v52-ranking-faq-list p{margin:0;padding:0 0 14px;color:#a7b0a8;font-size:12px;line-height:1.7}
@media(max-width:760px){
 body.v52-brand-decision :is(#answer,#cost,#benchmark,#stores,#raw-data,#evidence,#official-current-cost,#source){scroll-margin-top:92px}
 .v52-ranking-faq-list summary{font-size:12px}
 .v52-ranking-faq-list p{font-size:11px}
}
${CSS_END}
`;

export function applyPrelaunchQuality(root){
  requireRoot(root);
  const rankingsFile=path.join(root,'rankings/index.html');
  let rankings=fs.readFileSync(rankingsFile,'utf8');
  const faq=parseRankingFaq(rankings);
  const beforeRankings=rankings;
  rankings=stripMarked(rankings,FAQ_START,FAQ_END);
  const block=visibleFaq(faq);
  const needle='<aside class="source-box">';
  if(!rankings.includes(needle))throw new Error('Rankings FAQ insertion point missing');
  rankings=rankings.replace(needle,block+needle);
  if(rankings!==beforeRankings)fs.writeFileSync(rankingsFile,rankings);

  const cssFile=path.join(root,'assets/site.css');
  let css=fs.readFileSync(cssFile,'utf8'),beforeCss=css;
  css=stripCss(css)+'\n\n'+CSS.trim()+'\n';
  if(css!==beforeCss)fs.writeFileSync(cssFile,css);

  const result=validatePrelaunchQuality(root);
  return{changed:rankings!==beforeRankings||css!==beforeCss,...result,productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,candidateSetChanged:false};
}

export function validatePrelaunchQuality(root){
  requireRoot(root);
  const rankings=fs.readFileSync(path.join(root,'rankings/index.html'),'utf8');
  const faq=parseRankingFaq(rankings);
  if((rankings.match(/data-v52-ranking-faq-visible="1"/g)||[]).length!==1)throw new Error('Visible rankings FAQ missing or duplicated');
  if((rankings.match(/data-v52-ranking-faq-item/g)||[]).length!==4)throw new Error('Visible rankings FAQ item count');
  for(const item of faq.mainEntity){
    if(rankings.split(item.name).length-1<2)throw new Error(`FAQ question not visible: ${item.name}`);
    if(rankings.split(item.acceptedAnswer.text).length-1<2)throw new Error(`FAQ answer not visible: ${item.name}`);
  }

  const css=fs.readFileSync(path.join(root,'assets/site.css'),'utf8');
  if((css.match(/\/\* v11\.52 prelaunch quality: start \*\//g)||[]).length!==1||(css.match(/\/\* v11\.52 prelaunch quality: end \*\//g)||[]).length!==1)throw new Error('Prelaunch quality CSS marker missing or duplicated');
  for(const token of ['body.v40-market-ui .history-coverage-note{color:#dbe3dc;background:#101610','scroll-margin-top:104px','scroll-margin-top:92px','.v52-ranking-faq-list'])if(!css.includes(token))throw new Error(`Prelaunch CSS missing ${token}`);

  const files=[];walk(root,files);
  let historyNotePages=0,historyNotes=0;
  for(const file of files){
    const html=fs.readFileSync(file,'utf8');
    const count=(html.match(/class="history-coverage-note"/g)||[]).length;
    if(count){historyNotePages++;historyNotes+=count}
  }
  if(historyNotePages===0||historyNotes===0)throw new Error('History coverage note pages missing');

  const mega=fs.readFileSync(path.join(root,'brands/mega-mgc-coffee/index.html'),'utf8');
  for(const id of ['answer','cost','benchmark','stores','raw-data','evidence','official-current-cost','source'])if(!mega.includes(`id="${id}"`))throw new Error(`Mega anchor target missing ${id}`);

  return{prelaunchQuality:true,rankingFaqVisible:true,rankingFaqItems:4,historyNotePages,historyNotes,brandAnchorOffsets:true,releaseInputsOwnedByProductionGate:true};
}
