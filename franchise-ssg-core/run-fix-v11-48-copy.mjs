import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snapshot=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const reportPath=path.join(out,'v11-48-brand-distinctness.json');
const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
const fileFor=r=>path.join(out,...String(r).split('/').filter(Boolean),'index.html');
let filesPatched=0,phrasesFixed=0;
for(const b of snapshot.brands||[]){
  const file=fileFor(b.route);
  let html=await fs.readFile(file,'utf8');
  const re=/<!-- v11\.48 brand distinctness -->([\s\S]*?)<!-- v11\.48 brand distinctness end -->/;
  const m=html.match(re);if(!m)throw new Error(`v11.48 brief missing ${b.slug}`);
  let block=m[1],before=block;
  const rules=[[/ 낮고 \(([-+\d.]+%)\)\./g,' 낮습니다 ($1).'],[/ 높고 \(([-+\d.]+%)\)\./g,' 높습니다 ($1).'],[/ 적고 \(([-+\d.]+%)\)\./g,' 적습니다 ($1).'],[/ 많고 \(([-+\d.]+%)\)\./g,' 많습니다 ($1).']];
  for(const [pattern,replacement] of rules){const hits=(block.match(pattern)||[]).length;if(hits){phrasesFixed+=hits;block=block.replace(pattern,replacement)}}
  if(block!==before){html=html.replace(re,`<!-- v11.48 brand distinctness -->${block}<!-- v11.48 brand distinctness end -->`);await fs.writeFile(file,html,'utf8');filesPatched++}
}
report.copyPolishApplied=true;report.copyPolishFiles=filesPatched;report.copyPolishPhrases=phrasesFixed;
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({v11_48CopyPolish:'PASS',filesPatched,phrasesFixed},null,2));
