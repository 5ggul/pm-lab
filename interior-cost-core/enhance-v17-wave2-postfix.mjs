import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=r=>JSON.parse(read(r));
const exists=r=>fs.existsSync(path.join(ROOT,r));
const normalizeTarget=v=>{
  if(!v)return null;
  let s=String(v).replace(SITE,'').replace(BASE,'').split(/[?#]/)[0];
  if(!s)return'index.html';
  if(!s.startsWith('/'))return null;
  if(s==='/')return'index.html';
  s=s.replace(/^\//,'');
  if(/\.[a-z0-9]{1,8}$/i.test(s)&&!s.endsWith('.html'))return null;
  return s.endsWith('/')?s+'index.html':s.endsWith('.html')?s:s+'/index.html';
};
const release=json('data/release-url-set-v17-wave2.json');
const broken=[];
for(const x of release.urls||[]){
  const h=read(x.path);
  for(const m of h.matchAll(/href="([^"]+)"/g)){
    const href=m[1],p=normalizeTarget(href);
    if(!p)continue;
    if((href.startsWith(BASE)||href.startsWith(SITE)||href.startsWith('/'))&&!exists(p))broken.push({from:x.path,href,target:p});
  }
}
write('data/broken-link-audit-wave2-v17.json',JSON.stringify({version:'17.2.0',reviewed_on:release.reviewed_on,checked_after_audit_pages:true,release_count:release.total_count,broken_count:broken.length,broken},null,2));
const audit=json('data/wave2-landing-audit-v17.json');
audit.broken_release_links=broken.length;
audit.broken_release_link_rows=broken;
write('data/wave2-landing-audit-v17.json',JSON.stringify(audit,null,2));
const quality=json('data/site-quality-wave2-v17.json');
quality.broken_release_links=broken.length;
quality.link_recheck_after_audit_pages=true;
write('data/site-quality-wave2-v17.json',JSON.stringify(quality,null,2));
const gate=json('data/launch-gate-wave2-v17.json');
gate.checks.broken_release_links_zero=broken.length===0;
gate.link_recheck_after_audit_pages=true;
write('data/launch-gate-wave2-v17.json',JSON.stringify(gate,null,2));
const report=json('data/v17-wave2-report.json');
report.checks.broken_release_links_zero=broken.length===0;
report.link_recheck_after_audit_pages=true;
write('data/v17-wave2-report.json',JSON.stringify(report,null,2));
if(broken.length)throw new Error(`v17 Wave 2 postfix broken links ${JSON.stringify(broken)}`);
if(Object.values(gate.checks).some(v=>v!==true))throw new Error(`v17 Wave 2 postfix gate still failing ${JSON.stringify(gate.checks)}`);
console.log(JSON.stringify({version:'17.2.0',link_recheck:true,release_count:release.total_count,broken_links:broken.length,checks:gate.checks},null,2));
