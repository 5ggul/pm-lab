import test from 'node:test';
import assert from 'node:assert/strict';
import {qualifiesPump,pumpScore,pumpStage,tweetDateFromSnowflake,gradeNarrativeCall,parseTwStalkerItems,matchTicker,cleanStoredCalls} from '../.github/scripts/project_radar_pumps.mjs';
const now=Date.parse('2026-09-20T00:00:00Z');
const base={symbol:'MOON',pair_created_at:'2026-09-19T18:00:00Z',market_cap:500000,fdv:500000,liquidity_usd:55000,change:{m5:8,h1:80,h6:170,h24:260},volume:{m5:5000,h1:90000,h6:230000,h24:500000},txns:{h1:{buys:220,sells:130},h24:{buys:900,sells:700}}};
test('qualifies real breakout with liquidity volume and buy flow',()=>assert.equal(qualifiesPump(base,now),true));
test('rejects low-liquidity fake pump',()=>assert.equal(qualifiesPump({...base,liquidity_usd:3000},now),false));
test('rejects stale pool',()=>assert.equal(qualifiesPump({...base,pair_created_at:'2026-09-01T00:00:00Z'},now),false));
test('rejects stable and wrapped majors',()=>{for(const symbol of ['USDC','WETH','SOL'])assert.equal(qualifiesPump({...base,symbol},now),false)});
test('scores and stages breakout deterministically',()=>{assert.ok(pumpScore(base,now)>50);assert.equal(pumpStage(base),'PUMPING');assert.equal(pumpStage({...base,change:{...base.change,h1:150}}),'BREAKOUT')});

test('tweet snowflake timestamp decodes without X API',()=>{
 const ms=Date.parse('2026-09-19T12:34:56.000Z');
 const id=((BigInt(ms)-1288834974657n)<<22n).toString();
 assert.equal(tweetDateFromSnowflake(id),'2026-09-19T12:34:56.000Z');
});
test('narrative grading separates verified, indexed and late calls',()=>{
 const common={qualified_at:'2026-09-19T13:00:00Z',born_at:'2026-09-19T10:00:00Z'};
 const thesis='This launchpad has fee revenue, buyback burn and a liquidity flywheel that can drive market share dominance.';
 assert.equal(gradeNarrativeCall({...common,posted_at:'2026-09-19T12:00:00Z',native_verified:true,text:thesis}),'VERIFIED EARLY');
 assert.equal(gradeNarrativeCall({...common,posted_at:'2026-09-19T12:00:00Z',native_verified:false,text:thesis}),'INDEXED EARLY');
 assert.equal(gradeNarrativeCall({...common,posted_at:'2026-09-19T14:00:00Z',native_verified:true,text:thesis}),'LATE THESIS');
});

test('TwStalker mirror parser extracts direct X status refs',()=>{
 const html='<article><div>alpha thesis on $MOON with fee revenue and liquidity flywheel</div><a href="/goodcaller/status/2093364643494330400">View Details</a></article>';
 const rows=parseTwStalkerItems(html);
 assert.equal(rows.length,1);
 assert.equal(rows[0].handle,'goodcaller');
 assert.equal(rows[0].id,'2093364643494330400');
 assert.equal(rows[0].url,'https://x.com/goodcaller/status/2093364643494330400');
 assert.match(rows[0].snippet,/MOON/);
});

test('ticker evidence requires cashtag or exact contract address',()=>{
 const token={symbol:'flaring',token_address:'MZmstebfwFjdt4mnA68Q2VTykLr9Je5xidxMwBwKing'};
 assert.equal(matchTicker({text:'My back pain is flaring up today'},token),false);
 assert.equal(matchTicker({text:'Watching $flaring liquidity and launchpad volume'},token),true);
 assert.equal(matchTicker({text:'CA: MZmstebfwFjdt4mnA68Q2VTykLr9Je5xidxMwBwKing'},token),true);
});

test('ambiguous tickers need contract, project name, or chain context',()=>{
 const ai={symbol:'AI',name:'Artificial Inu',network:'robinhood',token_address:'0x1234567890123456789012345678901234567890'};
 assert.equal(matchTicker({text:'I like $AI this week'},ai),false);
 assert.equal(matchTicker({text:'Watching $AI Artificial Inu liquidity flywheel'},ai),true);
 assert.equal(matchTicker({text:'$AI on robinhood is gaining launchpad volume'},ai),true);
 assert.equal(matchTicker({text:'CA 0x1234567890123456789012345678901234567890'},ai),true);
});

test('global cleanup removes stale generic-word X false positives without waiting for rescan',()=>{
 const items=[{
  symbol:'flaring',name:'flaring',network:'solana',
  token_address:'MZmstebfwFjdt4mnA68Q2VTykLr9Je5xidxMwBwKing',
  pair_created_at:'2026-09-19T10:00:00Z',first_qualified_at:'2026-09-19T13:00:00Z',
  narrative_search_status:'links_found',
  calls:[
   {status_id:'1',posted_at:'2026-09-19T12:00:00Z',text:'My back pain is flaring up today and I bought groceries after the gym.',grade:'INDEXED EARLY',api_verified:true},
   {status_id:'2',posted_at:'2026-09-19T12:10:00Z',text:'$flaring on Solana has launchpad volume, liquidity migration, fee revenue and a buyback mechanism.',grade:'INDEXED EARLY',api_verified:true}
  ]
 }];
 const result=cleanStoredCalls(items);
 assert.equal(result.removed,1);
 assert.equal(items[0].calls.length,1);
 assert.equal(items[0].calls[0].status_id,'2');
 assert.equal(items[0].narrative_search_status,'links_found');
});

test('promo signal posts are not promoted to narrative calls',()=>{
 const common={qualified_at:'2026-09-19T13:00:00Z',born_at:'2026-09-19T10:00:00Z'};
 const promo='🤖 AI Signal (SOL) $MOON CA: abcdefghijklmnopqrstuvwxyz1234567890 launchpad boost 348x profit on call to ATH';
 assert.equal(gradeNarrativeCall({...common,posted_at:'2026-09-19T12:00:00Z',native_verified:true,text:promo}),'MENTION');
});

test('rejects pathological ticker spam strings',()=>{
 assert.equal(qualifiesPump({...base,symbol:'L'.repeat(80)},now),false);
});
