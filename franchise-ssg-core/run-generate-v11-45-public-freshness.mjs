import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snapshot=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);

const brandCount=Number(snapshot.brand_count);
const categoryCount=Number(snapshot.category_count);
const snapshotDate=String(snapshot.snapshot_id||'').match(/(\d{4}-\d{2}-\d{2})$/)?.[1]||String(snapshot.fetched_at||'').slice(0,10);
if(!brandCount||!categoryCount||!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate))throw new Error('trusted snapshot freshness fields unavailable');

const stats={patchedHtmlPages:0,staleBrandCountPhrasesBefore:0,staleBrandCountPhrasesAfter:0,homeMetaPatched:false,homeRailPatched:false,bodyCoverage:0};
const stalePatterns=[/170개 프랜차이즈 브랜드/g,/170개 프랜차이즈/g,/170개 브랜드/g];
const countStale=s=>stalePatterns.reduce((n,re)=>n+(s.match(re)||[]).length,0);
for(const file of htmlFiles){
  let html=await fs.readFile(file,'utf8');const before=html;
  stats.staleBrandCountPhrasesBefore+=countStale(html);
  html=html.replace(/170개 프랜차이즈 브랜드/g,`${brandCount}개 프랜차이즈 브랜드`)
           .replace(/170개 프랜차이즈/g,`${brandCount}개 프랜차이즈`)
           .replace(/170개 브랜드/g,`${brandCount}개 브랜드`);
  html=html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{let a=attrs||'';a=a.replace(/\sdata-v45-public-freshness="[^"]*"/gi,'');a+=' data-v45-public-freshness="1"';return `<body${a}>`});
  if(file===path.join(out,'index.html')){
    const beforeMeta=html;
    html=html.replace(/<meta name="description" content="[^"]*">/i,`<meta name="description" content="${brandCount}개 프랜차이즈 브랜드의 창업비용, 가맹점 수, 가맹점 증감, 평균매출을 같은 기준으로 비교하고 계산할 수 있습니다.">`);
    stats.homeMetaPatched=html!==beforeMeta;
    const beforeRail=html;
    html=html.replace(/<span>갱신<\/span><strong>\d{4}-\d{2}-\d{2}<\/strong>/,`<span>갱신</span><strong>${snapshotDate}</strong>`);
    stats.homeRailPatched=html!==beforeRail;
  }
  stats.staleBrandCountPhrasesAfter+=countStale(html);
  if(/<body\b[^>]*data-v45-public-freshness="1"/i.test(html))stats.bodyCoverage++;
  if(html!==before){await fs.writeFile(file,html,'utf8');stats.patchedHtmlPages++;}
}

manifest.uiVersion='11.45';
manifest.v11_45={publicMetadataFreshness:true,trustedSnapshotCountSync:true,homeFreshnessSync:true,brandCount,categoryCount,snapshotDate,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,visualSystemChanged:false,productionDeployed:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
const report={schemaVersion:1,uiVersion:'11.45',generatedAt:new Date().toISOString(),snapshotId:snapshot.snapshot_id,brandCount,categoryCount,snapshotDate,candidatePages:candidates.length,allHtmlPages:htmlFiles.length,...stats,productionDeployed:false};
await fs.writeFile(path.join(out,'v11-45-public-freshness.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
