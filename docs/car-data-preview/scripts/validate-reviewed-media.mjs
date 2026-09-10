import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(new URL('../data/'+p,import.meta.url),'utf8'));
const families=read('generated/family-detail-index.json').families;
const fullHierarchy=read('generated/service-hierarchy.json');
const ids=new Set(families.map(f=>f.family_id));
const images=read('vehicle-image-sources.json');
const licenses={'CC0 1.0':'https://creativecommons.org/publicdomain/zero/1.0','CC BY 4.0':'https://creativecommons.org/licenses/by/4.0','CC BY-SA 4.0':'https://creativecommons.org/licenses/by-sa/4.0'};
for(const version of ['2.0','3.0'])for(const kind of ['BY','BY-SA'])licenses[`CC ${kind} ${version}`]=`https://creativecommons.org/licenses/${kind.toLowerCase()}/${version}`;
assert.equal(images.schema_version,2);
assert.ok(images.records.length>=50);
assert.equal(new Set(images.records.map(r=>r.family_id)).size,images.records.length);
for(const r of images.records){
  assert.ok(ids.has(r.family_id),`Unknown photo family ${r.family_id}`);
  for(const key of ['file','generation','author','reviewed_on','changes','display_note'])assert.ok(typeof r[key]==='string'&&r[key].trim(),`${r.family_id}: ${key}`);
  assert.match(r.reviewed_on,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new URL(r.source_page).origin,'https://commons.wikimedia.org');
  assert.equal(decodeURIComponent(new URL(r.source_page).pathname).replaceAll('_',' '),'/wiki/File:'+r.file);
  for(const key of ['image_url','original_url']){
    const u=new URL(r[key]);assert.equal(u.protocol,'https:');assert.ok(['thumb.wikimedia.org','upload.wikimedia.org'].includes(u.hostname));
  }
  assert.ok(licenses[r.license],`Unapproved license ${r.license}`);
  assert.equal(r.license_url.replace(/\/$/,''),licenses[r.license]);
  assert.equal(r.attribution_required,r.license!=='CC0 1.0');
  assert.ok(Number.isInteger(r.width)&&r.width>0&&Number.isInteger(r.height)&&r.height>0);
  assert.ok(r.review_evidence.description&&r.review_evidence.categories.length&&r.review_evidence.visual_check);
  assert.equal(r.review_evidence.family_match.family_name,families.find(f=>f.family_id===r.family_id).family_name);
}
const g80=images.records.find(r=>r.family_id==='genesis-g80');
const compact=read('vehicle-photo-index.json');
assert.deepEqual(compact.records.map(r=>r.family_id),images.records.map(r=>r.family_id));
const checkedFiles=new Set();
for(const r of images.records){
 const display=compact.records.find(x=>x.family_id===r.family_id);
 for(const key of Object.keys(display))assert.deepEqual(display[key],r[key],`${r.family_id}: compact ${key}`);
 assert.ok(r.optimized?.files.length>=2,`${r.family_id}: local responsive photos`);
 for(const f of r.optimized.files){if(checkedFiles.has(f.path))continue;checkedFiles.add(f.path);
  assert.match(f.path,/^assets\/vehicle-images\/[a-z0-9-]+\.webp$/);
  const bytes=fs.readFileSync(new URL('../'+f.path,import.meta.url));
  assert.equal(bytes.length,f.bytes);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,`${f.path}: content hash`);
 }
}
const familyById=new Map(fullHierarchy.families.map(f=>[f.family_id,f]));
assert.deepEqual(familyById.get('family-35db5d89d1aad384').raw_models,['피아트 500']);
assert.deepEqual(familyById.get('family-9908e07705ebb3e9').raw_models,['볼보 S60B5']);
assert.ok(familyById.get('family-7e375833fd3c4cf4').raw_models.includes('Mercedes-AMG GT-R'));
assert.ok(familyById.get('family-ddb907852abab978').raw_models.includes('Mercedes-Benz EQE500 4MATIC SUV'));
assert.ok(familyById.get('family-ae41659b80930b5a').raw_models.includes('Mercedes-Benz S500 4MATIC'));
assert.ok(familyById.get('family-31d4601f914e8946').raw_models.includes('Mercedes-Maybach GLS600 4MATIC'));
assert.deepEqual(familyById.get('family-2fc1683518e4e8ab').raw_models,['Peugeot 5008 1.2 Puretech','Peugeot 5008 1.5 BlueHDi','Peugeot 5008 2.0 BlueHDi','Peugeot 5008 Hybrid']);
for(const [id,pattern] of [['genesis-electrified-g80',/Electrified G80/],['genesis-electrified-gv70',/Electrified GV70/],['family-b909d5b3019380b2',/2016 Chevrolet Trax/],['family-5c897f47fee98693',/2024 Chevrolet Trax/],['family-22359aafc9f06237',/Veloster N/]])assert.match(images.records.find(r=>r.family_id===id).file,pattern);
assert.match(g80.generation,/RG3/);assert.ok(!g80.review_evidence.categories.includes('Genesis G80 (DH)'));
const bodies=read('body-style-reviewed.json');
const schema=read('body-style-reviewed.schema.json');
const item=schema.properties.records.items;
assert.equal(bodies.schema_version,1);assert.equal(bodies.public_filter_enabled,false);
assert.equal(new Set(bodies.records.map(r=>r.family_id)).size,bodies.records.length);
for(const r of bodies.records){
  assert.ok(ids.has(r.family_id));
  for(const key of item.required)assert.ok(typeof r[key]==='string'&&r[key].trim(),`${r.family_id}: ${key}`);
  for(const key of Object.keys(r))assert.ok(key in item.properties);
  assert.ok(item.properties.body_style.enum.includes(r.body_style));
  assert.match(r.reviewed_on,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new URL(r.source_url).protocol,'https:');
  assert.ok(['www.kia.com','www.hyundai.com','www.genesis.com'].includes(new URL(r.source_url).hostname));
}
const hierarchy=read('generated/service-hierarchy-status.json'),calc=read('generated/all-car-calc-status.json'),detail=read('generated/family-detail-coverage-status.json');
assert.equal(families.length,hierarchy.families);assert.equal(hierarchy.active_source_records,4203);assert.equal(hierarchy.issue_count,0);
for(const [key,value] of Object.entries({rows:4203,tax_ready:1715,energy_ready:2703,full_ready:1190,electric:643}))assert.equal(calc[key],value);
assert.equal(detail.official_kea_detail_families,families.length);assert.equal(detail.missing_family_ids.length,0);
for(const p of ['cars/index.html','cars/family/index.html'])assert.match(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),/<meta name="robots" content="noindex,nofollow,noarchive">/);
console.log(`Reviewed media PASS: ${images.records.length} photos, ${bodies.records.length} official body styles; ${families.length} families / 4203 records and noindex preserved`);
