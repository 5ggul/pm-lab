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

test('ticker evidence requires exact CA or project-name plus chain context',()=>{
 const token={symbol:'flaring',name:'Flaring Protocol',network:'solana',token_address:'MZmstebfwFjdt4mnA68Q2VTykLr9Je5xidxMwBwKing'};
 assert.equal(matchTicker({text:'My back pain is flaring up today'},token),false);
 assert.equal(matchTicker({text:'Watching $flaring liquidity and launchpad volume'},token),false);
 assert.equal(matchTicker({text:'Watching $flaring Flaring Protocol on Solana liquidity and launchpad volume'},token),true);
 assert.equal(matchTicker({text:'CA: MZmstebfwFjdt4mnA68Q2VTykLr9Je5xidxMwBwKing'},token),true);
});

test('ambiguous tickers need contract, project name, or chain context',()=>{
 const ai={symbol:'AI',name:'Artificial Inu',network:'robinhood',token_address:'0x1234567890123456789012345678901234567890'};
 assert.equal(matchTicker({text:'I like $AI this week'},ai),false);
 assert.equal(matchTicker({text:'Watching $AI Artificial Inu liquidity flywheel'},ai),false);
 assert.equal(matchTicker({text:'$AI on robinhood is gaining launchpad volume'},ai),false);
 assert.equal(matchTicker({text:'Watching $AI Artificial Inu on Robinhood with a liquidity flywheel'},ai),true);
 assert.equal(matchTicker({text:'CA 0x1234567890123456789012345678901234567890'},ai),true);
});

test('global cleanup removes stale generic-word X false positives without waiting for rescan',()=>{
 const items=[{
  symbol:'flaring',name:'Flaring Protocol',network:'solana',
  token_address:'MZmstebfwFjdt4mnA68Q2VTykLr9Je5xidxMwBwKing',
  pair_created_at:'2026-09-19T10:00:00Z',first_qualified_at:'2026-09-19T13:00:00Z',
  narrative_search_status:'links_found',
  calls:[
   {status_id:'1',posted_at:'2026-09-19T12:00:00Z',text:'My back pain is flaring up today and I bought groceries after the gym.',grade:'INDEXED EARLY',api_verified:true},
   {status_id:'2',posted_at:'2026-09-19T12:10:00Z',text:'$flaring Flaring Protocol on Solana has launchpad volume, liquidity migration, fee revenue and a buyback mechanism.',grade:'INDEXED EARLY',api_verified:true}
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

test('strict revival gate catches older low-cap breakouts but rejects weak old pools',()=>{
 const revival={...base,pair_created_at:'2026-09-10T00:00:00Z',liquidity_usd:35000,change:{m5:3,h1:125,h6:180,h24:220},volume:{m5:2000,h1:75000,h6:180000,h24:340000},txns:{h1:{buys:180,sells:110},h24:{buys:800,sells:650}}};
 assert.equal(qualifiesPump(revival,now),true);
 assert.equal(qualifiesPump({...revival,change:{m5:1,h1:40,h6:80,h24:100},volume:{m5:1000,h1:10000,h6:30000,h24:80000}},now),false);
});

test('detailed AI signal callbots are still excluded from Proven Callers',()=>{
 const common={qualified_at:'2026-09-19T13:00:00Z',born_at:'2026-09-19T10:00:00Z'};
 const bot='AI Signal (SOL) $MOON CA: abcdefghijklmnopqrstuvwxyz1234567890. Meteora liquidity mechanism, fee revenue, launch catalyst, supply migration and market share are all improving. 348x profit on call to ATH.';
 assert.equal(gradeNarrativeCall({...common,posted_at:'2026-09-19T12:00:00Z',native_verified:true,text:bot}),'MENTION');
});

test('meme lore plus social proof qualifies as an early narrative thesis',()=>{
 const common={qualified_at:'2026-09-19T13:00:00Z',born_at:'2026-09-19T10:00:00Z'};
 const thesis='$MOON pairs the PEPE meta with an official creator whose videos already have 20M viral views, while volume and community adoption are accelerating on Solana.';
 assert.equal(gradeNarrativeCall({...common,posted_at:'2026-09-19T12:00:00Z',native_verified:true,text:thesis}),'VERIFIED EARLY');
});

test('graduation stat bots are not narrative calls even when they contain mechanism words',()=>{
 const common={qualified_at:'2026-09-19T13:00:00Z',born_at:'2026-09-19T10:00:00Z'};
 const bot='NEW GRADUATION ON StonkFun $QUEEF just graduated from its bonding curve. Pair: Fartcoin Market Cap: $95.2K Volume: $41.5K Age: 59m CA: 4UHmZGe6X4DZ5dxYGiGXMhi3Sp34uPWtHB7qDMyvRbYB';
 assert.equal(gradeNarrativeCall({...common,posted_at:'2026-09-19T12:00:00Z',native_verified:true,text:bot}),'MENTION');
});

test('risk alerts and token-claim spam are not promoted as Proven Callers',()=>{
 const common={qualified_at:'2026-09-19T13:00:00Z',born_at:'2026-09-19T10:00:00Z'};
 const scam='SCAM ALERT - $STRYKER fresh wallets are funding-linked and bundled at launch, with holders and liquidity clustered around one source.';
 const claim='Tipped creators opened a token distribution for the community. Received mine here. $STRYKER holders and liquidity are growing after the launch.';
 assert.equal(gradeNarrativeCall({...common,posted_at:'2026-09-19T12:00:00Z',native_verified:true,text:scam}),'MENTION');
 assert.equal(gradeNarrativeCall({...common,posted_at:'2026-09-19T12:00:00Z',native_verified:true,text:claim}),'MENTION');
});

test('same ticker on another chain does not contaminate Robinhood USELESS',()=>{
 const token={symbol:'USELESS',name:'Useless Trader',network:'robinhood',token_address:'0x5e4A5B4FCf19ba5e43789b2368e542eA5DC38ECC'};
 assert.equal(matchTicker({text:'$USELESS is the old Solana meme with a self-aware useless narrative.'},token),false);
 assert.equal(matchTicker({text:'$USELESS Useless Trader on Robinhood has growing volume and liquidity.'},token),true);
});

test('same ticker and same chain with a foreign CA is rejected',()=>{
 const target={symbol:'MCAT',name:'Mega Cat',network:'solana',token_address:'G3wKa1SRLK9kaFSWd2ah2V9818SdjpTx1oriL2K2c3oW'};
 const foreign='6oeiky8G8ZnuvadARQPRMkV6FRz8ALKd579ZuXhKSTNK';
 assert.equal(matchTicker({text:'$MCAT Mega Cat on Solana is going viral. CA: '+foreign},target),false);
 assert.equal(matchTicker({text:'$MCAT Mega Cat on Solana is going viral. CA: '+target.token_address},target),true);
});

test('automated radar reports are not narrative calls',()=>{
 const common={qualified_at:'2026-09-20T07:10:00Z',born_at:'2026-09-20T06:50:00Z'};
 const radar='DEV HOLDS 65% OF SUPPLY: $MCAT. Launch mechanism, holders, liquidity and volume are tracked here. Not financial advice · automated radar';
 assert.equal(gradeNarrativeCall({...common,posted_at:'2026-09-20T06:57:00Z',native_verified:true,text:radar}),'MENTION');
});

