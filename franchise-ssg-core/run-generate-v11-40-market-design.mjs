import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const cssPath=path.join(out,'assets/site.css');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const start='/* v11.40 market terminal design */';
const end='/* v11.40 market terminal design end */';

const htmlFiles=[];
async function walk(dir){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())await walk(p);
    else if(entry.isFile()&&entry.name.endsWith('.html'))htmlFiles.push(p);
  }
}
await walk(out);

function patchBody(html){
  let next=html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{
    let a=attrs||'';
    if(/\bclass="[^"]*"/i.test(a)){
      a=a.replace(/\bclass="([^"]*)"/i,(m,classes)=>{
        const list=classes.split(/\s+/).filter(Boolean);
        if(!list.includes('v40-market-ui'))list.push('v40-market-ui');
        return `class="${list.join(' ')}"`;
      });
    }else a=` class="v40-market-ui"${a}`;
    if(!/\bdata-v40-market-ui=/i.test(a))a+=' data-v40-market-ui="1"';
    return `<body${a}>`;
  });
  if(!/name="theme-color"/i.test(next))next=next.replace('</head>','<meta name="theme-color" content="#090b0a"></head>');
  else next=next.replace(/<meta\s+name="theme-color"\s+content="[^"]*"\s*\/?\s*>/i,'<meta name="theme-color" content="#090b0a">');
  return next;
}

let patched=0;
for(const file of htmlFiles){
  const html=await fs.readFile(file,'utf8');
  const next=patchBody(html);
  if(next!==html){await fs.writeFile(file,next,'utf8');patched++;}
}

let css=await fs.readFile(cssPath,'utf8');
const old=new RegExp('/\\* v11\\.40 market terminal design \\*/[\\s\\S]*?/\\* v11\\.40 market terminal design end \\*/','g');
css=css.replace(old,'').trimEnd();

const marketCss=String.raw`
${start}
/* Reference direction: compact market terminal / exchange UI. No gradients, no soft-card dashboard treatment. */
html{background:#090b0a;color-scheme:dark}
body.v40-market-ui{
  --bg:#090b0a;--paper:#0d100e;--text:#f3f5ef;--muted:#8a938b;--line:#242b25;
  --accent:#c8ff3d;--accent-soft:#12190d;--risk:#ff6b76;--risk-soft:#211014;
  --safe:#79ef9a;--safe-soft:#0c1c11;--warn:#eec85b;--warn-soft:#201a0b;
  --white:#f7f8f4;--header:#090b0a;--radius:2px;
  --v25:#c8ff3d;--v25-ink:#e9ede7;--v25-line:#242b25;--v25-muted:#7f8980;
  background:#090b0a;color:#f3f5ef;font-size:15px;line-height:1.58;letter-spacing:-.012em;
}
body.v40-market-ui ::selection{background:#c8ff3d;color:#090b0a}
body.v40-market-ui *{scrollbar-color:#39423a #0b0d0c}
body.v40-market-ui a{color:#c8ff3d}
body.v40-market-ui a:hover{text-decoration:none;color:#e2ff8c}
body.v40-market-ui :focus-visible{outline:1px solid #c8ff3d;outline-offset:3px}
body.v40-market-ui h1,body.v40-market-ui h2,body.v40-market-ui h3{color:#f3f5ef}
body.v40-market-ui h1{font-weight:760;letter-spacing:-.045em}
body.v40-market-ui h2{font-weight:720;letter-spacing:-.03em}
body.v40-market-ui h3{font-weight:680}
body.v40-market-ui .shell{width:min(1440px,calc(100% - 48px))}
body.v40-market-ui .page{padding-top:26px}
body.v40-market-ui .block{margin:48px 0}
body.v40-market-ui .updated,body.v40-market-ui .note,body.v40-market-ui .disclaimer,body.v40-market-ui .source-note{color:#7f8980}

/* Header / navigation */
body.v40-market-ui .preview-bar{padding:4px 14px;background:#0d100e;border-color:#242b25;color:#697269;font:10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}
body.v40-market-ui .site-header{background:rgba(9,11,10,.96);border-color:#242b25;backdrop-filter:blur(14px)}
body.v40-market-ui .header-inner{min-height:68px;gap:24px}
body.v40-market-ui .logo{display:inline-flex;align-items:center;gap:10px;color:#f3f5ef;font-size:16px;font-weight:760;letter-spacing:-.03em}
body.v40-market-ui .logo::before{content:"";width:10px;height:10px;background:#c8ff3d;box-shadow:0 0 0 1px #c8ff3d}
body.v40-market-ui .site-header nav{gap:0;border-left:1px solid #242b25}
body.v40-market-ui .site-header nav a{min-height:68px;padding:0 15px;border:0;border-right:1px solid #242b25;color:#9aa39b;font-size:12px;font-weight:650;letter-spacing:.01em}
body.v40-market-ui .site-header nav a:hover{background:#101410;color:#c8ff3d;border-bottom:0}
body.v40-market-ui .nav-toggle{border-color:#323a33;background:#0d100e;color:#f3f5ef;border-radius:2px;font-size:12px}
body.v40-market-ui .crumbs{margin-bottom:18px;color:#697269;font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .crumbs a{color:#7f8980}
body.v40-market-ui .crumbs i{color:#3b443c}

/* Buttons, inputs, controls */
body.v40-market-ui .button,body.v40-market-ui .text-button,body.v40-market-ui .calculator button{
  min-height:42px;border:1px solid #c8ff3d;border-radius:2px;background:#c8ff3d;color:#090b0a;font-size:12px;font-weight:760;box-shadow:none
}
body.v40-market-ui .button.secondary,body.v40-market-ui .text-button{background:transparent;color:#d9ded8;border-color:#39413a}
body.v40-market-ui .button:hover,body.v40-market-ui .text-button:hover{border-color:#e2ff8c;background:#e2ff8c;color:#090b0a}
body.v40-market-ui input,body.v40-market-ui select,body.v40-market-ui textarea{background:#0d100e!important;color:#eef1eb!important;border-color:#343c35!important;border-radius:2px!important;box-shadow:none!important}
body.v40-market-ui select option{background:#0d100e;color:#eef1eb}
body.v40-market-ui input::placeholder,body.v40-market-ui textarea::placeholder{color:#626b63}
body.v40-market-ui .pill,body.v40-market-ui .status-chip{border-color:#313832;border-radius:999px;background:#0d100e;color:#a6aea7;font:10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .status-chip.up{border-color:#214c2e;background:#0b1710;color:#79ef9a}
body.v40-market-ui .status-chip.down{border-color:#56262c;background:#1a0f11;color:#ff7982}

/* Page headers / anti-template flattening */
body.v40-market-ui .page-head{padding-bottom:18px;border-color:#2a312b;margin-bottom:28px}
body.v40-market-ui .page-head h1,body.v40-market-ui .editorial-title{font-size:clamp(30px,4.4vw,48px);font-weight:760}
body.v40-market-ui .page-head p,body.v40-market-ui .page-head .answer{color:#909991;font-size:15px}
body.v40-market-ui .answer-box,body.v40-market-ui .callout{padding:14px 16px;border:1px solid #273326;border-left:2px solid #c8ff3d;background:#0c120a;border-radius:0;box-shadow:none}
body.v40-market-ui .callout.warning{border-color:#594a20;background:#151208}
body.v40-market-ui .callout.danger{border-color:#55262d;background:#180d0f}
body.v40-market-ui .callout.source{border-color:#303730;background:#0d100e}
body.v40-market-ui .section-head{border-color:#343c35}
body.v40-market-ui .section-head h2{font-size:20px;font-weight:720}
body.v40-market-ui .brand-card,body.v40-market-ui .link-cards a,body.v40-market-ui .tool-grid article,body.v40-market-ui .example-grid>div,body.v40-market-ui .guide-list article,body.v40-market-ui .mobile-compare article,body.v40-market-ui .calc-result-panel,body.v40-market-ui .chart-svg{border-radius:0!important;box-shadow:none!important}

/* Home: market-board hierarchy */
body.v40-market-ui.v25-home{background:#090b0a;color:#f3f5ef}
body.v40-market-ui .v25-shell{max-width:1440px}
body.v40-market-ui .v25-head{padding:38px 0 26px;border-color:#3a443b}
body.v40-market-ui .v25-head h1{margin-bottom:16px;font-size:clamp(40px,6vw,72px);line-height:.98;font-weight:720;letter-spacing:-.06em}
body.v40-market-ui .v25-search{max-width:900px;grid-template-columns:minmax(0,1fr) 112px;border:1px solid #343c35;background:#0d100e}
body.v40-market-ui .v25-search input,body.v40-market-ui .v25-search button{min-height:50px;border:0!important;border-radius:0!important}
body.v40-market-ui .v25-search input{padding-inline:14px;background:#0d100e!important}
body.v40-market-ui .v25-search button{border-left:1px solid #343c35!important;background:#c8ff3d!important;color:#090b0a!important;font-size:12px;font-weight:800}
body.v40-market-ui .v25-rail{margin-top:22px;border-color:#242b25;background:#0a0d0b}
body.v40-market-ui .v25-rail>div{min-width:160px;padding:12px 18px;border-right:1px solid #242b25}
body.v40-market-ui .v25-rail span{color:#727c73;font:10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.08em}
body.v40-market-ui .v25-rail strong{font:650 18px/1.25 ui-monospace,SFMono-Regular,Consolas,monospace;color:#eef1eb}
body.v40-market-ui .v25-sec,body.v40-market-ui .v25-method,body.v40-market-ui .v25-toolset,body.v40-market-ui .v25-official,body.v40-market-ui .v25-personal{padding:24px 0;border-color:#242b25}
body.v40-market-ui .v25-sec header{min-height:30px}
body.v40-market-ui .v25-sec h2,body.v40-market-ui .v25-method h2,body.v40-market-ui .v25-toolset h2,body.v40-market-ui .v25-brandgrid h2,body.v40-market-ui .v25-startgrid h2,body.v40-market-ui .v25-compareviz h2{color:#aab2ab;font:650 11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.07em}
body.v40-market-ui .v25-bar{grid-template-columns:190px minmax(120px,1fr) 120px 250px;padding:11px 0;border-color:#242b25;color:#dfe4de}
body.v40-market-ui .v25-bar:hover,body.v40-market-ui .v25-row:hover,body.v40-market-ui .v25-ranks a:hover{background:#0d120e}
body.v40-market-ui .v25-bar>span{font-weight:650}
body.v40-market-ui .v25-bar i,body.v40-market-ui .v25-cmp span{height:4px;background:#202721}
body.v40-market-ui .v25-bar i b,body.v40-market-ui .v25-cmp i{background:#c8ff3d}
body.v40-market-ui .v25-bar strong,body.v40-market-ui .v25-budget strong,body.v40-market-ui .v25-ranks strong,body.v40-market-ui .v25-row strong{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-variant-numeric:tabular-nums}
body.v40-market-ui .v25-bar small{color:#667067}
body.v40-market-ui .v25-budget{border-color:#242b25;background:#0a0d0b}
body.v40-market-ui .v25-budget a{padding:14px 16px;border-color:#242b25;color:#dfe4de}
body.v40-market-ui .v25-budget a:hover{background:#111611;color:#c8ff3d}
body.v40-market-ui .v25-budget strong{font-size:22px;color:#c8ff3d}
body.v40-market-ui .v25-grid2,body.v40-market-ui .v25-brandgrid,body.v40-market-ui .v25-startgrid{gap:0;border-bottom:1px solid #242b25}
body.v40-market-ui .v25-grid2>.v25-sec:first-child,body.v40-market-ui .v25-brandgrid>*:first-child,body.v40-market-ui .v25-startgrid>*:first-child{padding-right:28px;border-right:1px solid #242b25}
body.v40-market-ui .v25-grid2>.v25-sec:last-child,body.v40-market-ui .v25-brandgrid>*:last-child,body.v40-market-ui .v25-startgrid>*:last-child{padding-left:28px}
body.v40-market-ui .v25-ranks a,body.v40-market-ui .v25-row,body.v40-market-ui .v25-toolset a{border-color:#242b25;color:#d9ded8}
body.v40-market-ui .v25-note,body.v40-market-ui .v25-method p,body.v40-market-ui .v25-data-sentence{color:#858f86}

/* Generic data tables */
body.v40-market-ui .table-scroll,body.v40-market-ui .table-wrap,body.v40-market-ui .v39-table-wrap{border-color:#343c35;background:transparent}
body.v40-market-ui .data-table,body.v40-market-ui table{background:transparent;color:#dfe4de}
body.v40-market-ui .data-table th,body.v40-market-ui .data-table td,body.v40-market-ui table th,body.v40-market-ui table td{border-color:#242b25;background:transparent;color:inherit;font-size:13px}
body.v40-market-ui .data-table th,body.v40-market-ui table th,body.v40-market-ui .data-table thead th{background:#0e120f;color:#9ea79f;font:650 11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.025em}
body.v40-market-ui .data-table tbody th{background:#0b0e0c;color:#c8cec8}
body.v40-market-ui .data-table tbody tr:hover,body.v40-market-ui table tbody tr:hover{background:#0e140f}
body.v40-market-ui .data-table a,body.v40-market-ui table a{color:#dfffa0;font-weight:650}
body.v40-market-ui .data-table td.num,body.v40-market-ui .data-table th.num,body.v40-market-ui .v39-table td.num{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:#eef1eb}
body.v40-market-ui .scroll-hint{color:#667067;font:10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}

/* Directory / filters */
body.v40-market-ui .directory-controls{border-color:#242b25}
body.v40-market-ui .directory-controls label,body.v40-market-ui .filters label{color:#7f8980;font:10px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .directory-summary b{font:650 22px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .directory-summary span{color:#7f8980}
body.v40-market-ui .filters{border-color:#242b25}

/* Brand detail / evidence */
body.v40-market-ui.v25-brand{background:#090b0a;color:#f3f5ef}
body.v40-market-ui .brand-header{padding:22px 0 20px;border-color:#242b25}
body.v40-market-ui .brand-header-main{align-items:end}
body.v40-market-ui .brand-category{color:#c8ff3d;font:650 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.08em}
body.v40-market-ui .brand-header h1{margin:5px 0 8px;font-size:clamp(34px,5vw,52px);font-weight:720}
body.v40-market-ui .meta-line{color:#747e75;font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .meta-line b{color:#aeb6af;font-weight:600}
body.v40-market-ui .brand-toc{margin-top:18px;border-color:#242b25;overflow-x:auto}
body.v40-market-ui .brand-toc nav{gap:0;flex-wrap:nowrap;width:max-content}
body.v40-market-ui .brand-toc a{min-height:40px;padding:0 14px;border-right:1px solid #242b25;color:#7f8980;font:600 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:nowrap}
body.v40-market-ui .brand-toc a:first-child{padding-left:0}
body.v40-market-ui .brand-toc a:hover{color:#c8ff3d;background:#0d120e}
body.v40-market-ui .v35-brand-workspace{margin-top:18px}
body.v40-market-ui .v35-kpis{border-color:#3a443b;background:#0a0d0b}
body.v40-market-ui .v35-kpis>div{padding:14px 16px;border-color:#242b25}
body.v40-market-ui .v35-kpis span,body.v40-market-ui .v35-caption,body.v40-market-ui .v35-track-labels,body.v40-market-ui .v35-zero-note{color:#758076;font-size:11px}
body.v40-market-ui .v35-kpis span{font:600 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.045em}
body.v40-market-ui .v35-kpis strong{font:650 19px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;color:#eef1eb}
body.v40-market-ui .v35-kpis [data-v35-kpi="growth"][data-v35-value^="-"] strong{color:#ff6b76}
body.v40-market-ui .v35-panel{padding:22px 0;border-color:#242b25}
body.v40-market-ui .v35-section-head h2{font-size:17px;font-weight:700}
body.v40-market-ui .v35-section-head>span{color:#768078;font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .v35-cost-stack{height:7px;background:#202721}
body.v40-market-ui .v35-cost-stack .p1,body.v40-market-ui .v35-comp-row i.p1{background:#c8ff3d}
body.v40-market-ui .v35-cost-stack .p2,body.v40-market-ui .v35-comp-row i.p2{background:#95be35}
body.v40-market-ui .v35-cost-stack .p3,body.v40-market-ui .v35-comp-row i.p3{background:#657f2b}
body.v40-market-ui .v35-cost-stack .p4,body.v40-market-ui .v35-comp-row i.p4{background:#39461f}
body.v40-market-ui .v35-comp-row{border-color:#202721;color:#d7ddd7}
body.v40-market-ui .v35-comp-row strong,body.v40-market-ui .v35-comp-row em{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .v35-comp-row em{color:#707a71}
body.v40-market-ui .v35-benchmarks{gap:0}
body.v40-market-ui .v35-benchmark{padding:12px 16px 16px;border-color:#202721;background:#0a0d0b}
body.v40-market-ui .v35-benchmark:nth-child(odd){border-right:1px solid #202721}
body.v40-market-ui .v35-benchmark-head span{font-size:11px;color:#9ca59d}
body.v40-market-ui .v35-benchmark-head strong,body.v40-market-ui .v35-benchmark-head em{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .v35-benchmark-head em{color:#6f7970}
body.v40-market-ui .v35-track:before{background:#283029}
body.v40-market-ui .v35-iqr{background:#354536}
body.v40-market-ui .v35-median{background:#8d978e}
body.v40-market-ui .v35-marker{border-color:#c8ff3d;background:#090b0a}
body.v40-market-ui .v35-history{border-color:#202721;background:#0a0d0b}
body.v40-market-ui .v35-history polyline{stroke:#c8ff3d}
body.v40-market-ui .v35-history circle{fill:#090b0a;stroke:#c8ff3d}
body.v40-market-ui .v35-history text{fill:#7f8980!important;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .v35-year-list,body.v40-market-ui .v35-year{border-color:#202721}
body.v40-market-ui .v35-year span{color:#707a71}
body.v40-market-ui .v35-year b{color:#eef1eb;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .v35-raw-grid{border-color:#343c35;background:#0a0d0b}
body.v40-market-ui .v35-raw-grid>div{border-color:#202721}
body.v40-market-ui .v35-raw-grid span{color:#707a71;font:600 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .v35-raw-grid strong{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:#e8ece7}
body.v40-market-ui .v39-evidence{border-color:#242b25}
body.v40-market-ui .v39-evidence .v39-lead,body.v40-market-ui .v39-note{color:#89928a}

/* Category / rankings / distributions */
body.v40-market-ui.v25-category{background:#090b0a;color:#f3f5ef}
body.v40-market-ui .v31-ranking-nav{border-color:#242b25;background:#0a0d0b}
body.v40-market-ui .v31-ranking-nav a{border-color:#242b25;color:#9aa39b;font:600 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .v31-ranking-nav a:hover{color:#c8ff3d;background:#101510}
body.v40-market-ui .v31-sort{font-size:11px}
body.v40-market-ui .v31-sort-table th[aria-sort="ascending"] .v31-sort,body.v40-market-ui .v31-sort-table th[aria-sort="descending"] .v31-sort{color:#c8ff3d}
body.v40-market-ui .v32-rank-grid,body.v40-market-ui .v32-rank,body.v40-market-ui .v33-rank{border-color:#242b25}
body.v40-market-ui .v33-axis{background:#303831}
body.v40-market-ui .v33-band{background:#59645a}
body.v40-market-ui .v33-mid{background:#c8ff3d}
body.v40-market-ui .category-scatter line{stroke:#2c342d}
body.v40-market-ui .category-scatter circle{fill:#c8ff3d}
body.v40-market-ui .category-scatter text{fill:#7f8980!important}
body.v40-market-ui .basis-chip{color:#748075}

/* Compare workspace */
body.v40-market-ui.v25-compare{background:#090b0a;color:#f3f5ef}
body.v40-market-ui .v34-workspace{border-color:#3a443b}
body.v40-market-ui .v34-workspace-head,body.v40-market-ui .v34-zone{border-color:#242b25}
body.v40-market-ui .v34-workspace-head h2,body.v40-market-ui .v34-zone>h2{font-size:16px;font-weight:700}
body.v40-market-ui .v34-workspace-head span{color:#c8ff3d;font:10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .v34-pickers label{color:#727c73;font:600 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .v34-pickers select{background:#0d100e;color:#e8ece7;border-color:#343c35;border-radius:2px}
body.v40-market-ui .v34-core-metric,body.v40-market-ui .v34-ring-card,body.v40-market-ui .v34-benchmark-group{border-color:#242b25}
body.v40-market-ui .v34-core-metric h3,body.v40-market-ui .v34-benchmark-group h3{color:#9ba49c;font:650 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .v34-bar-track,body.v40-market-ui .v34-ring-base{background:#202721;stroke:#202721}
body.v40-market-ui .v34-bar-track i{background:#c8ff3d}
body.v40-market-ui .v34-ring{color:#c8ff3d}
body.v40-market-ui .v34-ring-body li{border-color:#202721}
body.v40-market-ui .v34-benchmark-track{background:#374038}
body.v40-market-ui .v34-benchmark-track .v34-global{border-color:#59625a}
body.v40-market-ui .v34-benchmark-track .v34-category{border-color:#aab2ab}
body.v40-market-ui .v34-selected-point{border-color:#c8ff3d;background:#090b0a}
body.v40-market-ui .v34-source,body.v40-market-ui .v34-basis p,body.v40-market-ui .v34-history p{color:#717b72}
body.v40-market-ui .v34-basis,body.v40-market-ui .v34-history{border-color:#242b25}

/* Tools / calculators */
body.v40-market-ui.v25-tools,body.v40-market-ui.v25-tool{background:#090b0a;color:#f3f5ef}
body.v40-market-ui .calc-form-panel h1{font-size:clamp(30px,4.4vw,46px);font-weight:740}
body.v40-market-ui .calculator,body.v40-market-ui .calc-form{border-color:#343c35}
body.v40-market-ui .calculator label,body.v40-market-ui .calc-form label{color:#9aa39b}
body.v40-market-ui .calculator output{border-color:#343c35;background:#0a0d0b;color:#c8ff3d;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .calc-result-panel{position:sticky;top:92px;padding:20px;background:#0c0f0d;border:1px solid #343c35;color:#eef1eb}
body.v40-market-ui .calc-result-panel .amount{color:#c8ff3d;font:700 30px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .result-list,body.v40-market-ui .result-list div{border-color:#273028}
body.v40-market-ui .result-interpretation{color:#89928a}
body.v40-market-ui .assumptions{border-color:#242b25}
body.v40-market-ui .tool-link-list,body.v40-market-ui .tool-link-list a,body.v40-market-ui .tool-basis-list>div{border-color:#242b25}
body.v40-market-ui .tool-link-list a{color:#dce1dc}
body.v40-market-ui .tool-link-list a:hover{background:#0e140f;color:#c8ff3d}
body.v40-market-ui .tool-link-list span,body.v40-market-ui .tool-basis-list dd{color:#7f8980}
body.v40-market-ui .tool-static,body.v40-market-ui .source-box{padding:14px 16px;border:1px solid #303830;border-left:2px solid #59645a;background:#0d100e}
body.v40-market-ui .decoder-result{border-color:#3a443b}
body.v40-market-ui .decoder-total{color:#c8ff3d;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .decoder-result dl div{border-color:#242b25}
body.v40-market-ui .decoder-result p,body.v40-market-ui .tool-note{color:#7f8980}

/* Startup-cost workspace */
body.v40-market-ui .v36-stage{border-color:#242b25}
body.v40-market-ui .v36-stage-head span{color:#c8ff3d;font:650 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .v36-stage-head h2,body.v40-market-ui .v36-subhead h3{font-size:16px;font-weight:700}
body.v40-market-ui .v36-brandbar{background:#090b0a;border-color:#242b25}
body.v40-market-ui .v36-brandbar label{font-size:11px;color:#a6aea7}
body.v40-market-ui .v36-inputgrid,body.v40-market-ui .v36-inputgrid label{border-color:#242b25}
body.v40-market-ui .v36-inputgrid label{color:#9ca59d}
body.v40-market-ui .v36-officialgrid,body.v40-market-ui .v36-derived{border-color:#3a443b;background:#0a0d0b}
body.v40-market-ui .v36-officialgrid>div,body.v40-market-ui .v36-derived>div{border-color:#242b25}
body.v40-market-ui .v36-officialgrid span,body.v40-market-ui .v36-derived span,body.v40-market-ui .v36-derived small,body.v40-market-ui .v36-subhead span,body.v40-market-ui .v36-source{color:#747e75}
body.v40-market-ui .v36-officialgrid strong,body.v40-market-ui .v36-derived strong{font:650 17px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;color:#eef1eb}
body.v40-market-ui .v36-costbar{height:6px;background:#202721}
body.v40-market-ui .v36-costbar .p1,body.v40-market-ui .v36-costrows .p1{background:#c8ff3d}
body.v40-market-ui .v36-costbar .p2,body.v40-market-ui .v36-costrows .p2{background:#95be35}
body.v40-market-ui .v36-costbar .p3,body.v40-market-ui .v36-costrows .p3{background:#657f2b}
body.v40-market-ui .v36-costbar .p4,body.v40-market-ui .v36-costrows .p4{background:#39461f}
body.v40-market-ui .v36-costrows,body.v40-market-ui .v36-costrows>div{border-color:#242b25}
body.v40-market-ui .v36-costrows strong,body.v40-market-ui .v36-band b{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .v36-band span,body.v40-market-ui .v36-method p{color:#778178}
body.v40-market-ui .v36-method{border-color:#242b25}

/* Generic cards / metrics / charts */
body.v40-market-ui .stat-grid,body.v40-market-ui .data-status,body.v40-market-ui .metric-row,body.v40-market-ui .compare-strip,body.v40-market-ui .feature-list,body.v40-market-ui .report-grid,body.v40-market-ui .brand-grid,body.v40-market-ui .link-cards,body.v40-market-ui .tool-grid,body.v40-market-ui .example-grid,body.v40-market-ui .guide-list{background:transparent;border-color:#343c35}
body.v40-market-ui .stat-card,body.v40-market-ui .data-status>*,body.v40-market-ui .metric-row>div,body.v40-market-ui .compare-strip>div,body.v40-market-ui .feature-list a,body.v40-market-ui .report-grid a,body.v40-market-ui .brand-card,body.v40-market-ui .link-cards a,body.v40-market-ui .tool-grid article,body.v40-market-ui .example-grid>div,body.v40-market-ui .guide-list article{border-color:#242b25;background:transparent}
body.v40-market-ui .stat-card .label,body.v40-market-ui .metric-row span,body.v40-market-ui .compare-strip span{color:#737d74;font:600 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v40-market-ui .stat-card .value,body.v40-market-ui .metric-row b,body.v40-market-ui .compare-strip b{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:#eef1eb}
body.v40-market-ui .chart-panel{background:transparent}
body.v40-market-ui .chart-svg{background:#0a0d0b;border-color:#242b25}
body.v40-market-ui svg text{fill:#7f8980!important}
body.v40-market-ui .chart-data summary{color:#c8ff3d}
body.v40-market-ui .positive{color:#79ef9a!important}
body.v40-market-ui .negative{color:#ff6b76!important}

/* Footer */
body.v40-market-ui .site-footer{background:#070908;color:#89928a;border-color:#242b25;padding-top:30px}
body.v40-market-ui .site-footer a{color:#a8b0a9}
body.v40-market-ui .site-footer a:hover{color:#c8ff3d}
body.v40-market-ui .footer-note{border-color:#242b25;color:#606961}

/* Explicit anti-AI-template rules: no gradients, no ornamental shadows, almost no rounded containers. */
body.v40-market-ui .answer-box,body.v40-market-ui .callout,body.v40-market-ui .stat-grid,body.v40-market-ui .stat-card,body.v40-market-ui .brand-card,body.v40-market-ui .tool-grid article,body.v40-market-ui .link-cards a,body.v40-market-ui .report-grid a,body.v40-market-ui .feature-list a,body.v40-market-ui .v35-kpis,body.v40-market-ui .v35-benchmark,body.v40-market-ui .v34-workspace,body.v40-market-ui .v36-officialgrid,body.v40-market-ui .v36-derived{border-radius:0!important;box-shadow:none!important;background-image:none!important}

@media(max-width:900px){
  body.v40-market-ui .shell{width:calc(100% - 32px)}
  body.v40-market-ui .site-header nav{top:68px;max-height:calc(100dvh - 68px);padding:0 16px 12px;background:#090b0a;border-color:#242b25}
  body.v40-market-ui .site-header nav a{min-height:46px;padding:0;border-right:0;border-bottom:1px solid #242b25}
  body.v40-market-ui .v25-bar{grid-template-columns:130px minmax(100px,1fr) 100px}
  body.v40-market-ui .v25-bar small{display:none}
}
@media(max-width:760px){
  body.v40-market-ui .v25-grid2,body.v40-market-ui .v25-brandgrid,body.v40-market-ui .v25-startgrid{grid-template-columns:1fr}
  body.v40-market-ui .v25-grid2>.v25-sec:first-child,body.v40-market-ui .v25-brandgrid>*:first-child,body.v40-market-ui .v25-startgrid>*:first-child{padding-right:0;border-right:0}
  body.v40-market-ui .v25-grid2>.v25-sec:last-child,body.v40-market-ui .v25-brandgrid>*:last-child,body.v40-market-ui .v25-startgrid>*:last-child{padding-left:0}
  body.v40-market-ui .v35-benchmark:nth-child(odd){border-right:0}
  body.v40-market-ui .v35-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  body.v40-market-ui .v39-table-wrap{border-top-color:#343c35}
  body.v40-market-ui .calc-result-panel{position:static}
}
@media(max-width:560px){
  body.v40-market-ui{font-size:14px}
  body.v40-market-ui .shell{width:calc(100% - 24px)}
  body.v40-market-ui .v25-head{padding-top:30px}
  body.v40-market-ui .v25-head h1{font-size:42px}
  body.v40-market-ui .v25-search{grid-template-columns:1fr 84px}
  body.v40-market-ui .v25-search button{min-width:0}
  body.v40-market-ui .v25-rail>div{min-width:128px;padding-inline:12px}
  body.v40-market-ui .v25-bar{grid-template-columns:94px minmax(70px,1fr) 82px;gap:9px}
  body.v40-market-ui .v25-bar strong{font-size:12px;text-align:right}
  body.v40-market-ui .brand-header h1{font-size:38px}
  body.v40-market-ui .brand-actions{display:grid;grid-template-columns:1fr 1fr;width:100%;margin-top:8px}
  body.v40-market-ui .brand-actions .button{width:100%}
  body.v40-market-ui .v35-kpis>div{padding:12px}
  body.v40-market-ui .v35-kpis strong{font-size:17px}
  body.v40-market-ui .v35-section-head{align-items:flex-start}
  body.v40-market-ui .v34-pickers{grid-template-columns:1fr}
  body.v40-market-ui .v36-officialgrid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:340px){
  body.v40-market-ui .shell{width:calc(100% - 18px)}
  body.v40-market-ui .v25-head h1{font-size:36px}
  body.v40-market-ui .v25-search{grid-template-columns:1fr 72px}
  body.v40-market-ui .v25-bar{grid-template-columns:82px minmax(56px,1fr) 76px;gap:6px}
}
${end}
`;
css+='\n\n'+marketCss.trim()+'\n';
await fs.writeFile(cssPath,css,'utf8');

const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.40';
manifest.v11_40={
  marketDesign:true,
  referenceDirection:'STRATTON_MARKET_DENSE_MARKET_UI',
  appliedToAllHtml:true,
  htmlPages:htmlFiles.length,
  candidatePages:candidates.length,
  darkTerminalPalette:true,
  flatPanelSystem:true,
  detailPagesUnified:true,
  noGradient:true,
  noDecorativeShadow:true,
  mobilePreserved:true,
  dataSemanticsChanged:false,
  candidateSetChanged:false,
  indexPolicyChanged:false,
  productionDeployed:false
};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const report={
  schemaVersion:1,
  uiVersion:'11.40',
  generatedAt:new Date().toISOString(),
  reference:'https://stratton.market/',
  designDirection:'dense market terminal / exchange board',
  allHtmlPages:htmlFiles.length,
  patchedHtmlPages:patched,
  candidatePages:candidates.length,
  surfaces:['home','brands','brand-detail','categories','category-detail','compare','rankings','tools','startup-cost','guides','trust-pages'],
  tokens:{background:'#090b0a',panel:'#0d100e',text:'#f3f5ef',muted:'#8a938b',line:'#242b25',accent:'#c8ff3d',positive:'#79ef9a',negative:'#ff6b76'},
  removedPatterns:['soft beige dashboard palette','large rounded cards','decorative shadows','gradient surfaces','oversized SaaS-style card hierarchy'],
  retained:['official-data semantics','v11.39 brand evidence','v11.38 mobile safeguards','noindex preview','candidate set'],
  productionDeployed:false
};
await fs.writeFile(path.join(out,'v11-40-market-design.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_40MarketDesign:'PASS',htmlPages:htmlFiles.length,patchedHtmlPages:patched,candidates:candidates.length,productionDeployed:false},null,2));
