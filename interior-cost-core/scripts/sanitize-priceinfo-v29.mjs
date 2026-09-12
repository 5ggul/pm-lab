import fs from 'node:fs';
const files=['interior-cost-core/data/g2b-priceinfo-v29-summary.json','interior-cost-core/data/g2b-priceinfo-v29-interior.json'];
const blocked=new Set(['ServiceKey','invstDeptTelNo','invstOfclNm','cntrctCorpTelNo','cntrctCorpNm']);
for(const file of files){
  const value=JSON.parse(fs.readFileSync(file,'utf8'));
  if(Array.isArray(value.source_summary)) for(const src of value.source_summary) if(Array.isArray(src.fields)) src.fields=src.fields.filter(x=>!blocked.has(x));
  fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
}
console.log(JSON.stringify({ok:true,files},null,2));
