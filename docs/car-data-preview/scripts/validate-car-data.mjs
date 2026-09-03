import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const vehicleRoot=path.join(root,'data','vehicles');
const manifest=JSON.parse(fs.readFileSync(path.join(vehicleRoot,'manifest.json'),'utf8'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const errors=[];const warnings=[];const seenVehicles=new Set();const seenVariants=new Set();
const fail=m=>errors.push(m),warn=m=>warnings.push(m);
const isPos=n=>Number.isFinite(Number(n))&&Number(n)>0;

for(const entry of manifest.vehicles){
  const p=path.join(vehicleRoot,entry.file);
  if(!fs.existsSync(p)){fail(`${entry.id}: source file missing`);continue}
  const v=read(p);
  if(seenVehicles.has(v.id)) fail(`${v.id}: duplicate vehicle id`); seenVehicles.add(v.id);
  for(const f of manifest.quality_gate.required_model_fields) if(v[f]==null||v[f]==='') fail(`${v.id}: missing ${f}`);
  if(!v.sources?.efficiency?.url) fail(`${v.id}: efficiency source URL missing`);
  if(!/^\d{4}\.\d{2}\.\d{2}$/.test(v.reviewed_on||'')) fail(`${v.id}: reviewed_on format`);
  if(Boolean(v.indexable)!==Boolean(entry.indexable)) fail(`${v.id}: manifest/indexable mismatch`);
  const rep=v.variants?.find(x=>x.variant_id===v.representative_variant_id); if(!rep) fail(`${v.id}: representative variant missing`);
  for(const x of v.variants||[]){
    if(seenVariants.has(x.variant_id)) fail(`${v.id}: duplicate variant ${x.variant_id}`); seenVariants.add(x.variant_id);
    const required=x.fuel_type==='ev'?manifest.quality_gate.required_variant_fields_ev:manifest.quality_gate.required_variant_fields_ice;
    for(const f of required) if(x[f]==null||x[f]==='') fail(`${x.variant_id}: missing ${f}`);
    if(x.fuel_type==='ev'){
      if(!isPos(x.energy_efficiency_combined_km_kwh)) fail(`${x.variant_id}: invalid km/kWh`);
      if(!isPos(x.range_km)) fail(`${x.variant_id}: invalid range`);
      if(x.fuel_economy_combined!=null) fail(`${x.variant_id}: EV contains km/L field`);
    }else{
      if(!isPos(x.fuel_economy_combined)) fail(`${x.variant_id}: invalid km/L`);
      if(!isPos(x.displacement_cc)) fail(`${x.variant_id}: invalid displacement`);
      if(x.energy_efficiency_combined_km_kwh!=null) fail(`${x.variant_id}: ICE/HEV contains EV efficiency field`);
    }
  }
  if(v.indexable&&/subset|needs/i.test(v.coverage_status||'')) fail(`${v.id}: indexable despite incomplete coverage status`);
}

function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name==='index.html'||e.name==='404.html')checkHtml(p)}}
function checkHtml(p){
  const s=fs.readFileSync(p,'utf8'),rel=path.relative(root,p);
  if(!/name=["']robots["'][^>]+noindex/i.test(s)) fail(`${rel}: preview noindex missing`);
  const ids=[...s.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]); const dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
  if(dup.length) fail(`${rel}: duplicate DOM ids ${dup.join(', ')}`);
  if(/공식 데이터 연결 전|준비중|\bPreview 데이터\b/i.test(s)) fail(`${rel}: unfinished user-facing copy`);
  if(/<title>\s*<\/title>/i.test(s)) fail(`${rel}: empty title`);
}
walk(root);

const ccTax=cc=>Math.round(cc*(cc<=1000?80:cc<=1600?140:200)*1.3);
if(ccTax(2497)!==649220) fail('tax sanity 2497cc');
if(ccTax(1598)!==290836) fail('tax sanity 1598cc');
if(ccTax(3470)!==902200) fail('tax sanity 3470cc');

console.log(`Validated ${seenVehicles.size} vehicles / ${seenVariants.size} variants`);
for(const w of warnings) console.warn('WARN',w);
if(errors.length){for(const e of errors) console.error('ERROR',e);process.exit(1)}
console.log('Validation passed');
