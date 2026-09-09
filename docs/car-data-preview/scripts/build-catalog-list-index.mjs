import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const index=read('data/generated/family-detail-index.json');const families=index.families.map(f=>({family_id:f.family_id,family_name:f.family_name,maker:f.maker,category:f.category,generation_labels:f.generation_labels,vehicle_classes:f.vehicle_classes,full_ready_count:f.full_ready_count,tax_ready_count:f.tax_ready_count,energy_ready_count:f.energy_ready_count,manufacturer_detail:Boolean(f.manufacturer_detail),path:f.static_detail_path||null,powertrains:(f.powertrains||[]).map(p=>({powertrain:p.powertrain,combined_efficiency:p.combined_efficiency}))}));
fs.writeFileSync(path.join(root,'data/generated/catalog-list-index.json'),JSON.stringify({schema_version:1,family_count:families.length,families})+'\n');
console.log(`Compact catalog: ${families.length} families`);
