import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const snapshot=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
if(manifest.uiVersion!=='11.47')throw new Error(`v11.48 requires v11.47 baseline, got ${manifest.uiVersion}`);
if(Number(snapshot.brand_count)!==136||Number(snapshot.category_count)!==20||candidates.length!==184)throw new Error(`v11.48 baseline ${snapshot.brand_count}/${snapshot.category_count}/${candidates.length}`);

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const won=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'—';
const num=v=>finite(v)?Math.round(Number(v)).toLocaleString('ko-KR'):'—';
const pct=v=>finite(v)?`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%`:'—';
const pp=v=>finite(v)?`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%p`:'—';
const fileFor=r=>path.join(out,...String(r).split('/').filter(Boolean),'index.html');
const strip=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rel=(v,m)=>finite(v)&&finite(m)&&Number(m)!==0?(Number(v)-Number(m))/Math.abs(Number(m))*100:null;
const gap=(v,m)=>finite(v)&&finite(m)?Number(v)-Number(m):null;
const band=(v,s)=>!finite(v)||!finite(s?.p25)||!finite(s?.p75)?'비교 불가':Number(v)<=Number(s.p25)?'하위 25%':Number(v)>=Number(s.p75)?'상위 25%':'중앙 구간';
const trend=v=>!finite(v)?'비교 불가':Number(v)>=2?'증가':Number(v)<=-2?'감소':'보합';

function components(b){
  const parts=[['가맹비','franchise',b.components?.franchise],['교육비','education',b.components?.education],['보증금','deposit',b.components?.deposit],['기타','etc',b.components?.etc]].filter(([, ,v])=>finite(v));
  const total=parts.reduce((s,[,,v])=>s+Number(v),0);
  const largest=[...parts].sort((a,z)=>Number(z[2])-Number(a[2]))[0]||null;
  const zeros=parts.filter(([, ,v])=>Number(v)===0).map(([name])=>name);
  return {parts,total,largest,share:largest&&total>0?Number(largest[2])/total*100:null,zeros};
}
function signal(label,type,score,text,href){return {label,type,score:Number.isFinite(score)?score:0,text,href}}
function insightSet(b,c){
  const out=[];
  const costRel=rel(b.cost,c.cost?.median),costGap=gap(b.cost,c.cost?.median);
  if(finite(costRel))out.push(signal('비용 위치','cost',Math.abs(costRel)/18,`공개 창업비용은 ${won(b.cost)}으로 ${b.categoryName} 중앙 ${won(c.cost.median)}보다 ${won(Math.abs(costGap))} ${costGap<0?'낮고':costGap>0?'높고':'같습니다'} (${costRel>=0?'+':''}${costRel.toFixed(1)}%).`,'#cost'));

  const storesRel=rel(b.stores,c.stores?.median),storesGap=gap(b.stores,c.stores?.median);
  if(finite(storesRel))out.push(signal('점포 규모','stores',Math.abs(storesRel)/25,`가맹점은 ${num(b.stores)}개로 업종 중앙 ${num(c.stores.median)}개보다 ${num(Math.abs(storesGap))}개 ${storesGap<0?'적고':storesGap>0?'많고':'같습니다'} (${storesRel>=0?'+':''}${storesRel.toFixed(1)}%).`,'#benchmark'));

  if(positive(b.sales)&&finite(c.sales?.median)){
    const r=rel(b.sales,c.sales.median),d=gap(b.sales,c.sales.median);
    out.push(signal('평균매출 공개지표','sales',Math.abs(r)/22,`가맹점 연간 평균매출 공개지표는 ${won(b.sales)}으로 업종 중앙 ${won(c.sales.median)}보다 ${won(Math.abs(d))} ${d<0?'낮고':d>0?'높고':'같습니다'} (${r>=0?'+':''}${r.toFixed(1)}%). 순이익 지표는 아닙니다.`,'#benchmark'));
  }else{
    out.push(signal('평균매출 공개지표','sales-missing',5,'가맹점 연간 평균매출은 양수 공개값이 확인되지 않아 0원 매출로 해석하지 않습니다. 이 브랜드는 평균매출 업종 순위와 양수 분포 표본에서 제외됩니다.','#benchmark'));
  }

  if(positive(b.salesPerArea)&&finite(c.salesPerArea?.median)){
    const r=rel(b.salesPerArea,c.salesPerArea.median),d=gap(b.salesPerArea,c.salesPerArea.median);
    out.push(signal('면적당 매출','area',Math.abs(r)/24,`3.3㎡당 연간 평균매출 공개지표는 ${won(b.salesPerArea)}으로 업종 중앙 ${won(c.salesPerArea.median)}보다 ${won(Math.abs(d))} ${d<0?'낮고':d>0?'높고':'같습니다'} (${r>=0?'+':''}${r.toFixed(1)}%).`,'#benchmark'));
  }else if(finite(b.salesPerArea)&&Number(b.salesPerArea)===0){
    out.push(signal('면적당 매출','area-zero',4.5,'3.3㎡당 평균매출 원자료는 0으로 공개되어 원자료에는 보존하지만, 양수값을 사용하는 업종 분포와 순위에서는 제외합니다.','#benchmark'));
  }

  if(finite(b.growth)){
    const med=c.growth?.median,d=finite(med)?Number(b.growth)-Number(med):null;
    const hist=(b.history||[]).filter(x=>finite(x.year)&&finite(x.stores)).slice(-2);
    const htxt=hist.length===2?` ${hist[0].year}년 ${num(hist[0].stores)}개 → ${hist[1].year}년 ${num(hist[1].stores)}개입니다.`:'';
    out.push(signal('점포 변화','growth',Math.abs(finite(d)?d:Number(b.growth))/7,`최근 점포 변화율은 ${pct(b.growth)}${finite(med)?`로 업종 중앙 ${pct(med)}와 ${pp(d)} 차이입니다.`:'.'}${htxt}`,'#stores'));
  }

  const comp=components(b);
  if(comp.largest&&finite(comp.share)){
    const [name,,value]=comp.largest;
    let text=`공개 창업비용 구성에서 ${name}가 ${won(value)} · ${comp.share.toFixed(1)}%로 가장 큽니다.`;
    if(name==='기타')text+=` ‘기타’의 세부 포함범위는 합계만으로 알 수 없으므로 본사 견적서에서 실제 항목을 분리해 확인할 부분입니다.`;
    else text+=` 실제 계약에서는 해당 항목의 포함 범위와 별도 부담 항목을 함께 확인해야 합니다.`;
    if(comp.zeros.length)text+=` 0원으로 공개된 항목: ${comp.zeros.join('·')}.`;
    out.push(signal('비용 구성','components',comp.share/32+(comp.zeros.length?0.8:0),text,'#cost'));
  }
  return out.sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label,'ko')).slice(0,3);
}
function profile(b,c){
  const comp=components(b);
  return [
    ['비용',band(b.cost,c.cost)],
    ['가맹점',band(b.stores,c.stores)],
    ['평균매출',positive(b.sales)?band(b.sales,c.sales):'미공개'],
    ['점포변화',trend(b.growth)],
    ['최대비용',comp.largest&&finite(comp.share)?`${comp.largest[0]} ${comp.share.toFixed(1)}%`:'비교 불가']
  ];
}
function brief(b,c){
  const insights=insightSet(b,c),prof=profile(b,c);
  const fingerprint=prof.map(([k,v])=>`${k}:${v}`).join('|');
  const rows=insights.map((x,i)=>`<a class="v48-insight" href="${x.href}" data-v48-insight="${esc(x.type)}" data-v48-rank="${i+1}"><span>${esc(x.label)}</span><p>${esc(x.text)}</p></a>`).join('');
  return {html:`<!-- v11.48 brand distinctness --><section class="v48-brand-brief" id="brand-brief" data-v48-brand-brief="1" data-v48-fingerprint="${esc(fingerprint)}"><div class="v35-section-head"><h2>브랜드 핵심 해석</h2><span>${esc(b.categoryName)} · ${esc(b.sourceYear)}</span></div><div class="v48-profile">${prof.map(([k,v])=>`<span><b>${esc(k)}</b>${esc(v)}</span>`).join('')}</div><div class="v48-insights">${rows}</div><p class="v48-caution">업종 내 공개값 위치를 빠르게 읽기 위한 요약이며 추천·수익성 점수가 아닙니다.</p></section><!-- v11.48 brand distinctness end -->`,text:`${b.name} ${prof.map(([k,v])=>`${k} ${v}`).join(' ')} ${insights.map(x=>x.text).join(' ')}`,types:insights.map(x=>x.type),fingerprint};
}

let patched=0,genericSummaryRemoved=0,genericReadingRemoved=0,methodLinksAdded=0,missingSalesBriefs=0;
const briefTexts=new Set(),fingerprints=new Map(),typeCounts={};
for(const b of snapshot.brands||[]){
  const c=snapshot.categories?.[b.categorySlug];
  if(!c)throw new Error(`v11.48 missing category ${b.slug}`);
  const file=fileFor(b.route);
  let html=await fs.readFile(file,'utf8');
  html=html.replace(/<!-- v11\.48 brand distinctness -->[\s\S]*?<!-- v11\.48 brand distinctness end -->/g,'');
  const summaries=(html.match(/<div class="v39-summary">[\s\S]*?<\/div>/g)||[]).length;
  const readings=(html.match(/<div class="v39-reading">[\s\S]*?<\/div>/g)||[]).length;
  genericSummaryRemoved+=summaries;genericReadingRemoved+=readings;
  html=html.replace(/<div class="v39-summary">[\s\S]*?<\/div>/g,'');
  html=html.replace(/<div class="v39-reading">[\s\S]*?<\/div>/g,`<p class="v48-method-link"><a href="${BASE}/methodology/">표본·누락값·매출 해석 기준</a></p>`);
  if(readings)methodLinksAdded++;
  const data=brief(b,c);
  if(!positive(b.sales)){missingSalesBriefs++;if(!data.text.includes('가맹점 연간 평균매출은 양수 공개값이 확인되지 않아'))throw new Error(`v11.48 missing sales wording ${b.slug}`)}
  if(briefTexts.has(data.text))throw new Error(`v11.48 duplicate brief ${b.slug}`);
  briefTexts.add(data.text);
  fingerprints.set(data.fingerprint,(fingerprints.get(data.fingerprint)||0)+1);
  for(const t of data.types)typeCounts[t]=(typeCounts[t]||0)+1;
  const anchor='<section class="v35-panel" id="cost">';
  if(!html.includes(anchor))throw new Error(`v11.48 cost anchor ${b.slug}`);
  html=html.replace(anchor,`${data.html}${anchor}`);
  if(!/\bv48-brand-distinct\b/.test(html))html=html.replace(/<body class="([^"]*)"/i,(m,c)=>`<body class="${c} v48-brand-distinct"`);
  html=html.replace(/\sdata-v48-brand-distinct="[^"]*"/gi,'');
  html=html.replace(/<body\b([^>]*)>/i,(m,a)=>`<body${a} data-v48-brand-distinct="1">`);
  await fs.writeFile(file,html,'utf8');patched++;
}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
css=css.replace(/\/\* v11\.48 brand distinctness \*\/[\s\S]*?\/\* v11\.48 brand distinctness end \*\//g,'').trimEnd();
css+=`\n\n/* v11.48 brand distinctness */\n.v48-brand-brief{margin:20px 0 26px;padding:18px 0;border-top:2px solid var(--accent,#d9ff7c);border-bottom:1px solid #303831}.v48-profile{display:flex;flex-wrap:wrap;gap:0;margin:4px 0 16px}.v48-profile span{padding:6px 14px 6px 0;margin-right:14px;border-right:1px solid #303831;font-size:11px;font-variant-numeric:tabular-nums}.v48-profile span:last-child{border-right:0}.v48-profile b{display:block;margin-bottom:2px;color:#7f8a81;font-size:9px;font-weight:700}.v48-insights{border-top:1px solid #303831}.v48-insight{display:grid;grid-template-columns:138px minmax(0,1fr);gap:16px;padding:12px 0;border-bottom:1px solid #242a25;text-decoration:none;color:inherit}.v48-insight>span{color:var(--accent,#d9ff7c);font-size:11px;font-weight:800}.v48-insight p{margin:0;font-size:12px;line-height:1.65;color:#c8cec9}.v48-caution{margin:10px 0 0;color:#78817a;font-size:10px;line-height:1.5}.v48-method-link{margin:18px 0 0;padding-top:12px;border-top:1px solid #303831;font-size:11px}.v48-method-link a{text-decoration:underline;text-underline-offset:3px}\n@media(max-width:620px){.v48-brand-brief{margin-top:14px;padding-top:14px}.v48-profile{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0}.v48-profile span{margin:0;padding:7px 10px 7px 0;border-right:0;border-bottom:1px solid #242a25}.v48-insight{grid-template-columns:1fr;gap:4px;padding:11px 0}.v48-insight p{font-size:11px}.v48-caution{font-size:9px}}\n/* v11.48 brand distinctness end */\n`;
await fs.writeFile(cssPath,css,'utf8');

manifest.uiVersion='11.48';
manifest.v11_48={brandDistinctness:true,brandPages:patched,uniqueBriefs:briefTexts.size,genericEvidenceSummaryRemoved:true,genericReadingCopyRemoved:true,dataDrivenTopSignals:true,methodologyLinkCentralized:true,v42VisualLanguagePreserved:true,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,productionDeployed:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
const fingerprintCounts=[...fingerprints.values()];
const report={schemaVersion:1,uiVersion:'11.48',generatedAt:new Date().toISOString(),snapshotId:snapshot.snapshot_id,brandPages:patched,uniqueBriefs:briefTexts.size,genericSummaryRemoved,genericReadingRemoved,methodLinksAdded,missingSalesBriefs,insightTypeCounts:typeCounts,profileFingerprintCount:fingerprints.size,maxBrandsPerProfile:Math.max(...fingerprintCounts),candidatePages:candidates.length,features:['three strongest data signals per brand','scan-first brand profile','duplicate evidence summary removed','duplicate reading guide centralized to methodology','missing sales kept distinct from zero','no recommendation score'],productionDeployed:false};
await fs.writeFile(path.join(out,'v11-48-brand-distinctness.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
