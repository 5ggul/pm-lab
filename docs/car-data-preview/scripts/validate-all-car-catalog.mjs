import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const merged=read('data/staging/kea-all-cars-merged.json');
const catalog=read('data/generated/all-car-catalog.json');
const delta=read('data/generated/all-car-delta.json');
const errors=[];const fail=m=>errors.push(m);
const sourceRows=(merged.rows||[]).length;
if(catalog.grouping_version!==2)fail(`unexpected grouping_version ${catalog.grouping_version}`);
if(catalog.source_rows!==sourceRows)fail(`catalog source_rows ${catalog.source_rows} != merged rows ${sourceRows}`);
if(catalog.active_record_count!==sourceRows)fail(`active_record_count ${catalog.active_record_count} != merged rows ${sourceRows}`);
if(catalog.active_group_count<3000)fail(`active group count suspiciously small: ${catalog.active_group_count}`);
if(catalog.active_record_count<4000)fail(`active record count suspiciously small: ${catalog.active_record_count}`);
if(catalog.maker_count<20)fail(`maker count suspiciously small: ${catalog.maker_count}`);
const active=(catalog.groups||[]).filter(g=>g.source_status==='active');
const archived=(catalog.groups||[]).filter(g=>g.source_status==='removed_from_latest');
if(active.length!==catalog.active_group_count)fail(`active group header mismatch ${active.length}/${catalog.active_group_count}`);
if(archived.length!==catalog.archived_group_count)fail(`archived group header mismatch ${archived.length}/${catalog.archived_group_count}`);
const groupIds=new Set(),recordIds=new Set();
for(const g of active){
  if(!g.catalog_id||groupIds.has(g.catalog_id))fail(`duplicate/missing catalog_id ${g.catalog_id}`);groupIds.add(g.catalog_id);
  if(!g.model||!Array.isArray(g.records)||!g.records.length)fail(`${g.catalog_id}: empty model/records`);
  if(g.row_count!==g.records.length)fail(`${g.catalog_id}: row_count ${g.row_count} != ${g.records.length}`);
  for(const r of g.records){
    if(!r.record_id||recordIds.has(r.record_id))fail(`duplicate/missing record_id ${r.record_id}`);
    recordIds.add(r.record_id);
    if(!r.model)fail(`${g.catalog_id}: record missing model`);
    if(r.display_source_row_index===null||r.display_source_row_index===undefined)fail(`${g.catalog_id}: record missing source row index ${r.record_id}`);
  }
}
if(recordIds.size!==sourceRows)fail(`unique row instances ${recordIds.size} != source rows ${sourceRows}`);
for(const g of archived){if(groupIds.has(g.catalog_id))fail(`active/archived catalog_id collision ${g.catalog_id}`);groupIds.add(g.catalog_id)}
if(!delta.baseline_reset){const maxRemoval=Math.max(25,Math.ceil(catalog.active_group_count*.10));if(delta.removed_count>maxRemoval)fail(`mass removal guard: ${delta.removed_count} > ${maxRemoval}`);}
if(errors.length){console.error(errors.slice(0,200).map(x=>'FAIL '+x).join('\n'));if(errors.length>200)console.error(`...and ${errors.length-200} more failures`);process.exit(1)}
console.log(`All-car validation passed: ${catalog.active_group_count} groups / ${catalog.active_record_count} source-row instances / ${catalog.maker_count} makers / delta +${delta.added_count} ~${delta.changed_count} -${delta.removed_count}${delta.baseline_reset?' baseline-reset':''}`);
