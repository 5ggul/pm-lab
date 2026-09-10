import fs from 'node:fs';
import path from 'node:path';

export const EXPECTED_COLUMNS = [
  'submission_id','schema_version','quote_month','region_level1','pyeong_band','building_age_band','scope','bathroom_count',
  'window_status','vat_status','waste_status','total_amount_manwon','work_items_json','source_type','quality_grade','quality_flags_json',
  'review_status','reviewer_status','received_at'
];
const EXPECTED = new Set(EXPECTED_COLUMNS);
const FORBIDDEN_NAMES = /(^|_)(name|company|address|phone|email|account|memo|note|image|file|user_agent|ip_address)($|_)/i;

export function extractWranglerRows(input){
  if(Array.isArray(input)){
    if(input.every(x=>x && typeof x==='object' && Array.isArray(x.results))) return input.flatMap(x=>x.results);
    if(input.every(x=>x && typeof x==='object' && 'submission_id' in x)) return input;
  }
  if(input && typeof input==='object'){
    if(Array.isArray(input.results)) return input.results;
    if(Array.isArray(input.records)) return input.records;
  }
  throw new Error('Unsupported Wrangler D1 JSON shape');
}

export function validateExportRows(rows){
  if(!Array.isArray(rows)) throw new Error('D1 export is not an array');
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    if(!row || typeof row!=='object' || Array.isArray(row)) throw new Error(`row ${i} is not an object`);
    const keys=Object.keys(row);
    for(const key of keys){
      if(FORBIDDEN_NAMES.test(key)) throw new Error(`forbidden column in D1 export: ${key}`);
      if(!EXPECTED.has(key)) throw new Error(`unexpected column in D1 export: ${key}`);
    }
    for(const key of EXPECTED_COLUMNS){
      if(!(key in row)) throw new Error(`missing column in D1 export row ${i}: ${key}`);
    }
  }
  return rows;
}

export function normalizeWranglerExport(input){
  return validateExportRows(extractWranglerRows(input));
}

function runCli(){
  const [inputPath,outputPath]=process.argv.slice(2);
  if(!inputPath||!outputPath) throw new Error('usage: node normalize-d1-export.mjs INPUT OUTPUT');
  const parsed=JSON.parse(fs.readFileSync(path.resolve(inputPath),'utf8'));
  const rows=normalizeWranglerExport(parsed);
  const out=path.resolve(outputPath);
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify({records:rows})+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:true,row_count:rows.length,output:path.basename(out)}));
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)) runCli();
