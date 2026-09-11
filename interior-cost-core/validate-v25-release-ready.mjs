import fs from 'node:fs';
import path from 'node:path';

await import('./audit-v25-release-readiness.mjs');

const ROOT=path.resolve('docs/interior-cost-preview');
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{
  const full=path.join(dir,ent.name);
  return ent.isDirectory()?walk(full):[full];
});
const rel=f=>path.relative(ROOT,f).split(path.sep).join('/');
const descOf=html=>html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1]?.trim()
  ||html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["'][^>]*>/i)?.[1]?.trim()||'';

const base=JSON.parse(read('data/v25-release-readiness-baseline.json'));
const description_warnings=walk(ROOT)
  .filter(f=>f.endsWith('.html'))
  .map(f=>{const description=descOf(fs.readFileSync(f,'utf8'));return {path:rel(f),length:description.length,description};})
  .filter(x=>x.description&&(x.length<40||x.length>170));
const report={
  ...base,
  version:'25.0.0',
  report_type:'release-ready-final',
  release_ready:base.blockers.length===0&&description_warnings.length===0,
  description_warnings,
  checks:{
    blockers_zero:base.blockers.length===0,
    surface_dev_leaks_zero:base.metrics.surface_dev_leak_pages===0,
    broken_links_zero:base.metrics.broken_internal_links===0,
    thin_zero:base.metrics.thin_under_500===0,
    duplicate_titles_zero:base.metrics.duplicate_titles===0,
    duplicate_canonicals_zero:base.metrics.duplicate_canonicals===0,
    h1_clean:base.metrics.h1_issues===0,
    jsonld_clean:base.metrics.jsonld_parse_errors===0,
    description_warnings_zero:description_warnings.length===0,
    policy_complete:base.metrics.policy_pages_present===7,
    preview_noindex_all:base.metrics.preview_noindex_pages===base.metrics.html_pages,
    ads_off:base.metrics.ad_code_present===false,
    forbidden_data_off:base.metrics.forbidden_data_present===false,
    cname_off:base.metrics.cname_present===false
  },
  preview_boundary:{production_switch:false,search_console_submission:false,ads_injected:false,merge_to_main:false}
};
write('data/v25-release-readiness.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({version:report.version,release_ready:report.release_ready,metrics:report.metrics,description_warnings,checks:report.checks,preview_boundary:report.preview_boundary},null,2));
if(!report.release_ready||Object.values(report.checks).some(v=>v!==true))throw new Error('v25 final release readiness gate failed');
