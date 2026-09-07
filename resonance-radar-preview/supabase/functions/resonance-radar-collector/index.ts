import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

type Side = 'BUY' | 'SELL'
type Trade = {
  provider_trade_id: string
  chain: string
  wallet_address: string
  trader_key: string
  trader_label: string | null
  cluster_key: string
  trader_score: number
  token_address: string
  symbol: string
  side: Side
  amount_usd: number
  amount_token: number | null
  price: number | null
  liquidity_usd: number | null
  market_cap_usd: number | null
  tx_hash: string | null
  executed_at: string
  received_at?: string
}
type RadarState = {
  chain: string; tokenAddress: string; symbol: string; score: number
  signalType: 'BUY_RESONANCE'|'SELL_RESONANCE'|'REVERSAL'|'ACCELERATION'|'WATCH'
  buyers5m: number; buyers15m: number; buyers60m: number; sellers15m: number
  buyVolume15m: number; sellVolume15m: number; netFlow15m: number
  liquidityUsd: number|null; marketCapUsd: number|null; topTraders: number
  firstSeenAt: string; lastTradeAt: string; flags: string[]
}
type TrackedWallet = { address:string; chain:string; traderKey:string; traderLabel:string; clusterKey:string; traderScore:number }

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
function secretKey() {
  try {
    const values = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    if (values.default) return String(values.default)
  } catch {}
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
}
const SB_KEY = secretKey()
const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' }
const clamp = (n:number,min=0,max=100)=>Math.max(min,Math.min(max,n))
const num = (v:unknown)=>{ const n=Number(v); return Number.isFinite(n)?n:0 }
const nullableNum = (v:unknown)=>{ const n=Number(v); return v==null||!Number.isFinite(n)?null:n }

async function db(path:string, init:RequestInit={}) {
  if (!SB_URL || !SB_KEY) throw new Error('Supabase admin environment is unavailable')
  const headers = new Headers(init.headers)
  headers.set('apikey', SB_KEY)
  if (!headers.has('content-type')) headers.set('content-type','application/json')
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status} ${path}: ${text.slice(0,400)}`)
  return text ? JSON.parse(text) : null
}

async function stateValue(key:string) {
  const rows = await db(`collector_state?key=eq.${encodeURIComponent(key)}&select=value&limit=1`) as Array<{value:Record<string,unknown>}>
  return rows?.[0]?.value || {}
}
async function setStateValue(key:string,value:Record<string,unknown>) {
  await db('collector_state?on_conflict=key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{key,value,updated_at:new Date().toISOString()}])})
}
async function expectedSecret(key:string) {
  const v = await stateValue(key)
  return typeof v.secret==='string' ? v.secret : ''
}

async function trackedWallets():Promise<TrackedWallet[]> {
  const wallets = await db('wallets?is_active=eq.true&chain=eq.solana&select=address,chain,cluster_id,trader_id&limit=100000') as Array<{address:string;chain:string;cluster_id:string|null;trader_id:string|null}>
  const ids=[...new Set(wallets.map(x=>x.trader_id).filter(Boolean))] as string[]
  const traderMap=new Map<string,{external_key:string;label:string|null;score:number}>()
  if(ids.length){
    const traders=await db(`traders?id=in.(${ids.map(encodeURIComponent).join(',')})&status=eq.active&select=id,external_key,label,score&limit=100000`) as Array<{id:string;external_key:string;label:string|null;score:number}>
    traders.forEach(t=>traderMap.set(t.id,t))
  }
  return wallets.map(w=>{const t=w.trader_id?traderMap.get(w.trader_id):undefined;const key=t?.external_key||w.address;return{address:w.address,chain:w.chain,traderKey:key,traderLabel:t?.label||key,clusterKey:w.cluster_id||key,traderScore:num(t?.score||50)}})
}

const BASE_MINTS=new Set(['So11111111111111111111111111111111111111112','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v','Es9vMFrzaCERmJfrF4H2FYD7Vt2B6x6qS31Yf3ZZ3'])
type Candidate={signature:string;walletAddress:string;tokenAddress:string;side:Side;amountToken:number;executedAt:string}
function toIso(v:unknown){if(typeof v==='number'&&Number.isFinite(v))return new Date(v*1000).toISOString();const d=new Date(String(v??Date.now()));return Number.isFinite(d.getTime())?d.toISOString():new Date().toISOString()}
function extractCandidates(payload:unknown,wallets:TrackedWallet[]):Candidate[]{
  const tracked=new Set(wallets.map(w=>w.address)),txs=Array.isArray(payload)?payload:[payload],out=new Map<string,Candidate>()
  for(const raw of txs){
    if(!raw||typeof raw!=='object')continue
    const tx=raw as any
    if(!tx.signature||tx.transactionError)continue
    const at=toIso(tx.timestamp);let usedBalance=false
    for(const account of tx.accountData||[]){for(const ch of account.tokenBalanceChanges||[]){
      const wallet=ch.userAccount,mint=ch.mint;if(!wallet||!mint||!tracked.has(wallet)||BASE_MINTS.has(mint))continue
      const rawAmount=num(ch.rawTokenAmount?.tokenAmount),decimals=Math.max(0,num(ch.rawTokenAmount?.decimals)),signed=rawAmount/(10**decimals);if(!signed)continue
      usedBalance=true;const k=`${tx.signature}:${wallet}:${mint}`,old=out.get(k),combined=(old?(old.side==='BUY'?old.amountToken:-old.amountToken):0)+signed
      if(!combined){out.delete(k);continue}out.set(k,{signature:tx.signature,walletAddress:wallet,tokenAddress:mint,side:combined>0?'BUY':'SELL',amountToken:Math.abs(combined),executedAt:at})
    }}
    if(!usedBalance){for(const tr of tx.tokenTransfers||[]){
      const mint=tr.mint,amount=num(tr.tokenAmount);if(!mint||amount<=0||BASE_MINTS.has(mint))continue
      const wallet=tracked.has(tr.toUserAccount||'')?tr.toUserAccount:tracked.has(tr.fromUserAccount||'')?tr.fromUserAccount:null;if(!wallet)continue
      const side:Side=tr.toUserAccount===wallet?'BUY':'SELL';out.set(`${tx.signature}:${wallet}:${mint}`,{signature:tx.signature,walletAddress:wallet,tokenAddress:mint,side,amountToken:amount,executedAt:at})
    }}
  }
  return [...out.values()]
}

type Market={symbol:string;priceUsd:number|null;liquidityUsd:number|null;marketCapUsd:number|null}
async function markets(mints:string[]){
  const result=new Map<string,Market>(),unique=[...new Set(mints.filter(Boolean))]
  for(let i=0;i<unique.length;i+=30){const batch=unique.slice(i,i+30);try{
    const r=await fetch(`https://api.dexscreener.com/tokens/v1/solana/${batch.join(',')}`,{headers:{accept:'application/json','user-agent':'resonance-radar/0.3'}});if(!r.ok)continue
    const pairs=await r.json() as any[]
    for(const mint of batch){const candidates=(Array.isArray(pairs)?pairs:[]).filter(p=>p?.baseToken?.address===mint).sort((a,b)=>num(b?.liquidity?.usd)-num(a?.liquidity?.usd));const p=candidates[0];if(p)result.set(mint,{symbol:p.baseToken?.symbol||mint.slice(0,6).toUpperCase(),priceUsd:nullableNum(p.priceUsd),liquidityUsd:nullableNum(p.liquidity?.usd),marketCapUsd:nullableNum(p.marketCap)??nullableNum(p.fdv)})}
  }catch(e){console.error('market enrichment',e)}}
  return result
}

async function normalizeHelius(payload:unknown):Promise<Trade[]> {
  const wallets=await trackedWallets(),candidates=extractCandidates(payload,wallets);if(!candidates.length)return[]
  const wm=new Map(wallets.map(w=>[w.address,w])),market=await markets(candidates.map(x=>x.tokenAddress)),received=new Date().toISOString()
  return candidates.flatMap(c=>{const w=wm.get(c.walletAddress);if(!w)return[];const m=market.get(c.tokenAddress),price=m?.priceUsd??null;return [{provider_trade_id:`helius:${c.signature}:${c.walletAddress}:${c.tokenAddress}`,chain:'solana',wallet_address:c.walletAddress,trader_key:w.traderKey,trader_label:w.traderLabel,cluster_key:w.clusterKey,trader_score:w.traderScore,token_address:c.tokenAddress,symbol:m?.symbol||c.tokenAddress.slice(0,6).toUpperCase(),side:c.side,amount_usd:price==null?0:Math.round(c.amountToken*price*100)/100,amount_token:c.amountToken,price,liquidity_usd:m?.liquidityUsd??null,market_cap_usd:m?.marketCapUsd??null,tx_hash:c.signature,executed_at:c.executedAt,received_at:received} as Trade]})
}

function uniqueClusters(trades:Trade[],side?:Side){return new Set(trades.filter(t=>!side||t.side===side).map(t=>t.cluster_key)).size}
function uniqueTraderScore(count:number){if(count>=10)return 100;return [0,10,25,45,60,72,82,87,92,96,100][Math.max(0,Math.min(count,10))]||0}
function average(a:number[]){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
function timeDensity(buys:Trade[]){if(buys.length<2)return buys.length?25:0;const times=buys.map(t=>new Date(t.executed_at).getTime()).filter(Number.isFinite).sort((a,b)=>a-b);if(times.length<2)return 20;const spread=Math.max(.25,(times.at(-1)!-times[0])/60000);return clamp(100-spread*4.8+Math.min(25,uniqueClusters(buys,'BUY')*4))}
function volumeScore(v:number,l:number|null){if(v<=0)return 0;if(l&&l>0)return clamp(v/l*700);return clamp(Math.log10(v+1)*20)}
function liquidityScore(l:number|null){if(l==null)return 45;if(l>=2e6)return 100;if(l>=1e6)return 90;if(l>=5e5)return 78;if(l>=25e4)return 62;if(l>=15e4)return 48;return 20}
function netFlowScore(b:number,s:number){const g=b+s;return g<=0?0:clamp(((b-s)/g+1)*50)}
function calculate(trades:Trade[],previousType?:RadarState['signalType']):RadarState|null{
  if(!trades.length)return null;const now=Date.now(),within=(m:number)=>trades.filter(t=>now-new Date(t.executed_at).getTime()<=m*60000),t5=within(5),t15=within(15),t60=within(60),b15=t15.filter(t=>t.side==='BUY'),s15=t15.filter(t=>t.side==='SELL')
  const buyers5m=uniqueClusters(t5,'BUY'),buyers15m=uniqueClusters(t15,'BUY'),buyers60m=uniqueClusters(t60,'BUY'),sellers15m=uniqueClusters(t15,'SELL'),bv=b15.reduce((s,t)=>s+num(t.amount_usd),0),sv=s15.reduce((s,t)=>s+num(t.amount_usd),0),net=bv-sv
  const sorted=[...trades].sort((a,b)=>new Date(a.executed_at).getTime()-new Date(b.executed_at).getTime()),latest=sorted.at(-1)!,rev=[...trades].reverse(),liq=rev.find(t=>t.liquidity_usd!=null)?.liquidity_usd??null,mc=rev.find(t=>t.market_cap_usd!=null)?.market_cap_usd??null,quality=average(b15.map(t=>num(t.trader_score||50))),top=new Set(t15.filter(t=>t.trader_score>=75).map(t=>t.cluster_key)).size
  let score=clamp(Math.round(quality*.25+uniqueTraderScore(buyers15m)*.25+timeDensity(b15)*.15+netFlowScore(bv,sv)*.15+volumeScore(bv,liq)*.10+liquidityScore(liq)*.10)),flags:string[]=[]
  if(liq!=null&&liq<150000){flags.push('LOW_LIQUIDITY');score=Math.min(score,60)}
  const seller=sellers15m>=3&&sv>bv,buy=buyers15m>=3&&net>0,accel=buyers5m>=3&&buyers5m>=Math.max(3,Math.ceil(buyers15m*.55));let signalType:RadarState['signalType']='WATCH'
  if(seller&&(previousType==='BUY_RESONANCE'||previousType==='ACCELERATION')){signalType='REVERSAL';flags.push('EXITING')}else if(seller)signalType='SELL_RESONANCE';else if(accel&&buy)signalType='ACCELERATION';else if(buy)signalType='BUY_RESONANCE'
  return{chain:latest.chain,tokenAddress:latest.token_address,symbol:latest.symbol,score,signalType,buyers5m,buyers15m,buyers60m,sellers15m,buyVolume15m:Math.round(bv*100)/100,sellVolume15m:Math.round(sv*100)/100,netFlow15m:Math.round(net*100)/100,liquidityUsd:liq,marketCapUsd:mc,topTraders:top,firstSeenAt:sorted[0].executed_at,lastTradeAt:latest.executed_at,flags}
}

function alertReason(prev:any,next:RadarState){const ps=num(prev?.score),pt=String(prev?.signal_type||'WATCH');if(next.signalType==='REVERSAL'&&pt!=='REVERSAL')return'REVERSAL';if(next.signalType==='SELL_RESONANCE'&&pt!=='SELL_RESONANCE'&&next.sellers15m>=3)return'SELL_RESONANCE';if(ps<85&&next.score>=85)return'STRONG_SIGNAL';if(ps<70&&next.score>=70&&(next.signalType==='BUY_RESONANCE'||next.signalType==='ACCELERATION'))return'BUY_SIGNAL';return null}
async function telegram(s:RadarState,reason:string){const token=Deno.env.get('TELEGRAM_BOT_TOKEN'),chat=Deno.env.get('TELEGRAM_CHAT_ID');if(!token||!chat)return;const icon=reason==='REVERSAL'||reason==='SELL_RESONANCE'?'🔴':reason==='STRONG_SIGNAL'?'🔥':'🟢';const text=[`${icon} ${reason.replaceAll('_',' ')}`,`${s.symbol} · ${s.chain}`,`Score ${s.score}/100`,`Buyers 5m ${s.buyers5m} · 15m ${s.buyers15m} · 1h ${s.buyers60m}`,`Sellers 15m ${s.sellers15m}`,`15m Net $${Math.round(s.netFlow15m)}`,s.liquidityUsd==null?null:`Liquidity $${Math.round(s.liquidityUsd)}`,s.tokenAddress].filter(Boolean).join('\n');await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chat,text,disable_web_page_preview:true})})}

async function insertTrades(trades:Trade[]){if(!trades.length)return 0;const inserted=await db('trades?on_conflict=provider_trade_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify(trades)}) as any[];await db('radar_recent_trades_public?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(trades.map(t=>({id:t.provider_trade_id,trader_label:t.trader_label||'Tracked trader',side:t.side,symbol:t.symbol,amount_usd:t.amount_usd,executed_at:t.executed_at}))) });return Array.isArray(inserted)?inserted.length:0}
async function processToken(chain:string,token:string){const since=encodeURIComponent(new Date(Date.now()-3600000).toISOString());const [trades,prevRows]=await Promise.all([db(`trades?chain=eq.${encodeURIComponent(chain)}&token_address=eq.${encodeURIComponent(token)}&executed_at=gte.${since}&select=*&order=executed_at.asc&limit=5000`) as Promise<Trade[]>,db(`radar_current?chain=eq.${encodeURIComponent(chain)}&token_address=eq.${encodeURIComponent(token)}&select=*&limit=1`) as Promise<any[]>]);const prev=prevRows?.[0]||null,state=calculate(trades,prev?.signal_type);if(!state)return null;const reason=alertReason(prev,state);await db('radar_current?on_conflict=chain,token_address',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{chain:state.chain,token_address:state.tokenAddress,symbol:state.symbol,score:state.score,signal_type:state.signalType,buyers_5m:state.buyers5m,buyers_15m:state.buyers15m,buyers_60m:state.buyers60m,sellers_15m:state.sellers15m,buy_volume_15m:state.buyVolume15m,sell_volume_15m:state.sellVolume15m,net_flow_15m:state.netFlow15m,liquidity_usd:state.liquidityUsd,market_cap_usd:state.marketCapUsd,top_traders:state.topTraders,first_seen_at:state.firstSeenAt,last_trade_at:state.lastTradeAt,flags:state.flags,updated_at:new Date().toISOString()}])});if(reason){await db('signals',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{chain:state.chain,token_address:state.tokenAddress,symbol:state.symbol,score:state.score,signal_type:state.signalType,reason,buyers_5m:state.buyers5m,buyers_15m:state.buyers15m,buyers_60m:state.buyers60m,sellers_15m:state.sellers15m,net_flow_15m:state.netFlow15m}])});await telegram(state,reason)}return{state,reason}}
async function logRun(source:string,received:number,inserted:number,affected:number,started:number,error:string|null=null){await db('collector_runs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{source,status:error?'error':'ok',started_at:new Date(started).toISOString(),finished_at:new Date().toISOString(),events_received:received,events_inserted:inserted,affected_tokens:affected,alerts_sent:0,api_latency_ms:0,duration_ms:Date.now()-started,error}])})}

async function handleHelius(payload:unknown){const started=Date.now();try{const trades=await normalizeHelius(payload),inserted=await insertTrades(trades),keys=[...new Set(trades.map(t=>`${t.chain}|${t.token_address}`))];for(const key of keys){const [chain,token]=key.split('|');await processToken(chain,token)}await logRun('helius',trades.length,inserted,keys.length,started);return{ok:true,received:trades.length,inserted,affected:keys.length}}catch(e){const msg=e instanceof Error?e.message:String(e);await logRun('helius',0,0,0,started,msg).catch(()=>{});throw e}}
async function tick(){const started=Date.now(),since=new Date(Date.now()-3600000).toISOString();const rows=await db(`trades?executed_at=gte.${encodeURIComponent(since)}&select=chain,token_address&limit=10000`) as Array<{chain:string;token_address:string}>;const keys=[...new Set(rows.map(r=>`${r.chain}|${r.token_address}`))];if(!keys.length)return{ok:true,mode:'ready',affected:0};for(const key of keys){const [chain,token]=key.split('|');await processToken(chain,token)}await db(`radar_current?last_trade_at=lt.${encodeURIComponent(since)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});await logRun('supabase-cron',0,0,keys.length,started);return{ok:true,mode:'tick',affected:keys.length}}

function background(p:Promise<unknown>){const er=(globalThis as any).EdgeRuntime;if(er?.waitUntil)er.waitUntil(p);else p.catch(console.error)}

Deno.serve(async(req:Request)=>{
  try{
    if(req.method==='GET'){
      const wallets=await trackedWallets().catch(()=>[]),hasTrades=(await db('trades?select=id&limit=1').catch(()=>[])) as any[]
      return Response.json({ok:true,service:'resonance-radar-collector',runtime:'supabase-edge',cron:'1 minute',trackedSolanaWallets:wallets.length,dataStarted:Array.isArray(hasTrades)&&hasTrades.length>0,heliusApiKeyConfigured:!!Deno.env.get('HELIUS_API_KEY')},{headers:JSON_HEADERS})
    }
    if(req.method!=='POST')return Response.json({ok:false,error:'method_not_allowed'},{status:405,headers:JSON_HEADERS})
    const body=await req.json()
    if(body&&typeof body==='object'&&!Array.isArray(body)&&body.action==='tick'){
      const expected=await expectedSecret('edge_cron_secret');if(!expected||req.headers.get('x-radar-cron-secret')!==expected)return Response.json({ok:false,error:'unauthorized'},{status:401,headers:JSON_HEADERS})
      return Response.json(await tick(),{headers:JSON_HEADERS})
    }
    const expected=await expectedSecret('helius_webhook_secret');if(!expected||req.headers.get('authorization')!==expected)return Response.json({ok:false,error:'unauthorized'},{status:401,headers:JSON_HEADERS})
    background(handleHelius(body));return Response.json({ok:true,accepted:true},{status:202,headers:JSON_HEADERS})
  }catch(e){console.error(e);return Response.json({ok:false,error:e instanceof Error?e.message:'internal_error'},{status:500,headers:JSON_HEADERS})}
})
