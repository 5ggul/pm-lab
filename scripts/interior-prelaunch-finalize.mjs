import fs from 'node:fs';
import path from 'node:path';

const ROOT='docs/interior-cost-preview';
const BASE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const OG=BASE+'/assets/og-default.svg';
const LOGO=BASE+'/assets/logo.svg';
const ORG_ID=BASE+'/#organization';
const TODAY='2026-09-19';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,c)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c,'utf8');};
const escRe=s=>s.replace(/[|\\{}()[\]^$+*?.-]/g,'\\$&');
const stripTags=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const htmlEsc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const getTitle=h=>(h.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]?.trim()||'견적검수실';
const getDescription=h=>(h.match(/<meta name="description" content="([^"]*)"/i)||[])[1]||'';
const getCanonical=h=>(h.match(/<link rel="canonical" href="([^"]+)"/i)||[])[1]||'';
const getH1=h=>stripTags((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||'');
const getLead=h=>stripTags((h.match(/<p class="lead"[^>]*>([\s\S]*?)<\/p>/i)||[])[1]||'');

function removeMeta(h,attr,key){
  const re=new RegExp('<meta\\b(?=[^>]*\\b'+attr+'=["\\\']'+escRe(key)+'["\\\'])[^>]*>','gi');
  return h.replace(re,'');
}
function setSocialMeta(h,route){
  const title=getTitle(h),desc=getDescription(h),canonical=getCanonical(h)||BASE+route;
  const type=/^\/guides\/[^/]+\/$/.test(route)?'article':'website';
  const targets=[
    ['property','og:type'],['property','og:site_name'],['property','og:title'],['property','og:description'],
    ['property','og:url'],['property','og:image'],['property','og:image:type'],['property','og:image:width'],['property','og:image:height'],
    ['name','twitter:card'],['name','twitter:title'],['name','twitter:description'],['name','twitter:image']
  ];
  for(const pair of targets)h=removeMeta(h,pair[0],pair[1]);
  const bundle=[
    '<meta property="og:type" content="'+type+'">',
    '<meta property="og:site_name" content="견적검수실">',
    '<meta property="og:title" content="'+htmlEsc(title)+'">',
    '<meta property="og:description" content="'+htmlEsc(desc)+'">',
    '<meta property="og:url" content="'+htmlEsc(canonical)+'">',
    '<meta property="og:image" content="'+OG+'">',
    '<meta property="og:image:type" content="image/svg+xml">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="'+htmlEsc(title)+'">',
    '<meta name="twitter:description" content="'+htmlEsc(desc)+'">',
    '<meta name="twitter:image" content="'+OG+'">'
  ].join('');
  return h.replace('</head>',bundle+'</head>');
}
function removePrelaunchSchema(h,kind){
  kind=kind||'schema';
  const re=new RegExp('<script type="application/ld\\+json" data-prelaunch-'+kind+'[^>]*>[\\s\\S]*?<\\/script>','gi');
  return h.replace(re,'');
}
function addJsonLd(h,obj,kind){
  kind=kind||'schema';
  h=removePrelaunchSchema(h,kind);
  return h.replace('</head>','<script type="application/ld+json" data-prelaunch-'+kind+'>'+JSON.stringify(obj)+'</script></head>');
}
function addHomeFaqAndSchema(h){
  if(!h.includes('data-home-faq="prelaunch"')){
    const faq='<section class="home-section" data-home-faq="prelaunch"><div class="shell"><div class="section-head"><h2>자주 묻는 질문</h2><p>견적을 비교하기 전에 가장 많이 헷갈리는 기준만 짧게 정리했습니다.</p></div><div class="faq"><article><h3>견적검수실이 시공업체를 추천하나요?</h3><p>아니요. 업체를 중개하거나 추천하지 않고, 받은 견적의 공종·포함조건·수량·사양을 같은 기준으로 확인하고 비교하는 도구를 제공합니다.</p></article><article><h3>입력한 견적 내용은 서버로 전송되나요?</h3><p>현재 견적 확인·비교 입력값과 CSV/TXT 가져오기는 브라우저 안에서 처리되며 서버로 전송하지 않습니다.</p></article><article><h3>지역별 실제 견적 평균을 지금 볼 수 있나요?</h3><p>검수된 민간 견적 표본이 공개 기준을 충족하기 전에는 지역 평균·중앙값을 만들지 않습니다. 지역 세그먼트는 N≥20일 때만 가격 통계를 공개합니다.</p></article></div></div></section>';
    h=h.replace('</main>',faq+'</main>');
  }
  const schema={
    '@context':'https://schema.org',
    '@graph':[
      {'@type':'Organization','@id':ORG_ID,name:'견적검수실',url:BASE+'/',logo:{'@type':'ImageObject',url:LOGO,width:512,height:512},sameAs:['https://github.com/5ggul/pm-lab'],contactPoint:{'@type':'ContactPoint',contactType:'customer support',url:BASE+'/contact/',availableLanguage:['ko']},publishingPrinciples:BASE+'/editorial-policy/'},
      {'@type':'FAQPage','@id':BASE+'/#faq',mainEntity:[
        {'@type':'Question',name:'견적검수실이 시공업체를 추천하나요?',acceptedAnswer:{'@type':'Answer',text:'아니요. 업체를 중개하거나 추천하지 않고, 받은 견적의 공종·포함조건·수량·사양을 같은 기준으로 확인하고 비교하는 도구를 제공합니다.'}},
        {'@type':'Question',name:'입력한 견적 내용은 서버로 전송되나요?',acceptedAnswer:{'@type':'Answer',text:'현재 견적 확인·비교 입력값과 CSV/TXT 가져오기는 브라우저 안에서 처리되며 서버로 전송하지 않습니다.'}},
        {'@type':'Question',name:'지역별 실제 견적 평균을 지금 볼 수 있나요?',acceptedAnswer:{'@type':'Answer',text:'검수된 민간 견적 표본이 공개 기준을 충족하기 전에는 지역 평균·중앙값을 만들지 않습니다. 지역 세그먼트는 N≥20일 때만 가격 통계를 공개합니다.'}}
      ]}
    ]
  };
  return addJsonLd(h,schema,'home');
}
function faqPairs(h){
  const sections=[...h.matchAll(/<section class="content-section[^"]*"[^>]*>([\s\S]*?)<\/section>/gi)].map(m=>m[1]);
  const faq=sections.find(s=>/<h2[^>]*>\s*자주 묻는 질문\s*<\/h2>/i.test(s));
  if(!faq)return [];
  const pairs=[];
  const re=/<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi;
  for(const m of faq.matchAll(re))pairs.push({q:stripTags(m[1]),a:stripTags(m[2])});
  return pairs.filter(x=>x.q&&x.a).slice(0,5);
}
function enhanceGuide(h,route){
  h=h.replace(/<p class="lead"(?![^>]*data-direct-answer)/i,'<p class="lead" data-direct-answer="true"');
  let pairs=faqPairs(h);
  if(!pairs.length){
    const q=getH1(h),a=getLead(h);
    if(q&&a)pairs=[{q:q,a:a}];
  }
  if(pairs.length){
    const entities=pairs.map(x=>({'@type':'Question',name:x.q,acceptedAnswer:{'@type':'Answer',text:x.a}}));
    h=addJsonLd(h,{'@context':'https://schema.org','@type':'FAQPage','@id':BASE+route+'#faq',mainEntity:entities},'faq');
  }
  return h;
}
function addDataset(h,route){
  if(/"@type"\s*:\s*"Dataset"/.test(h))return h;
  const name=getH1(h)||getTitle(h),description=getDescription(h),url=getCanonical(h)||BASE+route;
  return addJsonLd(h,{'@context':'https://schema.org','@type':'Dataset','@id':url+'#dataset',name:name,description:description,url:url,inLanguage:'ko-KR',dateModified:TODAY,isAccessibleForFree:true,creator:{'@id':ORG_ID}},'dataset');
}
function addToolSchema(h,route){
  if(/"@type"\s*:\s*"WebApplication"/.test(h)||/"@type"\s*:\s*"SoftwareApplication"/.test(h))return h;
  const name=getH1(h)||getTitle(h),description=getDescription(h),url=getCanonical(h)||BASE+route;
  return addJsonLd(h,{'@context':'https://schema.org','@type':'WebApplication','@id':url+'#app',name:name,description:description,url:url,applicationCategory:'BusinessApplication',operatingSystem:'Web',isAccessibleForFree:true,provider:{'@id':ORG_ID}},'tool');
}
function enhanceGuideHub(h){
  if(h.includes('data-guide-hub-start="prelaunch"'))return h;
  const block='<section class="content-section" data-guide-hub-start="prelaunch"><h2>어디서부터 보면 되나요?</h2><p>견적서를 이미 받았다면 <a href="/pm-lab/interior-cost-preview/guides/quote-reading/">견적서 보는 법</a> → <a href="/pm-lab/interior-cost-preview/guides/missing-items/">빠진 항목</a> → <a href="/pm-lab/interior-cost-preview/guides/standardize-practice/">같은 표로 옮기기</a> 순서가 가장 빠릅니다. 계약 직전에는 VAT·폐기물·현장관리비·추가공사 기준을 따로 확인하세요.</p></section>';
  return h.replace('<article class="article-body">','<article class="article-body">'+block);
}
function enhanceContact(h){
  if(h.includes('data-contact-channel="github"'))return h;
  const old=/<h2>현재 프리뷰<\/h2><p>외부 검수 프리뷰 단계라 운영 이메일을 임의로 만들지 않습니다\. 운영 도메인 공개 전 실제 수신 주소와 문의 양식을 연결합니다\.<\/p>/;
  const repl='<h2>문의·오류 제보 채널</h2><p data-contact-channel="github">현재 문의와 오류 제보는 <a href="https://github.com/5ggul/pm-lab/issues/new" rel="noopener noreferrer">GitHub Issues</a>에서 실제로 접수합니다. 문제가 있는 URL, 현재 표시내용, 근거 자료를 함께 남기면 정정 검수에 사용합니다.</p>';
  return h.replace(old,repl);
}
function enhanceRegionHub(h){
  h=h.replace(/<title>[^<]*<\/title>/i,'<title>지역별 인테리어 견적 공개 기준 | 견적검수실</title>');
  h=h.replace(/<meta name="description" content="[^"]*">/i,'<meta name="description" content="지역별 인테리어 견적 통계의 공개 기준과 현재 표본 상태를 확인합니다. 지역 가격분포는 검수 표본 N≥20일 때만 공개하며 기준 미달 값은 만들지 않습니다.">');
  h=h.replace(/data-v16-wave="HOLD"/g,'data-index-state="candidate"');
  h=h.replace(/<div class="v10-answer-tools"><input[^>]*><\/div>/,'<div class="v10-answer-tools"><a href="/pm-lab/interior-cost-preview/data/quote-statistics/">표본 공개 기준</a></div>');
  const replacement='<div class="notice" data-region-release-summary><strong>현재 공개 가능한 지역별 가격 통계: 0개</strong><p>지역별 민간 견적 가격분포는 해당 지역 검수 표본이 N≥20일 때만 공개합니다. 현재는 기준을 충족한 지역이 없어 평균·중앙값·평당가격을 표시하지 않습니다.</p><p>대상 지역: 서울 · 부산 · 대구 · 인천 · 광주 · 대전 · 울산 · 세종 · 경기 · 강원 · 충북 · 충남 · 전북 · 전남 · 경북 · 경남 · 제주</p><p><a href="/pm-lab/interior-cost-preview/data/quote-statistics/">표본 공개 기준 확인</a></p></div><p>현재 지역별 표본';
  h=h.replace(/<div class="v10-region-grid">[\s\S]*?<p>현재 지역별 표본/,replacement);
  return h;
}
function holdRegionDetail(h){
  h=h.replace(/<meta name="robots" content="[^"]*">/i,'<meta name="robots" content="noindex,follow,noarchive,nosnippet">');
  if(/<meta name="googlebot"/i.test(h))h=h.replace(/<meta name="googlebot" content="[^"]*">/i,'<meta name="googlebot" content="noindex,follow,noarchive,nosnippet">');
  else h=h.replace('</head>','<meta name="googlebot" content="noindex,follow,noarchive,nosnippet"></head>');
  if(/<body\b[^>]*data-index-state=/i.test(h))h=h.replace(/data-index-state="[^"]*"/i,'data-index-state="hold"');
  else h=h.replace(/<body\b/i,'<body data-index-state="hold"');
  return h;
}
function routeToFile(route){
  return route==='/'?path.join(ROOT,'index.html'):path.join(ROOT,route.replace(/^\//,'').replace(/\/$/,''),'index.html');
}

let sitemap=read(path.join(ROOT,'sitemap-production.xml'));
const regionLoc=BASE+'/region/';
if(!sitemap.includes('<loc>'+regionLoc+'</loc>')){
  sitemap=sitemap.replace('</urlset>','  <url><loc>'+regionLoc+'</loc><lastmod>'+TODAY+'</lastmod></url>\n</urlset>');
}
write(path.join(ROOT,'sitemap-production.xml'),sitemap);
write(path.join(ROOT,'sitemap.xml'),sitemap);

const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const routes=urls.map(u=>u.replace(BASE,'')||'/');
const uniqueRoutes=[...new Set(routes)];

for(const route of uniqueRoutes){
  const file=routeToFile(route);
  if(!fs.existsSync(file))throw new Error('Missing sitemap target: '+route+' -> '+file);
  let h=read(file);
  if(route==='/region/')h=enhanceRegionHub(h);
  h=setSocialMeta(h,route);
  if(route==='/')h=addHomeFaqAndSchema(h);
  if(route==='/guides/')h=enhanceGuideHub(h);
  if(/^\/guides\/[^/]+\/$/.test(route))h=enhanceGuide(h,route);
  if(/^\/data\/(construction-wage|cost-index|quote-statistics)\//.test(route)||/^\/data\/public-unit-cost\//.test(route))h=addDataset(h,route);
  if(['/calculator/','/checklist/','/one-set/','/quote-check/','/quote-compare/','/quote-items/'].includes(route))h=addToolSchema(h,route);
  if(route==='/contact/')h=enhanceContact(h);
  write(file,h);
}

const regionDir=path.join(ROOT,'region');
for(const entry of fs.readdirSync(regionDir,{withFileTypes:true})){
  if(!entry.isDirectory())continue;
  const file=path.join(regionDir,entry.name,'index.html');
  if(!fs.existsSync(file))continue;
  write(file,holdRegionDetail(read(file)));
}

const allowlist={
  version:'1.0.0',
  reviewed_on:TODAY,
  preview_base:BASE,
  index_routes:uniqueRoutes,
  hold_rules:[
    {pattern:'/region/{sido}/',reason:'지역 검수 표본 N<20. /region/ 허브만 index 후보.'},
    {pattern:'/data/answers-v*/',reason:'내부 생성/검수 산출물'},
    {pattern:'/data/production-*/',reason:'내부 production 시뮬레이션/검수 산출물'},
    {pattern:'/data/ad-layout/',reason:'내부 광고 레이아웃 검수'},
    {pattern:'/data/coverage*/',reason:'내부 coverage 검수'},
    {pattern:'/data/launch-gate*/',reason:'내부 launch gate 검수'}
  ],
  index_count:uniqueRoutes.length,
  region_detail_index_count:uniqueRoutes.filter(r=>/^\/region\/[^/]+\/$/.test(r)).length
};
write(path.join(ROOT,'data','index-release-allowlist-v1.json'),JSON.stringify(allowlist,null,2)+'\n');

const readiness={
  version:'1.0.0',
  reviewed_on:TODAY,
  state:'READY_FOR_OWNER_FINAL_REVIEW',
  completed:{
    'P1-1':'CSV/TXT local import released and production-smoked',
    'P1-2':'quote compare compact input/result released and production-smoked',
    'P1-3':'quote check defaults to 12 rows with optional wizard released and production-smoked',
    'P1-4':'OG/Twitter image metadata, Organization, WebApplication, Dataset, FAQPage structured data prepared',
    'P1-5':'region hub is sole index candidate; 17 sido detail pages explicitly held noindex until N>=20',
    'P1-6':'guide hub orientation added; answer-first leads retained; guide FAQ structured data added',
    'P1-7':'domain cutover remains intentionally blocked until owner supplies/approves final domain'
  },
  intentionally_blocked:[
    'Remove preview noindex from allowlisted routes',
    'Replace github.io canonical/og/jsonld/sitemap URLs with final domain',
    'Configure GitHub Pages custom domain / DNS and verify redirect',
    'Submit Search Console / AdSense'
  ],
  index_allowlist:'./index-release-allowlist-v1.json'
};
write(path.join(ROOT,'data','prelaunch-readiness-v1.json'),JSON.stringify(readiness,null,2)+'\n');

const candidateFiles=uniqueRoutes.map(routeToFile);
for(const file of candidateFiles){
  const h=read(file);
  for(const needle of ['property="og:image"','name="twitter:image"','name="twitter:card" content="summary_large_image"']){
    if(!h.includes(needle))throw new Error('Missing social meta '+needle+' in '+file);
  }
  if(!/noindex/i.test(h))throw new Error('Preview noindex unexpectedly missing in '+file);
}
const guideFiles=uniqueRoutes.filter(r=>/^\/guides\/[^/]+\/$/.test(r)).map(routeToFile);
for(const file of guideFiles){
  const h=read(file);
  if(!/"@type":"FAQPage"/.test(h))throw new Error('Guide FAQPage missing: '+file);
  if(!/data-direct-answer="true"/.test(h))throw new Error('Guide direct answer marker missing: '+file);
}
const dataRoutes=uniqueRoutes.filter(r=>/^\/data\/(construction-wage|cost-index|quote-statistics)\//.test(r)||/^\/data\/public-unit-cost\//.test(r));
for(const route of dataRoutes){
  if(!/"@type":"Dataset"/.test(read(routeToFile(route))))throw new Error('Dataset missing: '+route);
}
for(const route of ['/calculator/','/checklist/','/one-set/','/quote-check/','/quote-compare/','/quote-items/']){
  if(!/"@type":"WebApplication"/.test(read(routeToFile(route))))throw new Error('WebApplication missing: '+route);
}
const home=read(path.join(ROOT,'index.html'));
if(!/"@type":"Organization"/.test(home)||!/"@type":"FAQPage"/.test(home))throw new Error('Home Organization/FAQ schema missing');
const regionHub=read(path.join(ROOT,'region','index.html'));
if((regionHub.match(/REGION · N=0/g)||[]).length!==0)throw new Error('Region hub still renders repeated N=0 cards');
if((regionHub.match(/\/region\/(seoul|busan|daegu|incheon|gwangju|daejeon|ulsan|sejong|gyeonggi|gangwon|chungbuk|chungnam|jeonbuk|jeonnam|gyeongbuk|gyeongnam|jeju)\//g)||[]).length!==0)throw new Error('Region hub still links held details');
if(allowlist.region_detail_index_count!==0)throw new Error('Region detail leaked into index allowlist');
console.log(JSON.stringify({indexCount:allowlist.index_count,guides:guideFiles.length,datasets:dataRoutes.length,regionDetailIndexCount:allowlist.region_detail_index_count},null,2));
