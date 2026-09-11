import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const OUT_DEFAULT=path.resolve('interior-cost-core/source-watch-v11.json');
const sources=[
  {id:'kict-cost-index',name:'한국건설기술연구원 건설공사비지수',url:'https://cost.kict.re.kr/index.html',expected:'2026-07',kind:'month'},
  {id:'cak-wage',name:'대한건설협회 건설업 임금실태조사',url:'https://www.cak.or.kr/lay1/bbs/S1T41C42/A/14/list.do',expected:'2026-H2',kind:'half'},
  {id:'codil-standard-market',name:'CODIL 표준시장단가',url:'https://www.codil.or.kr/helpdesk/search.do?bbsAttrbCode=BBSA01&bbsId=BBSMSTR_900000000204',expected:'2026-H2',kind:'standard'}
];
const getArg=(args,name)=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
const monthKey=s=>{const m=String(s).match(/^(\d{4})-(\d{2})$/);return m?Number(m[1])*12+Number(m[2]):0};
const halfKey=s=>{const m=String(s).match(/^(\d{4})-H([12])$/);return m?Number(m[1])*2+Number(m[2]):0};

export function detectLatest(html,kind){
  const text=String(html||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');
  if(kind==='month'){
    const found=[...text.matchAll(/(20\d{2})년\s*(\d{1,2})월\s*건설공사비지수/g)].map(m=>`${m[1]}-${String(m[2]).padStart(2,'0')}`);return found.sort((a,b)=>monthKey(b)-monthKey(a))[0]||null;
  }
  if(kind==='half'){
    const found=[...text.matchAll(/(20\d{2})년\s*(상|하)반기\s*적용\s*건설업\s*임금실태조사/g)].map(m=>`${m[1]}-H${m[2]==='상'?1:2}`);return found.sort((a,b)=>halfKey(b)-halfKey(a))[0]||null;
  }
  if(kind==='standard'){
    const found=[...text.matchAll(/(20\d{2})년\s*(상|하)반기\s*표준시장단가/g)].map(m=>`${m[1]}-H${m[2]==='상'?1:2}`);return found.sort((a,b)=>halfKey(b)-halfKey(a))[0]||null;
  }
  return null;
}
function isNewer(kind,detected,expected){if(!detected)return false;return kind==='month'?monthKey(detected)>monthKey(expected):halfKey(detected)>halfKey(expected)}
async function fetchSource(s){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),18000);try{
    const res=await fetch(s.url,{headers:{'user-agent':'Mozilla/5.0 ChatGPT-Preview-Source-Watch/11'},signal:ctrl.signal,redirect:'follow'});const html=await res.text();const detected=detectLatest(html,s.kind);return {...s,http_status:res.status,reachable:res.ok,detected,match:detected===s.expected,update_required:isNewer(s.kind,detected,s.expected),error:null};
  }catch(e){return {...s,http_status:null,reachable:false,detected:null,match:false,update_required:false,error:String(e?.name||e)}}finally{clearTimeout(timer)}
}
export async function liveCheck(){const checked_on=new Date().toISOString().slice(0,10),rows=[];for(const s of sources)rows.push(await fetchSource(s));return {version:'11.0.0',mode:'live_http_period_detection',checked_on,sources:rows,update_required:rows.some(x=>x.update_required),unreachable:rows.filter(x=>!x.reachable).map(x=>x.id),note:'새 공표 기간 탐지 전용. 숫자 값은 자동 덮어쓰지 않고 별도 검증 후 반영.'}}
function selfTest(){
  const k=detectLatest('지수 2026년 7월 건설공사비지수 2026년 6월 건설공사비지수','month');
  const w=detectLatest('2026년 하반기 적용 건설업 임금실태조사 보고서 2026년 상반기 적용 건설업 임금실태조사','half');
  const s=detectLatest('2026년 하반기 표준시장단가 2026년 상반기 표준시장단가','standard');
  if(k!=='2026-07'||w!=='2026-H2'||s!=='2026-H2'||!isNewer('month','2026-08','2026-07')||isNewer('half','2026-H1','2026-H2'))throw new Error('v11 source watch self-test failed');
  console.log('v11 source watch self-test ok');
}
const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked){const args=process.argv.slice(2);if(args.includes('--self-test'))selfTest();else if(args.includes('--live')){const out=await liveCheck(),file=getArg(args,'--output')||OUT_DEFAULT;fs.writeFileSync(file,JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));}else throw new Error('Use --self-test or --live [--output file]')}
