import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('docs/interior-cost-preview');
const dataSource=fs.readFileSync(path.resolve('interior-cost-core/data-v5.mjs'),'utf8');
const previous=dataSource.match(/export const UPDATED='([^']+)'/)?.[1];
const parts=new Intl.DateTimeFormat('en-CA',{
  timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'
}).formatToParts(new Date());
const pick=type=>parts.find(x=>x.type===type)?.value||'';
const reviewedOn=`${pick('year')}-${pick('month')}-${pick('day')}`;

if(!previous||!/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn)){
  throw new Error('Could not resolve review dates');
}

const textExt=new Set(['.html','.json','.xml','.txt']);
const walk=dir=>{
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(full);
    else if(textExt.has(path.extname(ent.name))){
      const before=fs.readFileSync(full,'utf8');
      const after=before.split(previous).join(reviewedOn);
      if(after!==before) fs.writeFileSync(full,after);
    }
  }
};
walk(root);

const reportPath=path.join(root,'data','v5-report.json');
const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
report.reviewed_on=reviewedOn;
fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(`Interior v5 reviewed_on=${reviewedOn}`);

await import('./enhance-v6.mjs');
