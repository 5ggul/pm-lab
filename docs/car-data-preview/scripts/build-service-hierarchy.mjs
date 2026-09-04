import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const catalogPath = path.join(root, 'data', 'generated', 'all-car-catalog.json');
const registryPath = path.join(root, 'data', 'vehicle-families.json');
const generationRulesPath = path.join(root, 'data', 'vehicle-generation-rules.json');
const outPath = path.join(root, 'data', 'generated', 'service-hierarchy.json');
const statusPath = path.join(root, 'data', 'generated', 'service-hierarchy-status.json');
const issuesPath = path.join(root, 'data', 'generated', 'service-hierarchy-issues.json');
const HIERARCHY_VERSION = 1;

if (!fs.existsSync(catalogPath)) {
  console.error('Missing complete all-car catalog:', catalogPath);
  process.exit(2);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const generationRules = fs.existsSync(generationRulesPath)
  ? JSON.parse(fs.readFileSync(generationRulesPath, 'utf8'))
  : {rules: []};
const registryById = new Map((registry.families || []).map(f => [f.family_id, f]));
const generationRuleByFamily = new Map((generationRules.rules || []).map(r => [r.family_id, r]));
const generatedAt = new Date().toISOString();

function txt(v) {
  const s = String(v ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  return s && s.toUpperCase() !== 'NULL' ? s : null;
}
function key(v) {
  return String(v ?? '').normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]+/g, '');
}
function stable(prefix, value) {
  return `${prefix}-${crypto.createHash('sha1').update(value).digest('hex').slice(0, 16)}`;
}
function uniq(values) {
  return [...new Set(values.filter(v => v !== null && v !== undefined && String(v).trim() !== ''))];
}
function sortKo(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'ko', {numeric:true, sensitivity:'base'});
}
function patternMatches(pattern, value) {
  try {
    const re = new RegExp(pattern, 'i');
    if (re.test(value)) return true;
    const compactPattern = String(pattern).replace(/\s+/g, '');
    return compactPattern !== pattern && new RegExp(compactPattern, 'i').test(String(value).replace(/\s+/g, ''));
  } catch {
    return false;
  }
}

const BRAND_RULES = [
  ['genesis','제네시스',/(?:제네시스|GENESIS)/i],
  ['hyundai','현대',/(?:현대|HYUNDAI)/i],
  ['kia','기아',/(?:기아|\bKIA\b)/i],
  ['bmw','BMW',/\bBMW\b/i],
  ['mercedes-benz','Mercedes-Benz',/(?:MERCEDES|BENZ|메르세데스|벤츠)/i],
  ['audi','Audi',/(?:\bAUDI\b|아우디)/i],
  ['volkswagen','Volkswagen',/(?:VOLKSWAGEN|폭스바겐)/i],
  ['tesla','Tesla',/(?:\bTESLA\b|테슬라)/i],
  ['toyota','Toyota',/(?:\bTOYOTA\b|토요타)/i],
  ['lexus','Lexus',/(?:\bLEXUS\b|렉서스)/i],
  ['honda','Honda',/(?:\bHONDA\b|혼다)/i],
  ['nissan','Nissan',/(?:\bNISSAN\b|닛산)/i],
  ['infiniti','Infiniti',/(?:INFINITI|인피니티)/i],
  ['porsche','Porsche',/(?:PORSCHE|포르쉐)/i],
  ['volvo','Volvo',/(?:\bVOLVO\b|볼보)/i],
  ['polestar','Polestar',/(?:POLESTAR|폴스타)/i],
  ['land-rover','Land Rover',/(?:LAND\s*ROVER|RANGE\s*ROVER|랜드로버|레인지로버)/i],
  ['jaguar','Jaguar',/(?:JAGUAR|재규어)/i],
  ['mini','MINI',/(?:\bMINI\b|미니)/i],
  ['ford','Ford',/(?:\bFORD\b|포드)/i],
  ['chevrolet','Chevrolet',/(?:CHEVROLET|쉐보레)/i],
  ['cadillac','Cadillac',/(?:CADILLAC|캐딜락)/i],
  ['gmc','GMC',/\bGMC\b/i],
  ['renault-korea','Renault Korea',/(?:RENAULT|르노|르노코리아|삼성자동차|RENAULT\s*SAMSUNG)/i],
  ['kg-mobility','KG Mobility',/(?:KG\s*MOBILITY|KGM|쌍용|SSANGYONG)/i],
  ['jeep','Jeep',/(?:\bJEEP\b|지프)/i],
  ['peugeot','Peugeot',/(?:PEUGEOT|푸조)/i],
  ['citroen','Citroen',/(?:CITROEN|CITROËN|시트로엥)/i],
  ['ds','DS',/(?:\bDS\s*[3479]\b|DS AUTOMOBILES)/i],
  ['fiat','Fiat',/(?:\bFIAT\b|피아트)/i],
  ['maserati','Maserati',/(?:MASERATI|마세라티)/i],
  ['ferrari','Ferrari',/(?:FERRARI|페라리)/i],
  ['lamborghini','Lamborghini',/(?:LAMBORGHINI|람보르기니)/i],
  ['bentley','Bentley',/(?:BENTLEY|벤틀리)/i],
  ['rolls-royce','Rolls-Royce',/(?:ROLLS[- ]?ROYCE|롤스로이스)/i],
  ['mclaren','McLaren',/(?:MCLAREN|맥라렌)/i],
  ['byd','BYD',/(?:\bBYD\b|비야디)/i],
  ['lucid','Lucid',/(?:\bLUCID\b|루시드)/i],
  ['lotus','Lotus',/(?:\bLOTUS\b|로터스)/i],
  ['lincoln','Lincoln',/(?:LINCOLN|링컨)/i],
  ['subaru','Subaru',/(?:SUBARU|스바루)/i],
  ['mitsubishi','Mitsubishi',/(?:MITSUBISHI|미쓰비시|미쓰비씨)/i],
  ['suzuki','Suzuki',/(?:SUZUKI|스즈키)/i]
];

function canonicalMaker(group) {
  const reviewedIds = uniq((group.family_ids || []).filter(id => registryById.has(id)));
  if (reviewedIds.length === 1) {
    const f = registryById.get(reviewedIds[0]);
    return {maker_id:key(f.maker), maker:f.maker, source:'reviewed_registry'};
  }
  const hay = [group.maker, ...(group.source_makers || []), group.model].filter(Boolean).join(' | ');
  for (const [maker_id, maker, re] of BRAND_RULES) {
    if (re.test(hay)) return {maker_id, maker, source:'brand_rule'};
  }
  const raw = txt(group.maker) || txt(group.source_makers?.[0]) || '제조사 미표기';
  const cleaned = raw
    .replace(/주식회사|유한회사|\(주\)|㈜/g, '')
    .replace(/AUTOMOTIVE|AUTOMOBILE|MOTORS?|MOTOR COMPANY|IMPORTS?|KOREA/ig, '')
    .replace(/\s+/g, ' ').trim() || raw;
  return {maker_id:stable('maker', key(cleaned) || raw), maker:cleaned, source:'source_maker'};
}

const familyBrandParsers = {
  'tesla': m => (m.match(/\bMODEL\s*[3YSX]\b/i)?.[0] || null),
  'bmw': m => {
    const s = m.replace(/^BMW\s*/i,'').trim();
    let x = s.match(/\b(iX\d?|i[3457]|XM|X[1-7]|Z4|M[23458])\b/i)?.[1];
    if (x) return x.toUpperCase().replace(/^I/, 'i');
    const n = s.match(/\b([1-8])\d{2}[A-Za-z]*\b/);
    return n ? `${n[1]} Series` : null;
  },
  'mercedes-benz': m => {
    const s = m.replace(/MERCEDES[- ]?BENZ|BENZ/ig,'').trim();
    const long = s.match(/\b(AMG\s+GT|EQA|EQB|EQE|EQS|GLA|GLB|GLC|GLE|GLS|CLA|CLS|CLE|SL)\b/i)?.[1];
    if (long) return long.toUpperCase().replace(/\s+/g,' ');
    const cls = s.match(/\b([ABCESG])\s*[- ]?\d{3}\b/i)?.[1];
    return cls ? `${cls.toUpperCase()}-Class` : null;
  },
  'audi': m => m.match(/\b(RS\s?\d|S\s?\d|A\s?\d|Q\s?\d|E[- ]?TRON\s*GT|E[- ]?TRON)\b/i)?.[1]?.toUpperCase().replace(/\s+/g,'') || null,
  'volkswagen': m => m.match(/\b(ID\.?\s?[3457]|GOLF|TIGUAN|TOUAREG|ARTEON|PASSAT|JETTA|T-ROC)\b/i)?.[1]?.replace(/\s+/g,' ') || null,
  'volvo': m => m.match(/\b(XC40|XC60|XC90|EX30|EX40|EC40|S60|S90|V60|V90|C40)\b/i)?.[1]?.toUpperCase() || null,
  'polestar': m => m.match(/\bPOLESTAR\s*[234]\b/i)?.[0] || null,
  'porsche': m => m.match(/\b(911|718|CAYENNE|MACAN|PANAMERA|TAYCAN)\b/i)?.[1] || null,
  'land-rover': m => {
    const s = m.toUpperCase();
    if (/RANGE\s*ROVER\s*SPORT/.test(s)) return 'Range Rover Sport';
    if (/RANGE\s*ROVER\s*VELAR/.test(s)) return 'Range Rover Velar';
    if (/RANGE\s*ROVER\s*EVOQUE/.test(s)) return 'Range Rover Evoque';
    if (/RANGE\s*ROVER/.test(s)) return 'Range Rover';
    return m.match(/\b(DEFENDER|DISCOVERY\s*SPORT|DISCOVERY)\b/i)?.[1] || null;
  },
  'mini': m => m.match(/\b(COUNTRYMAN|ACEMAN|COOPER|CLUBMAN)\b/i)?.[1] || null,
  'lexus': m => m.match(/\b(ES|LS|IS|NX|RX|UX|LM|RZ|LC|RC|GX|LX)\s*\d{0,3}\b/i)?.[1]?.toUpperCase() || null,
  'toyota': m => m.match(/\b(CAMRY|RAV4|PRIUS|CROWN|SIENNA|HIGHLANDER|ALPHARD|LAND\s*CRUISER|GR86|SUPRA|COROLLA)\b/i)?.[1] || null,
  'honda': m => m.match(/\b(ACCORD|CR-V|CRV|PILOT|ODYSSEY|CIVIC|HR-V|HRV)\b/i)?.[1] || null,
  'ford': m => m.match(/\b(EXPLORER|MUSTANG\s*MACH-E|MUSTANG|BRONCO|RANGER|F-150|ESCAPE)\b/i)?.[1] || null,
  'jeep': m => m.match(/\b(WRANGLER|GRAND\s*CHEROKEE|CHEROKEE|COMPASS|RENEGADE|GLADIATOR|AVENGER)\b/i)?.[1] || null,
  'byd': m => m.match(/\b(ATTO\s*3|SEALION\s*7|SEAL|DOLPHIN)\b/i)?.[1] || null
};

const TECH_PATTERNS = [
  /\b(?:2WD|4WD|AWD|FWD|RWD|FR|FF)\b/ig,
  /\b(?:A\/T|M\/T|AT|MT|DCT|CVT|IVT|AUTOMATIC|MANUAL)\b/ig,
  /\b(?:T-GDI|GDI|MPI|CRDI|CRDI|E-VGT|VGT)\b/ig,
  /\b(?:GASOLINE|PETROL|DIESEL|HYBRID|HEV|PHEV|MHEV|ELECTRIC|BEV|FCEV|LPG)\b/ig,
  /(?:가솔린|휘발유|디젤|경유|하이브리드|플러그인\s*하이브리드|전기차?|수소차?|엘피지)/ig,
  /\b(?:LONG\s*RANGE|STANDARD\s*RANGE|PERFORMANCE|LONGRANGE|STANDARD)\b/ig,
  /(?:롱\s*레인지|스탠다드|퍼포먼스)/ig,
  /\b\d(?:\.\d)?\s*(?:L|T)?\b/ig,
  /\b\d{3,4}\s*CC\b/ig,
  /\b\d{1,2}\s*(?:INCH|IN)\b/ig,
  /\b\d{1,2}\s*(?:SEAT|SEATER)S?\b/ig,
  /\d{1,2}\s*(?:인치|인승)/g,
  /\b(?:PREMIUM|PRESTIGE|SIGNATURE|EXCLUSIVE|NOBLESSE|NOBLESSE\s*SPECIAL|LIMITED|LUXURY|SPORT|SPORTS)\b/ig,
  /(?:프리미엄|프레스티지|시그니처|익스클루시브|노블레스|리미티드|럭셔리)/ig,
  /\b20\d{2}\s*(?:MY|MODEL\s*YEAR)?\b/ig,
  /(?:20\d{2}\s*년형)/g
];

function removeMakerWords(model, maker) {
  let s = model;
  const words = [maker, 'HYUNDAI','KIA','GENESIS','BMW','MERCEDES-BENZ','MERCEDES','BENZ','AUDI','VOLKSWAGEN','TESLA','TOYOTA','LEXUS','HONDA','PORSCHE','VOLVO','FORD','CHEVROLET','RENAULT','JEEP','PEUGEOT','CITROEN','LAND ROVER','JAGUAR','MINI','BYD'];
  for (const word of words.filter(Boolean)) {
    const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    s = s.replace(new RegExp(`^\\s*${escaped}\\s*[-:]?\\s*`, 'i'), '');
  }
  return s.trim();
}
function generationCode(model, familyName='') {
  const upper = String(model).toUpperCase();
  const familyKey = key(familyName).toUpperCase();
  const candidates = [];
  for (const m of upper.matchAll(/\(([A-Z]{1,5}\d{1,3}(?:\s?(?:FL|PE)\d?)?)\)/g)) candidates.push(m[1]);
  for (const m of upper.matchAll(/\b([A-Z]{1,4}\d{1,3}(?:\s?(?:FL|PE)\d?)?)\b/g)) candidates.push(m[1]);
  for (const raw of candidates) {
    const c = raw.replace(/\s+/g,' ').trim();
    if (['2WD','4WD','FWD','RWD'].includes(c)) continue;
    if (key(c).toUpperCase() === familyKey) continue;
    if (/^(EV|K|G|GV|Q|A|S|X)\d{1,2}$/.test(c) && familyKey.includes(key(c).toUpperCase())) continue;
    return c;
  }
  return null;
}
function genericFamilyName(model, maker) {
  let s = removeMakerWords(String(model), maker);
  const code = generationCode(s, '');
  if (code) s = s.replace(new RegExp(String(code).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'ig'), ' ');
  s = s.replace(/\([^)]{0,40}\)/g, ' ');
  for (const re of TECH_PATTERNS) s = s.replace(re, ' ');
  s = s.replace(/[,_/]+/g,' ').replace(/\s+-\s+/g,' ').replace(/\s+/g,' ').trim();
  const tokens = s.split(' ').filter(Boolean);
  while (tokens.length > 1 && /^(?:N|GT|GT-LINE|AMG|M|RS|S-LINE)$/i.test(tokens.at(-1))) tokens.pop();
  if (tokens.length > 4) s = tokens.slice(0,4).join(' ');
  else s = tokens.join(' ');
  return s.trim();
}
function deriveFamily(group, makerInfo) {
  const reviewedIds = uniq((group.family_ids || []).filter(id => registryById.has(id)));
  if (reviewedIds.length === 1) {
    const f = registryById.get(reviewedIds[0]);
    return {family_id:f.family_id, family_name:f.display_name, category:f.category || null, normalization_status:'reviewed_override', confidence:1, reviewed_family_id:f.family_id};
  }
  if (reviewedIds.length > 1) {
    return {family_id:stable('family', `${makerInfo.maker_id}|${key(group.model)}`), family_name:txt(group.model) || '모델명 미표기', category:null, normalization_status:'raw_only', confidence:0.2, reviewed_family_id:null, issue:'multiple_reviewed_family_ids'};
  }
  const parser = familyBrandParsers[makerInfo.maker_id];
  const parsed = parser ? txt(parser(String(group.model || ''))) : null;
  if (parsed) return {family_id:stable('family', `${makerInfo.maker_id}|${key(parsed)}`), family_name:parsed, category:null, normalization_status:'auto_high', confidence:0.9, reviewed_family_id:null};
  const generic = txt(genericFamilyName(group.model || '', makerInfo.maker));
  const original = txt(group.model) || '모델명 미표기';
  if (generic && key(generic) && key(generic) !== key(original) && generic.length >= 2) {
    return {family_id:stable('family', `${makerInfo.maker_id}|${key(generic)}`), family_name:generic, category:null, normalization_status:'auto_medium', confidence:0.65, reviewed_family_id:null};
  }
  return {family_id:stable('family', `${makerInfo.maker_id}|${key(original)}`), family_name:original, category:null, normalization_status:'raw_only', confidence:0.35, reviewed_family_id:null};
}
function classifyPowertrain(record) {
  const s = `${record.type || ''} ${record.model || ''}`.toUpperCase();
  if (/수소|FCEV|HYDROGEN/.test(s)) return {key:'hydrogen', label:'수소'};
  if (/PHEV|PLUG[- ]?IN|플러그인/.test(s)) return {key:'phev', label:'플러그인 하이브리드'};
  if (/하이브리드|HYBRID|\bHEV\b/.test(s)) return {key:'hybrid', label:'하이브리드'};
  if (/전기|ELECTRIC|\bBEV\b|\bEV\b/.test(s)) return {key:'electric', label:'전기'};
  if (/LPG|엘피지/.test(s)) return {key:'lpg', label:'LPG'};
  if (/경유|디젤|DIESEL/.test(s)) return {key:'diesel', label:'경유'};
  if (/휘발유|가솔린|GASOLINE|PETROL/.test(s)) return {key:'gasoline', label:'휘발유'};
  return {key:'unknown', label:txt(record.type) || '유형 미표기'};
}
function detectDrive(model) {
  return String(model || '').toUpperCase().match(/\b(AWD|4WD|2WD|FWD|RWD)\b/)?.[1] || null;
}
function detectWheel(model) {
  const m = String(model || '').match(/\b(1[4-9]|2[0-4])\s*(?:인치|INCH|IN\b|\")/i);
  return m ? Number(m[1]) : null;
}
function detectSeats(model) {
  const m = String(model || '').match(/\b([2-9])\s*(?:인승|SEAT|SEATER)/i);
  return m ? Number(m[1]) : null;
}
function calculatorReady(record, powertrainKey) {
  if (powertrainKey === 'electric') return Number(record.combined_efficiency) > 0;
  if (['gasoline','diesel','lpg','hybrid','phev'].includes(powertrainKey)) return Number(record.displacement_cc) > 0 && Number(record.combined_efficiency) > 0;
  return false;
}
function reviewedGeneration(group, family) {
  if (!family.reviewed_family_id) return null;
  const rule = generationRuleByFamily.get(family.reviewed_family_id);
  if (!rule) return null;
  if ((rule.patterns || []).some(pattern => patternMatches(pattern, String(group.model || '')))) {
    return {generation_label:rule.generation_label, generation_code:generationCode(group.model, family.family_name), source:'reviewed_rule', confidence:1};
  }
  return null;
}
function deriveGeneration(group, family) {
  const reviewed = reviewedGeneration(group, family);
  if (reviewed) return reviewed;
  const code = generationCode(group.model, family.family_name);
  if (code) return {generation_label:code, generation_code:code, source:'source_code', confidence:0.7};
  return {generation_label:'세대 미분류', generation_code:null, source:'unspecified', confidence:0.3};
}

const familyBuckets = new Map();
const makerBuckets = new Map();
const groupIndex = {};
const issues = [];
let activeRecordsAssigned = 0;
let archivedRecordsAssigned = 0;
let calculatorReadyRecords = 0;
let reviewedGroupCount = 0;
let autoHighGroupCount = 0;
let autoMediumGroupCount = 0;
let rawOnlyGroupCount = 0;

for (const group of catalog.groups || []) {
  const makerInfo = canonicalMaker(group);
  const family = deriveFamily(group, makerInfo);
  const generation = deriveGeneration(group, family);
  const familyKey = family.family_id;
  if (!familyBuckets.has(familyKey)) {
    familyBuckets.set(familyKey, {
      family_id:family.family_id,
      maker_id:makerInfo.maker_id,
      maker:makerInfo.maker,
      family_name:family.family_name,
      category:family.category,
      normalization_status:family.normalization_status,
      confidence:family.confidence,
      reviewed_family_id:family.reviewed_family_id,
      source_status:'active',
      raw_group_ids:[],
      raw_models:[],
      raw_makers:[],
      generation_map:new Map(),
      powertrain_counts:new Map(),
      record_count:0,
      active_record_count:0,
      archived_record_count:0,
      calculator_ready_record_count:0,
      reviewed_detail_paths:new Set()
    });
  }
  const fb = familyBuckets.get(familyKey);
  if (fb.maker_id !== makerInfo.maker_id) {
    issues.push({type:'family_maker_collision', family_id:familyKey, existing_maker:fb.maker, incoming_maker:makerInfo.maker, catalog_id:group.catalog_id, model:group.model});
  }
  fb.raw_group_ids.push(group.catalog_id);
  fb.raw_models.push(group.model);
  fb.raw_makers.push(...(group.source_makers || []), group.maker);
  if (group.reviewed_detail_path) fb.reviewed_detail_paths.add(group.reviewed_detail_path);
  if (group.source_status !== 'active') fb.source_status = fb.source_status === 'active' ? 'mixed' : group.source_status;
  const generationKey = `${familyKey}|${key(generation.generation_label) || 'unspecified'}`;
  if (!fb.generation_map.has(generationKey)) {
    fb.generation_map.set(generationKey, {
      generation_id:stable('gen', generationKey),
      family_id:familyKey,
      generation_label:generation.generation_label,
      generation_code:generation.generation_code,
      normalization_source:generation.source,
      confidence:generation.confidence,
      raw_group_ids:[],
      raw_models:[],
      record_count:0,
      active_record_count:0,
      powertrain_counts:new Map(),
      calculator_ready_record_count:0
    });
  }
  const gb = fb.generation_map.get(generationKey);
  gb.raw_group_ids.push(group.catalog_id);
  gb.raw_models.push(group.model);
  let groupCalc = 0;
  const groupPowertrains = new Set();
  for (const record of group.records || []) {
    const pt = classifyPowertrain(record);
    groupPowertrains.add(pt.key);
    fb.powertrain_counts.set(pt.key, (fb.powertrain_counts.get(pt.key) || 0) + 1);
    gb.powertrain_counts.set(pt.key, (gb.powertrain_counts.get(pt.key) || 0) + 1);
    fb.record_count++;
    gb.record_count++;
    if (group.source_status === 'active') {
      fb.active_record_count++;
      gb.active_record_count++;
      activeRecordsAssigned++;
    } else {
      fb.archived_record_count++;
      archivedRecordsAssigned++;
    }
    if (calculatorReady(record, pt.key)) {
      fb.calculator_ready_record_count++;
      gb.calculator_ready_record_count++;
      calculatorReadyRecords++;
      groupCalc++;
    }
  }
  groupIndex[group.catalog_id] = {
    catalog_id:group.catalog_id,
    maker_id:makerInfo.maker_id,
    maker:makerInfo.maker,
    family_id:familyKey,
    family_name:family.family_name,
    generation_id:gb.generation_id,
    generation_label:gb.generation_label,
    normalization_status:family.normalization_status,
    confidence:family.confidence,
    powertrains:[...groupPowertrains],
    calculator_ready_records:groupCalc,
    source_status:group.source_status
  };
  if (family.issue) issues.push({type:family.issue, catalog_id:group.catalog_id, maker:group.maker, model:group.model, family_ids:group.family_ids || []});
  if (family.normalization_status === 'reviewed_override') reviewedGroupCount++;
  else if (family.normalization_status === 'auto_high') autoHighGroupCount++;
  else if (family.normalization_status === 'auto_medium') autoMediumGroupCount++;
  else rawOnlyGroupCount++;
}

const families = [...familyBuckets.values()].map(f => ({
  family_id:f.family_id,
  maker_id:f.maker_id,
  maker:f.maker,
  family_name:f.family_name,
  category:f.category,
  normalization_status:f.normalization_status,
  confidence:f.confidence,
  reviewed_family_id:f.reviewed_family_id,
  source_status:f.source_status,
  raw_group_count:f.raw_group_ids.length,
  raw_group_ids:uniq(f.raw_group_ids),
  raw_models:uniq(f.raw_models).sort(sortKo).slice(0,60),
  raw_makers:uniq(f.raw_makers).sort(sortKo),
  generation_count:f.generation_map.size,
  generations:[...f.generation_map.values()].map(g => ({
    generation_id:g.generation_id,
    family_id:g.family_id,
    generation_label:g.generation_label,
    generation_code:g.generation_code,
    normalization_source:g.normalization_source,
    confidence:g.confidence,
    raw_group_count:g.raw_group_ids.length,
    raw_group_ids:uniq(g.raw_group_ids),
    raw_models:uniq(g.raw_models).sort(sortKo).slice(0,60),
    record_count:g.record_count,
    active_record_count:g.active_record_count,
    calculator_ready_record_count:g.calculator_ready_record_count,
    powertrains:[...g.powertrain_counts.entries()].map(([powertrain,count]) => ({powertrain,count})).sort((a,b)=>b.count-a.count || sortKo(a.powertrain,b.powertrain))
  })).sort((a,b) => (a.generation_label === '세대 미분류') - (b.generation_label === '세대 미분류') || sortKo(a.generation_label,b.generation_label)),
  powertrains:[...f.powertrain_counts.entries()].map(([powertrain,count]) => ({powertrain,count})).sort((a,b)=>b.count-a.count || sortKo(a.powertrain,b.powertrain)),
  record_count:f.record_count,
  active_record_count:f.active_record_count,
  archived_record_count:f.archived_record_count,
  calculator_ready_record_count:f.calculator_ready_record_count,
  reviewed_detail_paths:[...f.reviewed_detail_paths]
})).sort((a,b)=>sortKo(a.maker,b.maker)||sortKo(a.family_name,b.family_name));

for (const family of families) {
  if (!makerBuckets.has(family.maker_id)) makerBuckets.set(family.maker_id, {maker_id:family.maker_id, maker:family.maker, family_ids:[], active_family_count:0, active_record_count:0});
  const mb = makerBuckets.get(family.maker_id);
  mb.family_ids.push(family.family_id);
  if (family.active_record_count > 0) mb.active_family_count++;
  mb.active_record_count += family.active_record_count;
}
const makers = [...makerBuckets.values()].map(m => ({...m, family_count:m.family_ids.length})).sort((a,b)=>b.active_record_count-a.active_record_count||sortKo(a.maker,b.maker));
const activeFamilies = families.filter(f => f.active_record_count > 0);
const generationCount = activeFamilies.reduce((n,f)=>n+f.generations.filter(g=>g.active_record_count>0).length,0);
const reviewedFamilies = activeFamilies.filter(f=>f.normalization_status==='reviewed_override').length;
const highFamilies = activeFamilies.filter(f=>f.normalization_status==='auto_high').length;
const mediumFamilies = activeFamilies.filter(f=>f.normalization_status==='auto_medium').length;
const rawFamilies = activeFamilies.filter(f=>f.normalization_status==='raw_only').length;
const activeGroupCount = Object.values(groupIndex).filter(g=>g.source_status==='active').length;

const output = {
  schema_version:1,
  hierarchy_version:HIERARCHY_VERSION,
  generated_at:generatedAt,
  source_generated_at:catalog.generated_at || null,
  source_fetched_at:catalog.source_fetched_at || null,
  source_active_group_count:catalog.active_group_count,
  source_active_record_count:catalog.active_record_count,
  active_maker_count:makers.filter(m=>m.active_record_count>0).length,
  active_family_count:activeFamilies.length,
  active_generation_count:generationCount,
  calculator_ready_record_count:calculatorReadyRecords,
  normalization:{reviewed_families:reviewedFamilies,auto_high_families:highFamilies,auto_medium_families:mediumFamilies,raw_only_families:rawFamilies,reviewed_groups:reviewedGroupCount,auto_high_groups:autoHighGroupCount,auto_medium_groups:autoMediumGroupCount,raw_only_groups:rawOnlyGroupCount},
  policy:'Every KEA source record remains represented exactly once. Reviewed family rules override automatic parsing. Automatic parsing never creates indexable SEO pages; low-confidence rows remain searchable as raw_only until reviewed.',
  makers,
  families,
  group_index:groupIndex
};
const status = {
  ok:true,
  hierarchy_version:HIERARCHY_VERSION,
  generated_at:generatedAt,
  active_source_groups:catalog.active_group_count,
  active_source_records:catalog.active_record_count,
  assigned_active_groups:activeGroupCount,
  assigned_active_records:activeRecordsAssigned,
  archived_records:archivedRecordsAssigned,
  makers:output.active_maker_count,
  families:output.active_family_count,
  generations:output.active_generation_count,
  calculator_ready_records:calculatorReadyRecords,
  reviewed_families:reviewedFamilies,
  auto_high_families:highFamilies,
  auto_medium_families:mediumFamilies,
  raw_only_families:rawFamilies,
  issue_count:issues.length
};

fs.mkdirSync(path.dirname(outPath), {recursive:true});
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
fs.writeFileSync(statusPath, JSON.stringify(status, null, 2) + '\n');
fs.writeFileSync(issuesPath, JSON.stringify({schema_version:1,generated_at:generatedAt,issue_count:issues.length,issues:issues.slice(0,2000)}, null, 2) + '\n');
console.log(`Service hierarchy: ${status.makers} makers / ${status.families} families / ${status.generations} generations / ${status.assigned_active_records}/${status.active_source_records} active rows / calc-ready ${status.calculator_ready_records} / raw-only families ${status.raw_only_families}`);
