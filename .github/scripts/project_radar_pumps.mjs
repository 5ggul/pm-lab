import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const OUT='docs/rdr-c9x7m4q2p8v5/pump-winners.json';
const KEEP_MS=14*24*3600*1000;
const MAX_ITEMS=80;
const STABLE=/^(?:USDC|USDT|USDS|DAI|FDUSD|USDE|USD1|WETH|ETH|WBTC|BTC|SOL|WSOL|BNB|WBNB|WAVAX|AVAX)$/i;
const WATCHLIST=['neodot','theunipcs','DefiRabbitHole','elenakvcs','thebearjesus','longdotxyz'];
const NARRATIVE_SCAN_VERSION='xmd-v5';

const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Math.round(n)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function json(url,options={}){
 const r=await fetch(url,{...options,headers:{'user-agent':'ProjectRadarPump/1.0','accept':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('HTTP '+r.status+' '+url);
 return r.json();
}
function baseTokenFromGt(row,includedMap){
 const rel=row.relationships?.base_token?.data?.id;
 return includedMap.get(rel)||{};
}
function normalizeGt(row,includedMap,source){
 const a=row.attributes||{},token=baseTokenFromGt(row,includedMap);
 const network=row.relationships?.network?.data?.id||String(row.id||'').split('_')[0]||'';
 const address=token.address||String(row.relationships?.base_token?.data?.id||'').replace(new RegExp('^'+network+'_'),'');
 const symbol=String(token.symbol||a.name?.split('/')[0]||'').replace(/^\$/,'').trim();
 const name=String(token.name||symbol||'').trim();
 const tx=a.transactions||{},vol=a.volume_usd||{},pc=a.price_change_percentage||{};
 return {
  key:network+':'+address,network,token_address:address,pair_address:a.address||'',symbol,name,
  source,source_url:'https://www.geckoterminal.com/'+network+'/pools/'+(a.address||''),
  pair_created_at:a.pool_created_at||null,
  price_usd:num(a.base_token_price_usd),
  market_cap:num(a.market_cap_usd)||num(a.fdv_usd),fdv:num(a.fdv_usd),
  liquidity_usd:num(a.reserve_in_usd),
  change:{m5:num(pc.m5),h1:num(pc.h1),h6:num(pc.h6),h24:num(pc.h24)},
  volume:{m5:num(vol.m5),h1:num(vol.h1),h6:num(vol.h6),h24:num(vol.h24)},
  txns:{m5:tx.m5||{},h1:tx.h1||{},h6:tx.h6||{},h24:tx.h24||{}}
 };
}
function normalizeDs(pair,source){
 const symbol=String(pair.baseToken?.symbol||'').replace(/^\$/,'').trim(),name=String(pair.baseToken?.name||symbol).trim();
 const t=pair.txns||{},v=pair.volume||{},p=pair.priceChange||{};
 return {
  key:String(pair.chainId||'')+':'+String(pair.baseToken?.address||''),network:String(pair.chainId||''),token_address:String(pair.baseToken?.address||''),pair_address:String(pair.pairAddress||''),symbol,name,
  source,source_url:pair.url||'',pair_created_at:pair.pairCreatedAt?new Date(Number(pair.pairCreatedAt)).toISOString():null,
  price_usd:num(pair.priceUsd),market_cap:num(pair.marketCap)||num(pair.fdv),fdv:num(pair.fdv),liquidity_usd:num(pair.liquidity?.usd),
  change:{m5:num(p.m5),h1:num(p.h1),h6:num(p.h6),h24:num(p.h24)},
  volume:{m5:num(v.m5),h1:num(v.h1),h6:num(v.h6),h24:num(v.h24)},
  txns:{m5:t.m5||{},h1:t.h1||{},h6:t.h6||{},h24:t.h24||{}},boosts:num(pair.boosts?.active)
 };
}
function ageHours(x,now=Date.now()){
 const t=Date.parse(x.pair_created_at||'');return Number.isFinite(t)?Math.max(0,(now-t)/3600000):9999;
}
function buyRatio(t={}){const b=num(t.buys),s=num(t.sells);return (b+1)/(s+1)}
export function qualifiesPump(x,now=Date.now()){
 const age=ageHours(x,now),mc=x.market_cap||x.fdv,liq=x.liquidity_usd;
 if(!x.symbol||x.symbol.length>32||STABLE.test(x.symbol)||age>2160||mc<30000||mc>75000000||liq<12000)return false;
 const c=x.change||{},v=x.volume||{},r1=buyRatio(x.txns?.h1),r24=buyRatio(x.txns?.h24);
 if(age<=168){
  const fast=c.m5>=25&&v.m5>=8000&&r1>=1.15;
  const h1=c.h1>=55&&v.h1>=25000&&r1>=1.15;
  const h6=c.h6>=130&&v.h6>=75000&&r24>=1.05;
  const h24=c.h24>=250&&v.h24>=150000&&r24>=1.0;
  return fast||h1||h6||h24;
 }
 if(liq<20000)return false;
 const revival1h=c.h1>=100&&v.h1>=50000&&r1>=1.15;
 const revival6h=c.h6>=250&&v.h6>=150000&&r24>=1.08;
 const revival24h=c.h24>=500&&v.h24>=300000&&r24>=1.02;
 return revival1h||revival6h||revival24h;
}
export function pumpScore(x,now=Date.now()){
 const age=ageHours(x,now),mc=Math.max(1,x.market_cap||x.fdv),c=x.change||{},v=x.volume||{};
 const move=Math.max(c.m5*1.6,c.h1,c.h6*.7,c.h24*.45,0);
 const volRatio=Math.max(v.h1/mc,v.h6/mc*.55,v.h24/mc*.25);
 const flow=Math.max(buyRatio(x.txns?.h1),buyRatio(x.txns?.h24));
 const moveScore=Math.min(38,Math.log10(1+Math.max(0,move))*11);
 const volumeScore=Math.min(20,Math.log10(1+Math.max(0,volRatio)*100)*10);
 const flowScore=Math.min(14,Math.max(0,(flow-1)*16));
 const liqScore=Math.min(14,Math.max(0,x.liquidity_usd/mc)*70);
 const ageScore=Math.max(0,14-age/12);
 return clamp(moveScore+volumeScore+flowScore+liqScore+ageScore);
}
export function pumpStage(x){
 const c=x.change||{};
 if(c.h6>=300||c.h24>=600)return 'WINNER';
 if(c.m5>=60||c.h1>=120)return 'BREAKOUT';
 return 'PUMPING';
}
function estimatedPreMcap(x){
 const c=Math.max(x.change?.h24||0,x.change?.h6||0,x.change?.h1||0),mc=x.market_cap||x.fdv;
 return c>0&&mc>0?Math.round(mc/(1+c/100)):null;
}
function decodeX(s){try{return JSON.parse('"'+s+'"')}catch{return String(s||'')}}
function xProfileRows(html,handle){
 const ids=[...new Set([...String(html).matchAll(/TimelineTimelineEntry:tweet-(\d{15,}):content:content/g)].map(m=>m[1]))],out=[];
 for(const id of ids){
  const key=Buffer.from('Tweet:'+id).toString('base64').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const d=html.match(new RegExp('"client:'+key+':details"[\\s\\S]{0,1600}?full_text:"((?:\\\\.|[^"\\\\])*)"[\\s\\S]{0,800}?created_at_ms:(\\d+)'));
  if(!d)continue;
  out.push({account:'@'+handle,status_id:id,posted_at:new Date(Number(d[2])).toISOString(),text:decodeX(d[1]),url:'https://x.com/'+handle+'/status/'+id});
 }
 return out;
}
function narrativeSignals(text=''){
 const tags=[];
 const rules=[
  ['revenue',/revenue|fees?|cash flow|buyback|burn/i],
  ['product',/product|users?|launchpad|app|protocol|platform|infra/i],
  ['mechanism',/mechanism|liquidity|flywheel|supply|distribution|tokenomics|curve|migration/i],
  ['catalyst',/mainnet|listing|integration|partnership|launch|migration|leaderboard/i],
  ['comparison',/versus|\bvs\.?\b|multiple|undervalued|market share|dominance|compared/i],
  ['lore',/\b(?:meme|lore|meta|pair(?:ed|ing)?|reflection|symbiosis|mascot|doge|pepe|wojak|kabosu|sister|cat coin|dog coin)\b/i],
  ['social',/\b(?:viral|views?|followers?|creator|official|bio|instagram|tiktok|youtube|videos?|community|members?|social proof)\b/i],
  ['holders',/\b(?:holders?|top holders?|dev holds?|dev holding|snipers?|insiders?|cluster|bubblemap|bundlers?|holder structure)\b/i],
  ['traction',/\b(?:volume|most traded|top traded|trending|buys?|transactions?|liquidity|adoption|network effect)\b/i]
 ];
 for(const [k,re] of rules)if(re.test(text))tags.push(k);
 return tags;
}
async function textPage(url,options={}){
 const {timeout_ms=8000,...init}=options;
 const r=await fetch(url,{...init,headers:{'user-agent':'Mozilla/5.0 (compatible; ProjectRadarNarrative/1.0)','accept-language':'en-US,en;q=.9',...(init.headers||{})},signal:AbortSignal.timeout(timeout_ms)});
 if(!r.ok)throw new Error('HTTP '+r.status+' '+url);
 return r.text();
}
function entityDecode(s=''){
 return String(s).replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
export function tweetDateFromSnowflake(id){
 try{
  const ms=(BigInt(String(id))>>22n)+1288834974657n;
  const n=Number(ms);return Number.isFinite(n)?new Date(n).toISOString():null;
 }catch{return null}
}
function xStatusRef(url=''){
 const s=entityDecode(url),m=s.match(/https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/status\/(\d{15,})/i);
 return m?{handle:m[1],id:m[2],url:'https://x.com/'+m[1]+'/status/'+m[2]}:null;
}
function rssItems(xml=''){
 const out=[];
 for(const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)){
  const b=m[1],tag=n=>entityDecode((b.match(new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+n+'>','i'))||[])[1]||'');
  const title=tag('title'),description=tag('description'),link=tag('link'),blob=[link,title,description].join(' ');
  const refs=[...blob.matchAll(/https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/\d{15,}/gi)].map(x=>xStatusRef(x[0])).filter(Boolean);
  for(const ref of refs)out.push({...ref,snippet:(title+' '+description).trim(),provider:'bing-rss'});
 }
 return [...new Map(out.map(x=>[x.id,x])).values()];
}
export function parseTwStalkerItems(html='',provider='mirror'){
 const s=String(html),out=[];
 const add=(handle,id,index)=>{
  if(!handle||!id)return;
  const start=Math.max(0,(index||0)-2400),end=Math.min(s.length,(index||0)+1600);
  const snippet=entityDecode(s.slice(start,end));
  out.push({handle,id,url:'https://x.com/'+handle+'/status/'+id,snippet,provider});
 };
 for(const m of s.matchAll(/href=["'](?:https?:\/\/(?:www\d*\.|ww\.)?(?:twstalker\.com|sotwe\.com))?\/([A-Za-z0-9_]+)\/status\/(\d{15,})["']/gi))add(m[1],m[2],m.index);
 for(const m of s.matchAll(/https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/status\/(\d{15,})/gi))add(m[1],m[2],m.index);
 for(const m of s.matchAll(/\/?([A-Za-z0-9_]+)\/status\/(\d{15,})/gi))add(m[1],m[2],m.index);
 return [...new Map(out.map(x=>[x.id,x])).values()];
}
async function mirrorSearch(term){
 const enc=encodeURIComponent(term);
 const sources=[
  {provider:'sotwe',url:'https://www.sotwe.com/search/'+enc},
  {provider:'jina-sotwe',url:'https://r.jina.ai/http://www.sotwe.com/search/'+enc},
  {provider:'jina-twstalker',url:'https://r.jina.ai/http://twstalker.com/search/'+enc}
 ];
 const errors=[];
 for(const src of sources){
  try{
   const html=await textPage(src.url,{timeout_ms:4500});
   const rows=parseTwStalkerItems(html,src.provider);
   if(rows.length)return {rows,provider:src.provider,errors};
  }catch(e){errors.push(src.provider+': '+String(e.message||e).slice(0,120))}
  await sleep(100);
 }
 return {rows:[],provider:null,errors};
}
async function xMdSearch(p){
 const q='("$'+p.symbol+'" OR "'+p.token_address+'")';
 const born=Date.parse(p.pair_created_at||''),qualified=Date.parse(p.first_qualified_at||'');
 const u=new URL('https://x.pcstyle.dev/api/v1/search');
 u.searchParams.set('q',q);u.searchParams.set('feed','latest');u.searchParams.set('limit','30');u.searchParams.set('full','true');u.searchParams.set('format','json');
 if(Number.isFinite(qualified)){
  const recentWindow=qualified-72*3600000;
  const since=Number.isFinite(born)?Math.max(born-12*3600000,recentWindow):recentWindow;
  u.searchParams.set('since',new Date(since).toISOString());
  u.searchParams.set('until',new Date(qualified+60000).toISOString());
 }else if(Number.isFinite(born)){
  u.searchParams.set('since',new Date(born-12*3600000).toISOString());
 }
 try{
  const r=await fetch(u,{headers:{'user-agent':'ProjectRadarPump/1.0','accept':'application/json'},signal:AbortSignal.timeout(12000)});
  const text=await r.text();let j={};try{j=JSON.parse(text)}catch{}
  if(r.status===429||r.status===503)return {rows:[],source:j.source||'',degraded:false,error:'HTTP '+r.status+' retry-after '+(r.headers.get('retry-after')||'')};
  if(!r.ok)return {rows:[],source:j.source||'',degraded:false,error:'HTTP '+r.status+' '+text.slice(0,160)};
  const rows=[];
  for(const x of j.posts||[]){
   const id=String(x.id||''),handle=String(x.author?.screen_name||'').replace(/^@/,'');
   if(!/^\d{15,}$/.test(id)||!handle)continue;
   rows.push({
    handle,id,url:String(x.url||('https://x.com/'+handle+'/status/'+id)).replace('twitter.com/','x.com/'),
    snippet:String(x.text||''),
    posted_at:x.created_at||tweetDateFromSnowflake(id),
    provider:'x-md:'+String(j.source||'public'),
    metrics:{likes:num(x.likes),reposts:num(x.retweets??x.reposts),quotes:num(x.quotes),replies:num(x.replies),views:num(x.views),bookmarks:num(x.bookmarks)},
    api_verified:true
   });
  }
  return {rows,source:j.source||'',degraded:!!j.searchDegraded,error:null};
 }catch(e){return {rows:[],source:'',degraded:false,error:String(e.message||e).slice(0,180)}}
}
async function nativeXStatus(ref,fallback=''){
 let text=String(fallback||''),native_verified=false;
 try{
  const html=await textPage(ref.url,{timeout_ms:5000});
  const key=Buffer.from('Tweet:'+ref.id).toString('base64').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const d=html.match(new RegExp('"client:'+key+':details"[\\s\\S]{0,1800}?full_text:"((?:\\\\.|[^"\\\\])*)"'));
  if(d?.[1]){text=decodeX(d[1]);native_verified=true}
  else{
   const og=html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
   if(og?.[1]){text=entityDecode(og[1]);native_verified=true}
  }
 }catch{}
 return {text,native_verified};
}
function cryptoNarrativeContext(text=''){
 return /(?:\$[A-Za-z0-9_]{2,}|\b(?:token|coin|mcap|market cap|fdv|liquidity|launchpad|dex|pool|holders?|supply|buyback|burn|volume|price|chain|solana|ethereum|base|robinhood|meteora|uniswap|raydium|contract|\bCA:)\b)/i.test(String(text));
}
function narrativeQualityGate(text='',tags=[]){
 const s=String(text);
 const promo=/\b(?:AI Signal|DEXSCREENER BOOST|DEXSCREENER UPDATE|INFLUENCER SIGNAL|PUMP WATCH|MOST VIEWED|METEORA_PAIR|GMGN|Quick Buy|call to ATH|profit on|\d+(?:\.\d+)?x profit|\d+(?:\.\d+)?x up|100x|1000x|entry now|take profit|ape now|buy now|send it|gem call|alpha call|pumping calls|calls available|telegram|tg chads|join my|receipts loaded|vote matters|less than 100 votes|listing id|every vote counts|community vote dashboard|top 100 leaderboard|giveaway|giveaways|pay it forward|sol address)\b/i.test(s);
 const automated=/NEW GRADUATION ON|just graduated from|graduated from (?:its|the) bonding curve|DEXSCREENER (?:BOOST|UPDATE)|Quick Swap|Not financial advice\s*[·-]\s*automated radar|DEV HOLDS\s+\d+(?:\.\d+)?%\s+OF SUPPLY|radar stats:|SECURITY SNAPSHOT|PUMP AMM BREAKOUT/i.test(s)||(/Market Cap:/i.test(s)&&/Volume:/i.test(s)&&/Age:/i.test(s));
 const nonThesis=/SCAM ALERT|bundled at launch|funding-linked|received mine here|token distribution for the community|airdrop|claim(?:ed)? (?:now|here)|free tokens?|wallet connect/i.test(s);
 if(promo||automated||nonThesis)return false;
 const causal=/\b(?:because|why|therefore|means|driven by|market share|dominance|revenue|fees?|cash flow|buyback|burn|liquidity|flywheel|mechanism|tokenomics|distribution|supply|adoption|volume growth|undervalued|multiple|compared|versus|vs\.?|catalyst|migration|integration|pair|paired|pairing|reflection|symbiosis|viral|views?|creator|official|bio|instagram|tiktok|youtube|top holders?|dev holds?|bubblemap|snipers?|insiders?|cluster|bundlers?|most traded|top traded|network effect)\b/i.test(s);
 if(!causal)return false;
 const structure=tags.some(x=>['revenue','mechanism','comparison'].includes(x));
 const memeThesis=tags.includes('lore')&&/\b(?:pair|paired|pairing|reflection|symbiosis|meta|doge|pepe|wojak|kabosu|sister|cat coin|dog coin)\b/i.test(s)&&(tags.includes('social')||tags.includes('comparison')||tags.includes('traction'));
 const socialThesis=tags.includes('social')&&/\b(?:viral|views?|creator|official|bio|instagram|tiktok|youtube|videos?|followers?)\b/i.test(s)&&(tags.includes('catalyst')||tags.includes('traction')||tags.includes('holders'));
 const holderThesis=tags.includes('holders')&&/\b(?:top holders?|dev holds?|dev holding|snipers?|insiders?|cluster|bubblemap|bundlers?|holder structure)\b/i.test(s)&&(tags.includes('traction')||tags.includes('social'));
 const tractionThesis=tags.includes('traction')&&/\b(?:most traded|top traded|volume|liquidity|buys?|transactions?|network effect|adoption)\b/i.test(s)&&(tags.includes('lore')||tags.includes('product')||tags.includes('holders')||tags.includes('comparison'));
 const productThesis=tags.includes('product')&&causal;
 return (structure||memeThesis||socialThesis||holderThesis||tractionThesis||productThesis)&&s.length>=80&&tags.length>=2;
}
export function gradeNarrativeCall({posted_at,qualified_at,born_at,native_verified=false,text=''}) {
 const s=String(text),pt=Date.parse(posted_at||''),qt=Date.parse(qualified_at||''),bt=Date.parse(born_at||''),tags=narrativeSignals(s),context=cryptoNarrativeContext(s);
 const early=Number.isFinite(pt)&&Number.isFinite(qt)&&pt<=qt&&(!Number.isFinite(bt)||pt>=bt-24*3600000);
 const quality=narrativeQualityGate(s,tags);
 if(early&&native_verified&&context&&tags.length>=2&&quality)return 'VERIFIED EARLY';
 if(early&&context&&tags.length>=2&&quality)return 'INDEXED EARLY';
 if(!early&&context&&tags.length>=2&&quality)return 'LATE THESIS';
 return 'MENTION';
}
function mergeCalls(oldCalls=[],newCalls=[]){
 const m=new Map();
 for(const x of [...oldCalls,...newCalls]){
  const k=x.status_id||x.url;if(!k)continue;
  const prev=m.get(k);
  if(!prev||String(x.text||'').length>String(prev.text||'').length||x.native_verified&&!prev.native_verified)m.set(k,{...prev,...x});
 }
 return [...m.values()].sort((a,b)=>Date.parse(a.posted_at||0)-Date.parse(b.posted_at||0)).slice(0,16);
}
export function cleanStoredCalls(items=[]){
 let before=0,after=0,removed=0,regraded=0;
 for(const p of items){
  const original=Array.isArray(p.calls)?p.calls:[];
  before+=original.length;
  const kept=[];
  for(const old of original){
   const text=String(old.text||'');
   if(!matchTicker({text},p)){removed++;continue}
   const grade=gradeNarrativeCall({
    posted_at:old.posted_at,
    qualified_at:p.first_qualified_at,
    born_at:p.pair_created_at,
    native_verified:!!(old.source_verified||old.native_verified||old.api_verified),
    text
   });
   const tags=narrativeSignals(text);
   if(grade==='MENTION'||tags.length<2||!narrativeQualityGate(text,tags)){removed++;continue}
   if(grade!==old.grade)regraded++;
   kept.push({...old,grade,narrative_tags:tags});
  }
  p.calls=mergeCalls([],kept);
  after+=p.calls.length;
  const hasEarly=p.calls.some(x=>x.grade==='VERIFIED EARLY'||x.grade==='INDEXED EARLY');
  if(!hasEarly&&p.narrative_search_status==='links_found')p.narrative_search_status='searched_no_match';
 }
 return {before,after,removed,regraded};
}
function searchDue(p,now=Date.now()){
 const last=Date.parse(p.last_narrative_scan_at||0),age=now-Date.parse(p.first_qualified_at||now),hasVerified=(p.calls||[]).some(x=>x.grade==='VERIFIED EARLY');
 const every=hasVerified?6*3600000:age<6*3600000?6*60000:age<48*3600000?24*60000:3*3600000;
 return p.narrative_scan_version!==NARRATIVE_SCAN_VERSION||!Number.isFinite(last)||now-last>=every;
}
async function discoverIndexedCalls(pumps,now=Date.now()){
 const health={provider:'x-md-live',xmd_queries:0,xmd_statuses:0,xmd_sources:{},xmd_degraded:0,indexed_statuses:0,source_verified:0,calls_added:0,retry:0,errors:[]};
 const due=pumps.filter(x=>searchDue(x,now)).sort((a,b)=>Date.parse(b.first_qualified_at)-Date.parse(a.first_qualified_at)).slice(0,4);
 for(const p of due){
  health.xmd_queries++;
  const live=await xMdSearch(p);
  if(live.error){
   health.retry++;
   health.errors.push(p.symbol+' xmd: '+live.error);
   p.narrative_search_status='retry';
   p.narrative_scan_version=NARRATIVE_SCAN_VERSION;
   // Do not advance last_narrative_scan_at on provider failure: next cloud run retries it.
   continue;
  }
  const refs=[...new Map(live.rows.map(x=>[x.id,x])).values()].slice(0,30),calls=[];
  health.xmd_statuses+=refs.length;
  health.indexed_statuses+=refs.length;
  if(live.source)health.xmd_sources[live.source]=(health.xmd_sources[live.source]||0)+refs.length;
  if(live.degraded)health.xmd_degraded++;
  for(const ref of refs){
   const posted_at=ref.posted_at||tweetDateFromSnowflake(ref.id),text=String(ref.snippet||'');
   if(!posted_at||!matchTicker({text},p))continue;
   const source_verified=!!ref.api_verified;
   const grade=gradeNarrativeCall({posted_at,qualified_at:p.first_qualified_at,born_at:p.pair_created_at,native_verified:source_verified,text});
   const tags=narrativeSignals(text);
   if(grade==='MENTION'||tags.length<2||!narrativeQualityGate(text,tags))continue;
   const quality=Math.min(100,tags.length*18+Math.min(28,text.length/8));
   calls.push({
    account:'@'+ref.handle,status_id:ref.id,posted_at,text,url:ref.url,grade,
    native_verified:false,api_verified:true,source_verified,
    narrative_score:Math.round(quality),narrative_tags:tags,
    discovery:'cloud-live-x-search',provider:ref.provider,metrics:ref.metrics||{},
    mcap_note:'posted before first pump detection; detection MC '+(p.first_seen_mcap||'unknown')
   });
   health.source_verified++;
  }
  const cleaned=(p.calls||[]).filter(old=>{
   const text=String(old.text||'');
   if(!matchTicker({text},p))return false;
   const grade=gradeNarrativeCall({
    posted_at:old.posted_at,qualified_at:p.first_qualified_at,born_at:p.pair_created_at,
    native_verified:!!(old.source_verified||old.native_verified||old.api_verified),text
   });
   return grade!=='MENTION';
  }).map(old=>({...old,grade:gradeNarrativeCall({
   posted_at:old.posted_at,qualified_at:p.first_qualified_at,born_at:p.pair_created_at,
   native_verified:!!(old.source_verified||old.native_verified||old.api_verified),text:String(old.text||'')
  })}));
  const before=cleaned.length;
  p.calls=mergeCalls(cleaned,calls);
  health.calls_added+=Math.max(0,p.calls.length-before);
  p.last_narrative_scan_at=new Date(now).toISOString();
  p.narrative_scan_version=NARRATIVE_SCAN_VERSION;
  p.narrative_search_status=p.calls.some(x=>x.grade==='VERIFIED EARLY'||x.grade==='INDEXED EARLY')?'links_found':'searched_no_match';
 }
 return health;
}
const AMBIGUOUS_TICKERS=new Set(['AI','SI','BONK','PEPE','DOGE','DOG','CAT','OIL','HAPPY','SORRY','USELESS','WIF','PUMP','TRUMP','MAGA','BTC','ETH','SOL','BNB','AVAX','LINK','UNI','ARB','OP','SUI','SEI','APT']);
export function matchTicker(post,x){
 const text=String(post.text||''),lower=text.toLowerCase(),symRaw=String(x.symbol||''),sym=symRaw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),addr=String(x.token_address||'').toLowerCase();
 if(addr&&addr.length>=20&&lower.includes(addr))return true;
 const foreign=[
  ...[...text.matchAll(/0x[a-fA-F0-9]{40}/g)].map(m=>m[0].toLowerCase()),
  ...[...text.matchAll(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g)].map(m=>m[0].toLowerCase())
 ].filter(v=>v!==addr);
 if(foreign.length)return false;
 const hasCashtag=!!sym&&new RegExp('\\$'+sym+'(?:\\b|(?=[^A-Za-z0-9_]|$))','i').test(text);
 if(!hasCashtag)return false;
 const name=String(x.name||'').trim();
 const distinctName=!!name&&name.toLowerCase()!==symRaw.toLowerCase()&&name.length>=4&&lower.includes(name.toLowerCase());
 const network=String(x.network||'').replace(/[-_]/g,' ').trim().toLowerCase();
 const aliases=network==='robinhood'?['robinhood','rh chain','pons','fomo']:
  network==='solana'?['solana','pump.fun','pumpfun','raydium','meteora']:
  network==='base'?['base','coinbase']:
  network==='ethereum'?['ethereum','uniswap']:
  network==='arc'?['arc chain','arc network','arc']:(network.length>=4?[network]:[]);
 const chainContext=aliases.some(k=>lower.includes(k));
 return distinctName&&chainContext;
}
async function scanPublicWatchlist(pumps,now=Date.now()){
 const posts=[];
 for(const handle of WATCHLIST){
  try{
   const r=await fetch('https://x.com/'+handle,{headers:{'user-agent':'Mozilla/5.0 (compatible; ProjectRadar/1.0)','accept-language':'en-US,en;q=.9'},signal:AbortSignal.timeout(12000)});
   if(r.ok)posts.push(...xProfileRows(await r.text(),handle));
  }catch{}
  await sleep(120);
 }
 for(const p of pumps){
  const born=Date.parse(p.pair_created_at||0),qual=Date.parse(p.first_qualified_at||new Date(now).toISOString());
  const calls=[];
  for(const post of posts){
   if(!matchTicker(post,p))continue;
   const pt=Date.parse(post.posted_at),early=Number.isFinite(pt)&&pt<=qual&&(!Number.isFinite(born)||pt>=born-12*3600000);
   const tags=narrativeSignals(post.text),quality=Math.min(100,tags.length*18+Math.min(28,post.text.length/8));
   calls.push({...post,grade:early?'VERIFIED EARLY':'LATE THESIS',narrative_score:Math.round(quality),narrative_tags:tags});
  }
  p.calls=mergeCalls(p.calls||[],calls);
 }
}
async function scanXApi(pumps,now=Date.now()){
 const token=process.env.X_BEARER_TOKEN?.trim();if(!token)return {enabled:false,reads:0};
 let reads=0;
 for(const p of pumps.slice(0,12)){
  const q='("$'+p.symbol+'" OR "'+p.token_address+'") -is:retweet lang:en';
  const u=new URL('https://api.x.com/2/tweets/search/recent');u.searchParams.set('query',q);u.searchParams.set('max_results','50');u.searchParams.set('tweet.fields','created_at,author_id,public_metrics');u.searchParams.set('expansions','author_id');u.searchParams.set('user.fields','username,name');
  try{
   const j=await json(u,{headers:{authorization:'Bearer '+token}});reads+=(j.data||[]).length;
   const users=new Map((j.includes?.users||[]).map(x=>[x.id,x]));
   const born=Date.parse(p.pair_created_at||0),qual=Date.parse(p.first_qualified_at);
   for(const t of j.data||[]){
    const pt=Date.parse(t.created_at);if(Number.isFinite(born)&&pt<born-12*3600000)continue;
    const user=users.get(t.author_id)||{};
    if(!matchTicker({text:t.text},p)||/radar|alerts?|signals?|scanner|tracker|bot/i.test(String(user.username||'')))continue;
    const tags=narrativeSignals(t.text),quality=Math.min(100,tags.length*18+Math.min(28,String(t.text).length/8));
    const call={account:user.username?'@'+user.username:'X user',status_id:t.id,posted_at:t.created_at,text:t.text,url:'https://x.com/'+(user.username||'i')+'/status/'+t.id,grade:pt<=qual?'VERIFIED EARLY':'LATE THESIS',narrative_score:Math.round(quality),narrative_tags:tags,metrics:t.public_metrics||{}};
    if(!(p.calls||[]).some(x=>x.status_id===call.status_id))p.calls=(p.calls||[]).concat(call);
   }
   p.calls.sort((a,b)=>Date.parse(a.posted_at)-Date.parse(b.posted_at));p.calls=p.calls.slice(0,12);
  }catch{}
  await sleep(150);
 }
 return {enabled:true,reads};
}
async function gtCandidates(){
 const urls=['https://api.geckoterminal.com/api/v2/networks/trending_pools?include=base_token,dex','https://api.geckoterminal.com/api/v2/networks/new_pools?include=base_token,dex'];
 const out=[];
 for(const [i,u] of urls.entries()){
  try{const j=await json(u,{headers:{accept:'application/json;version=20230203'}}),inc=new Map((j.included||[]).filter(x=>x.type==='token').map(x=>[x.id,x.attributes||{}]));for(const row of j.data||[])out.push(normalizeGt(row,inc,i?'geckoterminal:new':'geckoterminal:trending'));}catch(e){console.error('GT',e.message)}
  await sleep(300);
 }
 return out;
}
async function dsCandidates(){
 let seeds=[];
 for(const [name,u] of [['profile','https://api.dexscreener.com/token-profiles/latest/v1'],['boost','https://api.dexscreener.com/token-boosts/top/v1'],['boost-latest','https://api.dexscreener.com/token-boosts/latest/v1']]){
  try{const j=await json(u);for(const x of Array.isArray(j)?j:[])if(x.chainId&&x.tokenAddress)seeds.push({...x,_source:'dexscreener:'+name})}catch(e){console.error('DS seed',e.message)}
 }
 seeds=[...new Map(seeds.map(x=>[x.chainId+':'+x.tokenAddress,x])).values()].slice(0,28);
 const out=[];
 for(let i=0;i<seeds.length;i+=5){
  const batch=seeds.slice(i,i+5);
  const res=await Promise.allSettled(batch.map(async s=>{const pairs=await json('https://api.dexscreener.com/token-pairs/v1/'+encodeURIComponent(s.chainId)+'/'+encodeURIComponent(s.tokenAddress));if(!Array.isArray(pairs)||!pairs.length)return null;const p=[...pairs].sort((a,b)=>num(b.liquidity?.usd)-num(a.liquidity?.usd))[0];return normalizeDs(p,s._source)}));
  for(const r of res)if(r.status==='fulfilled'&&r.value)out.push(r.value);
  await sleep(180);
 }
 return out;
}
function dexChainAlias(network=''){
 const n=String(network).toLowerCase();
 return ({eth:'ethereum',ethereum:'ethereum',bsc:'bsc',polygon_pos:'polygon',polygon:'polygon',avax:'avalanche',avalanche:'avalanche',arb:'arbitrum',arbitrum:'arbitrum',optimism:'optimism',base:'base',solana:'solana',robinhood:'robinhood',arc:'arc'})[n]||n;
}
async function refreshRetained(previous,currentKeys){
 const targets=(previous.items||[]).filter(x=>
  x?.token_address&&x?.key&&String(x.symbol||'').length>0&&String(x.symbol||'').length<=32&&!currentKeys.has(x.key)
 ).slice(0,30);
 const out=[];
 for(let i=0;i<targets.length;i+=5){
  const batch=targets.slice(i,i+5);
  const res=await Promise.allSettled(batch.map(async old=>{
   const j=await json('https://api.dexscreener.com/latest/dex/tokens/'+encodeURIComponent(old.token_address));
   const pairs=Array.isArray(j?.pairs)?j.pairs:[];
   if(!pairs.length)return null;
   const wanted=dexChainAlias(old.network);
   const matched=pairs.filter(p=>dexChainAlias(p.chainId)===wanted);
   const pool=(matched.length?matched:(pairs.length===1?pairs:[])).sort((a,b)=>num(b.liquidity?.usd)-num(a.liquidity?.usd))[0];
   if(!pool)return null;
   const row=normalizeDs(pool,'dexscreener:retained-refresh');
   return {...row,key:old.key,network:old.network,token_address:old.token_address};
  }));
  for(const r of res)if(r.status==='fulfilled'&&r.value)out.push(r.value);
  await sleep(160);
 }
 return out;
}
function sourceRank(source=''){return String(source).startsWith('dexscreener:')?2:1}
function mergeCurrent(rows){
 const m=new Map();
 for(const x of rows){
  if(!x.key||!x.symbol)continue;
  const prev=m.get(x.key),xr=sourceRank(x.source),pr=prev?sourceRank(prev.source):0;
  if(!prev||xr>pr||(xr===pr&&x.liquidity_usd>prev.liquidity_usd))m.set(x.key,x);
 }
 return [...m.values()];
}
function loadPrev(){try{return JSON.parse(fs.readFileSync(OUT,'utf8'))}catch{return {items:[]}}}
function originAtDetection(pairCreatedAt,firstQualifiedAt,now=Date.now()){
 const born=Date.parse(pairCreatedAt||''),first=Date.parse(firstQualifiedAt||'');
 if(Number.isFinite(born)&&Number.isFinite(first))return first-born>168*3600000?'REVIVAL':'NEW';
 return 'NEW';
}
function preserve(current,previous,now=Date.now()){
 const old=new Map((previous.items||[]).map(x=>[x.key,x]));
 const currentMap=new Map(current.map(x=>[x.key,x]));
 const out=[];

 for(const x of current.filter(x=>qualifiesPump(x,now))){
  const p=old.get(x.key),mc=x.market_cap||x.fdv;
  const firstQualified=p?.first_qualified_at||new Date(now).toISOString();
  let firstSeen=p?.first_seen_mcap||mc,prevPeak=num(p?.peak_mcap),metricReset=false;
  if(p&&sourceRank(x.source)>sourceRank(p.source)){
   const pc=num(p.current_mcap||p.market_cap||p.fdv),pp=num(p.price_usd),np=num(x.price_usd),age=now-Date.parse(p.first_qualified_at||0);
   if(pc>0&&mc>0&&pp>0&&np>0&&Number.isFinite(age)&&age<=10*60_000){
    const mr=mc/pc,pr=np/pp,div=Math.max(mr/pr,pr/mr);
    if(div>=8){firstSeen=mc;prevPeak=mc;metricReset=true}
   }
  }
  out.push({...p,...x,
   first_qualified_at:firstQualified,
   first_seen_mcap:firstSeen,
   estimated_pre_pump_mcap:metricReset?null:(p?.estimated_pre_pump_mcap||estimatedPreMcap(x)),
   peak_mcap:Math.max(prevPeak,mc),
   peak_gain_from_detection:metricReset?1:(firstSeen?Math.max(num(p?.peak_gain_from_detection),mc/firstSeen):1),
   pump_score:pumpScore(x,now),
   pump_stage:pumpStage(x),
   pump_origin:p?.pump_origin||originAtDetection(x.pair_created_at,firstQualified,now),
   calls:p?.calls||[]
  });
 }

 for(const p of previous.items||[]){
  const sane=!!p?.key&&!!p?.symbol&&String(p.symbol).length<=32&&!STABLE.test(String(p.symbol));
  const fresh=now-Date.parse(p.last_seen_at||p.first_qualified_at||0)<KEEP_MS;
  if(!sane||!fresh||out.some(x=>x.key===p.key))continue;

  const live=currentMap.get(p.key);
  if(live){
   const mc=live.market_cap||live.fdv;
   const firstSeen=p.first_seen_mcap||mc;
   out.push({...p,...live,
    first_qualified_at:p.first_qualified_at,
    first_seen_mcap:firstSeen,
    estimated_pre_pump_mcap:p.estimated_pre_pump_mcap,
    peak_mcap:Math.max(num(p.peak_mcap),mc),
    peak_gain_from_detection:firstSeen?Math.max(num(p.peak_gain_from_detection),mc/firstSeen):num(p.peak_gain_from_detection)||1,
    pump_score:p.pump_score,
    pump_stage:p.pump_stage,
    pump_origin:p.pump_origin||originAtDetection(p.pair_created_at,p.first_qualified_at,now),
    calls:p.calls||[]
   });
  }else{
   out.push({...p,pump_origin:p.pump_origin||originAtDetection(p.pair_created_at,p.first_qualified_at,now)});
  }
 }

 return out.sort((a,b)=>(b.pump_score||0)-(a.pump_score||0)).slice(0,MAX_ITEMS);
}
export async function runCollector(now=Date.now()){
 const previous=loadPrev();
 const discovered=mergeCurrent([...(await gtCandidates()),...(await dsCandidates())]);
 const retainedRefresh=await refreshRetained(previous,new Set(discovered.map(x=>x.key)));
 const rows=mergeCurrent([...discovered,...retainedRefresh]);
 const items=preserve(rows,previous,now);

 for(const x of items){
  const live=rows.find(y=>y.key===x.key);
  x.last_seen_at=live?new Date(now).toISOString():(x.last_seen_at||x.first_qualified_at);
  if(!x.pump_origin)x.pump_origin=originAtDetection(x.pair_created_at,x.first_qualified_at,now);
  x.x_search_url='https://x.com/search?q='+encodeURIComponent('$'+x.symbol+' '+x.token_address)+'&src=typed_query&f=live';
 }

 await scanPublicWatchlist(items.filter(x=>now-Date.parse(x.first_qualified_at)<72*3600000),now);
 const xApi=await scanXApi(items.filter(x=>now-Date.parse(x.first_qualified_at)<72*3600000),now);
 const cleanup=cleanStoredCalls(items);
 const indexed=await discoverIndexedCalls(items.filter(x=>now-Date.parse(x.first_qualified_at)<7*24*3600000),now);

 const payload={
  ok:true,
  version:'pump-winners-v1',
  generated_at:new Date(now).toISOString(),
  refresh_minutes:5,
  method:{
   criteria:'NEW <=7d: liquidity >=12k + fast move/volume/buy-flow; REVIVAL 7..90d: liquidity >=20k + stricter 1h/6h/24h breakout; MC/FDV 30k..75m',
   sources:['GeckoTerminal trending/new pools','DEX Screener latest profiles/boosts','DEX Screener retained-token refresh'],
   note:'estimated_pre_pump_mcap is reconstructed from current MC and available percentage-change window; it is not an exact historical snapshot'
  },
  x:{official_api_enabled:xApi.enabled,reads:xApi.reads,public_watchlist:WATCHLIST,cleanup,index_search:indexed},
  items
 };
 fs.mkdirSync(OUT.split('/').slice(0,-1).join('/'),{recursive:true});
 fs.writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n');
 return payload;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const p=await runCollector();console.log(JSON.stringify({ok:true,total:p.items.length,generated_at:p.generated_at,top:p.items.slice(0,10).map(x=>({symbol:x.symbol,stage:x.pump_stage,score:x.pump_score,mcap:x.market_cap,change:x.change,calls:x.calls?.length||0}))}));
}
