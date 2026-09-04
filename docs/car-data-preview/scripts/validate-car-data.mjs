import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const vehicleRoot=path.join(root,'data','vehicles');
const manifest=JSON.parse(fs.readFileSync(path.join(vehicleRoot,'manifest.json'),'utf8'));
const fuelPrice=JSON.parse(fs.readFileSync(path.join(root,'data','fuel-price.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data','generated','catalog.json'),'utf8'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const errors=[],warnings=[],seenVehicles=new Set(),seenVariants=new Set(),titles=new Map();
const fail=m=>errors.push(m),warn=m=>warnings.push(m),isPos=n=>Number.isFinite(Number(n))&&Number(n)>0;
const htmlFor=v=>path.join(root,v.path.replace(/^\//,''),'index.html');
const fmt=n=>Math.round(Number(n)).toLocaleString('ko-KR');

for(const entry of manifest.vehicles){
  const p=path.join(vehicleRoot,entry.file);
  if(!fs.existsSync(p)){fail(`${entry.id}: source file missing`);continue}
  const v=read(p);
  if(seenVehicles.has(v.id))fail(`${v.id}: duplicate vehicle id`);seenVehicles.add(v.id);
  for(const f of manifest.quality_gate.required_model_fields)if(v[f]==null||v[f]==='')fail(`${v.id}: missing ${f}`);
  if(!/^https?:\/\//.test(v.sources?.efficiency?.url||''))fail(`${v.id}: efficiency source URL invalid`);
  if(!/^\d{4}\.\d{2}\.\d{2}$/.test(v.reviewed_on||''))fail(`${v.id}: reviewed_on format`);
  if(Boolean(v.indexable)!==Boolean(entry.indexable))fail(`${v.id}: manifest/indexable mismatch`);
  const rep=v.variants?.find(x=>x.variant_id===v.representative_variant_id);if(!rep)fail(`${v.id}: representative variant missing`);
  for(const x of v.variants||[]){
    if(seenVariants.has(x.variant_id))fail(`${v.id}: duplicate variant ${x.variant_id}`);seenVariants.add(x.variant_id);
    const required=x.fuel_type==='ev'?manifest.quality_gate.required_variant_fields_ev:manifest.quality_gate.required_variant_fields_ice;
    for(const f of required)if(x[f]==null||x[f]==='')fail(`${x.variant_id}: missing ${f}`);
    if(x.fuel_type==='ev'){
      if(!isPos(x.energy_efficiency_combined_km_kwh))fail(`${x.variant_id}: invalid km/kWh`);
      if(!isPos(x.range_km))fail(`${x.variant_id}: invalid range`);
      if(x.fuel_economy_combined!=null)fail(`${x.variant_id}: EV contains km/L field`);
    }else{
      if(!isPos(x.fuel_economy_combined))fail(`${x.variant_id}: invalid km/L`);
      if(!isPos(x.displacement_cc))fail(`${x.variant_id}: invalid displacement`);
      if(x.energy_efficiency_combined_km_kwh!=null)fail(`${x.variant_id}: ICE/HEV contains EV efficiency field`);
    }
  }
  if(v.indexable&&/subset|needs|incomplete/i.test(v.coverage_status||''))fail(`${v.id}: indexable despite incomplete coverage status`);
  if(v.indexable){
    const hp=htmlFor(v);if(!fs.existsSync(hp)){fail(`${v.id}: model HTML missing`);continue}
    const s=fs.readFileSync(hp,'utf8');
    const title=(s.match(/<title>([^<]+)<\/title>/i)||[])[1];if(!title)fail(`${v.id}: title missing`);else{if(titles.has(title))fail(`${v.id}: duplicate title with ${titles.get(title)}`);titles.set(title,v.id)}
    if(!/<meta name="description" content="[^"]+"/i.test(s))fail(`${v.id}: meta description missing`);
    if((s.match(/<h1\b/gi)||[]).length!==1)fail(`${v.id}: H1 count must be 1`);
    const expectedCanonical=`https://5ggul.github.io/pm-lab/car-data-preview${v.path}`;
    if(!s.includes(`<link rel="canonical" href="${expectedCanonical}">`))fail(`${v.id}: self canonical missing`);
    if(!/(class="(?:model-lite-answer|answer)"|class='(?:model-lite-answer|answer)')/i.test(s))fail(`${v.id}: static Answer Block missing`);
    const c=catalog.cars.find(x=>x.id===v.id);if(!c){fail(`${v.id}: generated catalog row missing`);continue}
    if(c.rep.id!==v.representative_variant_id)fail(`${v.id}: generated rep.id mismatch`);
    if(!s.includes(String(c.rep.combined)))fail(`${v.id}: representative efficiency missing from initial HTML`);
    if(!s.includes(fmt(c.rep.tax)))fail(`${v.id}: representative tax missing from initial HTML`);
    if(c.energy==='ev'&&!s.includes(String(c.rep.range)))fail(`${v.id}: EV range missing from initial HTML`);
    if(!/^https?:\/\//.test(c.sourceUrl||''))fail(`${v.id}: generated official source URL invalid`);
    const jsonLd=[...s.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];if(jsonLd.length!==1)fail(`${v.id}: expected exactly one build-time JSON-LD block, got ${jsonLd.length}`);
    const entityIds=[];for(const m of jsonLd){try{const j=JSON.parse(m[1]),nodes=j['@graph']||[j];for(const n of nodes)if(n&&n['@id'])entityIds.push(n['@id'])}catch{fail(`${v.id}: invalid JSON-LD`)}}const duplicateEntities=[...new Set(entityIds.filter((x,i)=>entityIds.indexOf(x)!==i))];if(duplicateEntities.length)fail(`${v.id}: duplicate JSON-LD entity ${duplicateEntities.join(',')}`);
  }
}

function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name==='index.html'||e.name==='404.html')checkHtml(p)}}
function checkHtml(p){const s=fs.readFileSync(p,'utf8'),rel=path.relative(root,p);if(!/name=["']robots["'][^>]+noindex/i.test(s))fail(`${rel}: preview noindex missing`);const ids=[...s.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]),dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];if(dup.length)fail(`${rel}: duplicate DOM ids ${dup.join(', ')}`);if(/공식 데이터 연결 전|준비중|\bPreview 데이터\b/i.test(s))fail(`${rel}: unfinished user-facing copy`);if(/<title>\s*<\/title>/i.test(s))fail(`${rel}: empty title`);const visible=s.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'');if(/>\s*(?:NaN|null|undefined)\s*</i.test(visible))fail(`${rel}: invalid user-visible placeholder`)}
walk(root);

const modelLite=fs.readFileSync(path.join(root,'assets','model-lite.js'),'utf8');if(/addSchema|application\/ld\+json/i.test(modelLite))fail('model-lite.js: runtime JSON-LD injector found');
const utils=fs.readFileSync(path.join(root,'assets','car-utils.js'),'utf8');const annual=fs.readFileSync(path.join(root,'tools','annual-cost','index.html'),'utf8'),compare=fs.readFileSync(path.join(root,'compare','index.html'),'utf8');
for(const [fuel,token] of [['diesel','dieselPrice'],['lpg','lpgPrice'],['ev','electric']]){if(catalog.cars.some(c=>c.variants.some(v=>v.fuelType===fuel))){if(fuel!=='ev'&&!catalog[token])fail(`${fuel}: catalog price missing`);if(!utils.toLowerCase().includes(fuel==='ev'?'electric':fuel))fail(`${fuel}: shared helper support missing`)}}
if(!annual.includes('C.publicCars')||!compare.includes('C.publicCars'))fail('publicCars: compare/annual-cost not using public list');
const nonPublic=manifest.vehicles.filter(v=>!v.indexable).map(v=>v.id);for(const id of nonPublic){for(const rel of ['index.html','compare/index.html','tools/annual-cost/index.html','search/index.html','cars/index.html']){const s=fs.readFileSync(path.join(root,rel),'utf8');if(s.includes(`value="${id}"`)||s.includes(`car=${id}`))fail(`${id}: leaked into public ${rel}`)}}
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');if(!/GENERATED:HOME-CATALOG:START[\s\S]+<a class="car-card" href=/i.test(home))fail('home: static car links missing');if(!/GENERATED:HOME-COST:START[\s\S]+class="home-total"/i.test(home))fail('home: static cost rows missing');

const ccTax=cc=>Math.round(cc*(cc<=1000?80:cc<=1600?140:200)*1.3),energy=(km,eff,p)=>Math.round(km/eff*p);
if(ccTax(2497)!==649220)fail('tax sanity 2497cc');if(ccTax(1598)!==290836)fail('tax sanity 1598cc');if(ccTax(3470)!==902200)fail('tax sanity 3470cc');
function regression(carId,variantId,expected){const c=catalog.cars.find(x=>x.id===carId),v=c?.variants.find(x=>x.id===variantId);if(!c||!v){fail(`regression ${carId}/${variantId}: missing`);return}const tax=v.fuel==='electric'?130000:ccTax(v.cc),price=v.fuel==='diesel'?catalog.dieselPrice:v.fuel==='lpg'?catalog.lpgPrice:v.fuel==='electric'?null:catalog.gasPrice,e=price==null?null:energy(20000,v.combined,price),total=e==null?null:tax+e;for(const [k,a,b] of [['efficiency',v.combined,expected.efficiency],['tax',tax,expected.tax],['energy',e,expected.energy],['total',total,expected.total]])if(a!==b)fail(`regression ${carId}/${variantId}: ${k} ${a} != ${b}`)}
regression('grandeur-gn7','gn7-g25-2wd-18',{efficiency:11.7,tax:649220,energy:3178906,total:3828126});
regression('sorento-mq4','mq4-g25-2wd-18-0',{efficiency:10.8,tax:649220,energy:3443815,total:4093035});
regression('sorento-mq4','mq4-d22-2wd-18-0',{efficiency:14.3,tax:559260,energy:2578741,total:3138001});
regression('sorento-mq4','mq4-hev16-2wd-17-0',{efficiency:15.7,tax:290836,energy:2368994,total:2659830});
regression('grandeur-gn7','gn7-lpg35-2wd-18',{efficiency:7.8,tax:902200,energy:2816897,total:3719097});
regression('ev6-cv','cv-lr-2wd-19',{efficiency:5.3,tax:130000,energy:null,total:null});

console.log(`Validated ${seenVehicles.size} vehicles / ${seenVariants.size} variants / ${manifest.vehicles.filter(v=>v.indexable).length} public`);for(const w of warnings)console.warn('WARN',w);if(errors.length){for(const e of errors)console.error('ERROR',e);process.exit(1)}console.log('Validation passed');
