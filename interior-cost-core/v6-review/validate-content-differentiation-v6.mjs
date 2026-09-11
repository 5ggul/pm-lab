import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('interior-cost-core/v6-review');
const errors=[];
const groups={
  pyeong:['24-pyeong','30-pyeong','32-pyeong','34-pyeong','40-pyeong'].map(x=>`interior-cost/${x}/index.html`),
  work:['bathroom','kitchen','windows','demolition-waste'].map(x=>`cost/${x}/index.html`),
  guides:['quote-how-to','vat','waste-separate','bathroom-one-set','window-included-excluded','old-apartment','management-fee','change-order','partial-vs-full','self-vs-turnkey','kitchen-quote','wallpaper-flooring'].map(x=>`guides/${x}/index.html`)
};
const thresholds={pyeong:.58,work:.52,guides:.42};
const decode=s=>String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const mainText=html=>decode((html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)||[])[1]||html);
const tokens=text=>text.toLowerCase().replace(/[^0-9a-z가-힣]+/g,' ').split(/\s+/).filter(x=>x.length>1&&!/^\d+$/.test(x));
function shingles(text,n=5){const t=tokens(text),s=new Set();for(let i=0;i<=t.length-n;i++)s.add(t.slice(i,i+n).join(' '));return s}
function jaccard(a,b){let inter=0;for(const x of a)if(b.has(x))inter++;const union=a.size+b.size-inter;return union?inter/union:0}
const paragraphs=html=>[...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>decode(m[1])).filter(x=>x.length>=90);
const basename=f=>f.replace(/\/index\.html$/,'');
let pairCount=0,exactParagraphDuplicates=0,highest={score:0,pair:null};
for(const [group,files] of Object.entries(groups)){
  const docs=[];
  for(const rel of files){const file=path.join(root,rel);if(!fs.existsSync(file)){errors.push(`missing:${rel}`);continue}const html=fs.readFileSync(file,'utf8'),text=mainText(html),sh=shingles(text);if(text.length<500)errors.push(`thin-source:${rel}:${text.length}`);if(sh.size<45)errors.push(`low-unique-shingles:${rel}:${sh.size}`);docs.push({rel,html,text,sh,paras:paragraphs(html)})}
  for(let i=0;i<docs.length;i++)for(let j=i+1;j<docs.length;j++){pairCount++;const a=docs[i],b=docs[j],score=jaccard(a.sh,b.sh);if(score>highest.score)highest={score,pair:`${a.rel} <> ${b.rel}`};if(score>thresholds[group])errors.push(`template-similarity:${group}:${score.toFixed(3)}:${basename(a.rel)}<>${basename(b.rel)}`);const bParas=new Set(b.paras.map(x=>x.replace(/\s+/g,' ').trim()));for(const p of a.paras){if(bParas.has(p)){exactParagraphDuplicates++;errors.push(`duplicate-paragraph:${group}:${basename(a.rel)}<>${basename(b.rel)}:${p.slice(0,70)}`)}}}
}
const knownGeneric=[
  '실제 계약금액은 현장 조건과 자재 사양에 따라 달라질 수 있습니다.',
  '이 페이지는 시장 평균이나 적정가를 판정하지 않습니다.'
];
if(errors.some(x=>x.startsWith('duplicate-paragraph:'))){for(const generic of knownGeneric){void generic}}
if(errors.length){console.error(JSON.stringify({ok:false,errors:errors.slice(0,120),error_count:errors.length,pairs_checked:pairCount,highest_similarity:Number(highest.score.toFixed(4)),highest_pair:highest.pair,thresholds},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),pairs_checked:pairCount,highest_similarity:Number(highest.score.toFixed(4)),highest_pair:highest.pair,exact_long_paragraph_duplicates:exactParagraphDuplicates,thresholds,method:'5-token shingle Jaccard + exact paragraphs >=90 chars'},null,2));
