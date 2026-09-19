import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const OUT='docs/rdr-c9x7m4q2p8v5/pump-winners.json';
const KEEP_MS=14*24*3600*1000;
const MAX_ITEMS=80;
const STABLE=/^(?:USDC|USDT|USDS|DAI|FDUSD|USDE|USD1|WETH|ETH|WBTC|BTC|SOL|WSOL|BNB|WBNB|WAVAX|AVAX)$/i;
const WATCHLIST=['neodot','theunipcs','DefiRabbitHole','elenakvcs','thebearjesus','longdotxyz'];

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
 if(!x.symbol||STABLE.test(x.symbol)||age>168||mc<30000||mc>75000000||liq<12000)return false;
 const c=x.change||{},v=x.volume||{},r1=buyRatio(x.txns?.h1),r24=buyRatio(x.txns?.h24);
 const fast=c.m5>=25&&v.m5>=8000&&r1>=1.15;
 const h1=c.h1>=55&&v.h1>=25000&&r1>=1.15;
 const h6=c.h6>=130&&v.h6>=75000&&r24>=1.05;
 const h24=c.h24>=250&&v.h24>=150000&&r24>=1.0;
 return fast||h1||h6||h24;
}
export function pumpScore(x,now=Date.now()){
 const age=ageHours(x,now),mc=Math.max(1,x.market_cap||x.fdv),c=x.change||{},v=x.volume||{};
 const move=Math.max(c.m5*1.6,c.h1,c.h6*.7,c.h24*.45,0);
 const volRatio=Math.max(v.h1/mc*100,v.h6/mc*55,v.h24/mc*25);
 const flow=Math.max(buyRatio(x.txns?.h1),buyRatio(x.txns?.h24));
 const liq=Math.min(20,x.liquidity_usd/mc*100);
 return clamp(Math.log2(1+move)*10+Math.log2(1+volRatio)*8+Math.min(14,(flow-1)*18)+liq+Math.max(0,12-age/14));
}
export function pumpStage(x){
 const c=x.change||{};
 if(c.m5>=60||c.h1>=120)return 'BREAKOUT';
 if(c.h6>=300||c.h24>=600)return 'WINNER';
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
 const rules=[['revenue',/revenue|fee|cash flow|buyback|burn/i],['product',/product|users?|launchpad|app|protocol|platform|infra/i],['mechanism',/mechanism|liquidity|flywheel|supply|distribution|tokenomics/i],['catalyst',/launch|mainnet|listing|integration|partnership|migration/i],['comparison',/vs\.?|versus|multiple|undervalued|market share|dominance/i]];
 for(const [k,re] of rules)if(re.test(text))tags.push(k);
 return tags;
}
function matchTicker(post,x){
 const sym=x.symbol.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),addr=x.token_address?.toLowerCase();
 if(new RegExp('\\$'+sym+'\\b','i').test(post.text))return true;
 if(sym.length>=4&&new RegExp('(?:^|[^A-Za-z0-9])'+sym+'(?:$|[^A-Za-z0-9])','i').test(post.text))return true;
 return addr&&addr.length>=20&&post.text.toLowerCase().includes(addr);
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
  p.calls=calls.sort((a,b)=>Date.parse(a.posted_at)-Date.parse(b.posted_at)).slice(0,8);
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
    const user=users.get(t.author_id)||{},tags=narrativeSignals(t.text),quality=Math.min(100,tags.length*18+Math.min(28,String(t.text).length/8));
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
function mergeCurrent(rows){
 const m=new Map();
 for(const x of rows){
  if(!x.key||!x.symbol)continue;
  const prev=m.get(x.key);if(!prev||x.liquidity_usd>prev.liquidity_usd)m.set(x.key,x);
 }
 return [...m.values()];
}
function loadPrev(){try{return JSON.parse(fs.readFileSync(OUT,'utf8'))}catch{return {items:[]}}}
function preserve(current,previous,now=Date.now()){
 const old=new Map((previous.items||[]).map(x=>[x.key,x])),out=[];
 for(const x of current.filter(x=>qualifiesPump(x,now))){
  const p=old.get(x.key),mc=x.market_cap||x.fdv;
  out.push({...p,...x,
   first_qualified_at:p?.first_qualified_at||new Date(now).toISOString(),
   first_seen_mcap:p?.first_seen_mcap||mc,
   estimated_pre_pump_mcap:p?.estimated_pre_pump_mcap||estimatedPreMcap(x),
   peak_mcap:Math.max(num(p?.peak_mcap),mc),
   peak_gain_from_detection:p?.first_seen_mcap?Math.max(num(p?.peak_gain_from_detection),mc/p.first_seen_mcap):1,
   pump_score:pumpScore(x,now),pump_stage:pumpStage(x),calls:p?.calls||[]
  });
 }
 for(const p of previous.items||[])if(!out.some(x=>x.key===p.key)&&now-Date.parse(p.last_seen_at||p.first_qualified_at||0)<KEEP_MS)out.push(p);
 return out.sort((a,b)=>(b.pump_score||0)-(a.pump_score||0)).slice(0,MAX_ITEMS);
}
export async function runCollector(now=Date.now()){
 const previous=loadPrev(),rows=mergeCurrent([...(await gtCandidates()),...(await dsCandidates())]);
 const items=preserve(rows,previous,now);
 for(const x of items){const live=rows.find(y=>y.key===x.key);x.last_seen_at=live?new Date(now).toISOString():(x.last_seen_at||x.first_qualified_at);x.x_search_url='https://x.com/search?q='+encodeURIComponent('$'+x.symbol+' '+x.token_address)+'&src=typed_query&f=live';}
 await scanPublicWatchlist(items.filter(x=>now-Date.parse(x.first_qualified_at)<48*3600000),now);
 const xApi=await scanXApi(items.filter(x=>now-Date.parse(x.first_qualified_at)<72*3600000),now);
 const payload={ok:true,version:'pump-winners-v1',generated_at:new Date(now).toISOString(),refresh_minutes:10,method:{criteria:'new pool <=7d + liquidity >=12k + MC/FDV 30k..75m + fast price move + volume + buy-flow gate',sources:['GeckoTerminal trending/new pools','DEX Screener latest profiles/boosts'],note:'estimated_pre_pump_mcap is reconstructed from current MC and available percentage-change window; it is not an exact historical snapshot'},x:{official_api_enabled:xApi.enabled,reads:xApi.reads,public_watchlist:WATCHLIST},items};
 fs.mkdirSync(OUT.split('/').slice(0,-1).join('/'),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n');
 return payload;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const p=await runCollector();console.log(JSON.stringify({ok:true,total:p.items.length,generated_at:p.generated_at,top:p.items.slice(0,10).map(x=>({symbol:x.symbol,stage:x.pump_stage,score:x.pump_score,mcap:x.market_cap,change:x.change,calls:x.calls?.length||0}))}));
}
