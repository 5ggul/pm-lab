import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const outPath=path.join(root,'data','recalls.json');
const rawPath=path.join(root,'data','raw','car-recall-center.json');
const statusPath=path.join(root,'data','generated','car-recall-status.json');
const listUrl='https://www.car.go.kr/ri/stat/list.do';
const detailUrl='https://www.car.go.kr/ri/stat/detail.do';
const limit=Math.max(5,Math.min(10,Number(process.env.RECALL_LIMIT||5)));
const previous=fs.existsSync(outPath)?JSON.parse(fs.readFileSync(outPath,'utf8')):{notices:[]};
const previousById=new Map((previous.notices||[]).map(n=>[String(n.official_id||''),n]));
const catalogPath=path.join(root,'data','generated','catalog-list-index.json');
const families=fs.existsSync(catalogPath)?JSON.parse(fs.readFileSync(catalogPath,'utf8')).families||[]:[];

const clean=s=>decodeHtml(String(s??'').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()).replaceAll('전자피','전자파').replaceAll('쩑자파','전자파');
function decodeHtml(s){return s.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))}
const field=(html,label)=>clean(html.match(new RegExp(`<th[^>]*>\\s*${label}\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`,'i'))?.[1]||'');
const info=(html,label)=>clean(html.match(new RegExp(`<dt[^>]*>\\s*${label}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`,'i'))?.[1]||'');
const parts=value=>{const [from='',to='']=String(value).split('~').map(x=>x.trim());return{from,to}};
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const isoToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const makerFrom=title=>clean(title.match(/^\[([^\]]+)\]/)?.[1]||'제작사 확인');
const norm=s=>String(s??'').toLowerCase().replace(/현대자동차|기아자동차|자동차|주식회사|\(주\)|[^0-9a-z가-힣]/g,'');
function matchFamilies(text){
  const hay=norm(text);if(!hay)return[];
  return families.filter(f=>{const needle=norm(f.family_name);return needle.length>=2&&hay.includes(needle)}).map(f=>f.family_id).slice(0,20);
}
async function request(url,options={}){
  let last;
  for(let attempt=1;attempt<=3;attempt++){
    try{const {headers={},...rest}=options;const res=await fetch(url,{...rest,headers:{accept:'text/html,application/xhtml+xml','accept-language':'ko-KR,ko;q=0.9','user-agent':'Mozilla/5.0 (compatible; NaeChaDataRefresh/1.0; +https://5ggul.github.io/pm-lab/car-data-preview/data-sources/)','referer':listUrl,...headers},signal:AbortSignal.timeout(30000)});if(!res.ok)throw new Error(`${url} HTTP ${res.status}`);return await res.text()}catch(error){last=error;if(attempt<3)await new Promise(r=>setTimeout(r,attempt*2000))}
  }
  throw last;
}
function listEntries(html){
  const out=[];const re=/onclick="\$main\.event\.detailView\('(\d+)','O'\); return false;"[^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>[\s\S]*?<ol>([\s\S]*?)<\/ol>/gi;let m;
  while((m=re.exec(html))){const date=clean(m[3].match(/<li>\s*(\d{4}-\d{2}-\d{2})\s*<\/li>/i)?.[1]||'');out.push({official_id:m[1],title:clean(m[2]),list_date:date})}
  return out;
}
async function fetchDetail(entry){
  const body=new URLSearchParams({recallId:entry.official_id,ctype:'O'});
  const html=await request(detailUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'},body});
  const title=clean(html.match(/<div class="subject">([\s\S]*?)<\/div>/i)?.[1]||entry.title);
  const model=field(html,'차명');const production=parts(field(html,'생산기간'));const correction=parts(field(html,'시정기간'));
  const summary=field(html,'결함내용');const remedy=field(html,'시정방법');const published=info(html,'작성일')||entry.list_date;
  if(!title||!model||!production.from||!summary||!remedy)throw new Error(`Recall ${entry.official_id} is incomplete`);
  const prior=previousById.get(entry.official_id);const matched=matchFamilies(`${title} ${model}`);
  return{
    id:`car-go-${entry.official_id}`,date:correction.from||entry.list_date||published,maker:makerFrom(title),title,
    models:prior?.models?.length?prior.models:matched,scope:model,summary,
    match:(prior?.models?.length||matched.length)?'model_family':'official_notice',
    official_url:`${listUrl}?searchProductName=${encodeURIComponent(model.split(/[,(]/)[0].trim())}`,
    slug:`recall-${entry.official_id}`,official_id:entry.official_id,published_on:published,
    recall_start:correction.from||entry.list_date||published,reviewed_on:isoToday(),
    production:[{model,from:production.from,to:production.to}],
    official_detail:{url:detailUrl,method:'POST',recallId:entry.official_id,ctype:'O'},
    source_sha256:sha(html),remedy
  };
}

try{
  const pages=Math.ceil(limit/5);const entries=[];
  for(let page=1;page<=pages;page++){
    const html=page===1?await request(listUrl):await request(listUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'},body:new URLSearchParams({currentPageNo:String(page),ctype:'O',searchOriginalMakerName:'',searchOriginalMakerCode:'',searchProductName:'',searchFromDate:'',searchToDate:''})});
    for(const entry of listEntries(html))if(!entries.some(x=>x.official_id===entry.official_id))entries.push(entry);
  }
  const selected=entries.slice(0,limit);if(selected.length<5)throw new Error(`Only ${selected.length} recall notices found`);
  const notices=[];
  for(const entry of selected){notices.push(await fetchDetail(entry));await new Promise(r=>setTimeout(r,800))}
  const merged=[...notices,...(previous.notices||[]).filter(old=>!notices.some(n=>n.official_id===String(old.official_id)))].sort((a,b)=>String(b.recall_start||b.date).localeCompare(String(a.recall_start||a.date))||Number(b.official_id)-Number(a.official_id)).slice(0,100);
  const output={schema_version:2,data_as_of:isoToday(),fetched_at:new Date().toISOString(),source:'국토교통부 자동차리콜센터',source_url:listUrl,sync_mode:'automatic_public_notice_refresh',coverage:`최근 공지 누적 ${merged.length}건`,notices:merged};
  fs.mkdirSync(path.dirname(rawPath),{recursive:true});fs.mkdirSync(path.dirname(statusPath),{recursive:true});
  fs.writeFileSync(rawPath,JSON.stringify({fetched_at:output.fetched_at,source_url:listUrl,entries:selected},null,2)+'\n');
  fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
  fs.writeFileSync(statusPath,JSON.stringify({ok:true,fetched_at:output.fetched_at,data_as_of:output.data_as_of,fetched_notice_count:notices.length,notice_count:merged.length,newest_recall_start:merged[0]?.recall_start||null,oldest_recall_start:merged.at(-1)?.recall_start||null,source_url:listUrl},null,2)+'\n');
  console.log(`Car recalls refreshed: ${notices.length} fetched / ${merged.length} retained through ${merged[0]?.recall_start}`);
}catch(error){
  fs.mkdirSync(path.dirname(statusPath),{recursive:true});fs.writeFileSync(statusPath,JSON.stringify({ok:false,attempted_at:new Date().toISOString(),retained_notice_count:(previous.notices||[]).length,error:String(error?.message||error),source_url:listUrl},null,2)+'\n');
  console.error(`Recall refresh failed; retained previous snapshot: ${error?.message||error}`);process.exit(1);
}
