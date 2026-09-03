import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const vehicleRoot=path.join(root,'data','vehicles');
const manifest=JSON.parse(fs.readFileSync(path.join(vehicleRoot,'manifest.json'),'utf8'));
const fuelPrice=JSON.parse(fs.readFileSync(path.join(root,'data','fuel-price.json'),'utf8'));
const annualKm=manifest.default_assumptions.annual_distance_km;
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const round=n=>Math.round(n);

function taxForVariant(v){
  if(v.fuel_type==='ev') return {base:100000,education:30000,total:130000};
  const cc=Number(v.displacement_cc),rate=cc<=1000?80:cc<=1600?140:200,base=cc*rate;
  return {base,education:base*.3,total:base*1.3};
}
function priceFor(v){
  if(v.fuel_type==='gasoline'||v.fuel_type==='hybrid') return fuelPrice.prices.gasoline;
  if(v.fuel_type==='diesel') return fuelPrice.prices.diesel;
  if(v.fuel_type==='lpg') return fuelPrice.prices.lpg;
  return null;
}
const combinedFor=v=>v.fuel_type==='ev'?v.energy_efficiency_combined_km_kwh:v.fuel_economy_combined;
const cityFor=v=>v.fuel_type==='ev'?v.energy_efficiency_city_km_kwh:v.fuel_economy_city;
const highwayFor=v=>v.fuel_type==='ev'?v.energy_efficiency_highway_km_kwh:v.fuel_economy_highway;
const fuelKey=v=>v.fuel_type==='ev'?'electric':v.fuel_type==='lpg'?'lpg':v.fuel_type==='diesel'?'diesel':'gas';
function label(v){
  const bits=[v.powertrain,v.drive];
  if(v.seats) bits.push(`${v.seats}인승`);
  if(v.wheel_inch) bits.push(`${v.wheel_inch}인치`);
  if(v.builtin_cam===true) bits.push('빌트인캠');
  if(v.builtin_cam===false && /no-bic|no-cam/i.test(v.variant_id)) bits.push('빌트인캠 미적용');
  return bits.filter(Boolean).join(' · ');
}
function compatibilityVariant(v){
  return {
    id:v.variant_id,label:label(v),powertrain:v.powertrain,fuel:fuelKey(v),fuelType:v.fuel_type,cc:v.displacement_cc??null,
    combined:combinedFor(v),city:cityFor(v)??null,highway:highwayFor(v)??null,grade:v.efficiency_grade??null,
    range:v.range_km??null,battery:v.battery_kwh??null,drive:v.drive,wheel:v.wheel_inch,seats:v.seats??null,
    builtinCam:v.builtin_cam??null,transmission:v.transmission??null,power:v.max_power??(v.motor_output_ps?`${v.motor_output_ps} PS`:null),
    torque:v.max_torque??(v.motor_torque_nm?`${v.motor_torque_nm} Nm`:null),motorOutputKw:v.motor_output_kw??null,
    curbWeight:v.curb_weight_kg??null
  };
}
function vehicleToCatalog(v){
  const variants=v.variants.map(compatibilityVariant),repIndex=v.variants.findIndex(x=>x.variant_id===v.representative_variant_id);
  if(repIndex<0) throw new Error(`${v.id}: representative variant not found`);
  const sourceRep=v.variants[repIndex],rep=variants[repIndex],tax=taxForVariant(sourceRep),price=priceFor(sourceRep);
  const energy=price==null?null:round(annualKm/combinedFor(sourceRep)*price),total=energy==null?null:round(tax.total+energy);
  const energyKind=sourceRep.fuel_type==='ev'?'ev':'ice';
  return {
    id:v.id,maker:v.maker,model:v.display_name||v.model,generation:v.generation,code:v.code,yearLabel:String(v.model_year),segment:v.segment,
    type:/SUV|크로스오버/.test(v.body_type)?(energyKind==='ev'?'ev':'suv'):(energyKind==='ev'?'ev':'sedan'),energy:energyKind,path:`.${v.path}`,
    aliases:v.aliases,indexable:v.indexable,reviewedOn:v.reviewed_on,coverageStatus:v.coverage_status,dimensions:v.dimensions,battery:v.battery??null,
    image:v.image.url,credit:`${v.image.author} · ${v.image.license}`,imageMeta:v.image,
    sourceName:v.sources.efficiency.name,sourceUrl:v.sources.efficiency.url,specSourceName:v.sources.specs?.name??null,specSourceUrl:v.sources.specs?.url??null,
    rep:{...rep,tax:round(tax.total),taxBase:round(tax.base),educationTax:round(tax.education),annualEnergy:energy,total},variants
  };
}

const sources=manifest.vehicles.map(entry=>{
  const data=readJson(path.join(vehicleRoot,entry.file));
  if(Boolean(data.indexable)!==Boolean(entry.indexable)) throw new Error(`${entry.id}: manifest indexable mismatch`);
  return {...data,display_name:entry.display_name};
});
const cars=sources.map(vehicleToCatalog);
const catalog={generatedFrom:'data/vehicles/manifest.json',dataAsOf:fuelPrice.price_as_of,annualKm,gasPrice:fuelPrice.prices.gasoline,
  dieselPrice:fuelPrice.prices.diesel,lpgPrice:fuelPrice.prices.lpg,fuelPriceSource:fuelPrice.source,fuelPriceAsOf:fuelPrice.price_as_of,
  fuelPriceStale:Boolean(fuelPrice.stale),cars};
const js=`/* GENERATED FILE. Source: data/vehicles/*.json + data/fuel-price.json */\nwindow.CAR_CATALOG=${JSON.stringify(catalog,null,2)};\nwindow.CAR_CATALOG.byId=Object.fromEntries(window.CAR_CATALOG.cars.map(c=>[c.id,c]));\nwindow.CAR_CATALOG.taxForCc=function(cc){const r=cc<=1000?80:cc<=1600?140:200;return Math.round(cc*r*1.3)};\nwindow.CAR_CATALOG.energyCost=function(v,km,price){return price?Math.round(km/v.combined*price):null};\n`;
fs.writeFileSync(path.join(root,'assets','catalog-data.js'),js);
fs.mkdirSync(path.join(root,'data','generated'),{recursive:true});
fs.writeFileSync(path.join(root,'data','generated','catalog.json'),JSON.stringify(catalog,null,2)+'\n');
console.log(`Built ${cars.length} vehicles / ${cars.reduce((n,c)=>n+c.variants.length,0)} variants`);
