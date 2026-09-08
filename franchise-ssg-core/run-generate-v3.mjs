import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const baseSourcePath=path.join(here,'generate.mjs');
const v2SourcePath=path.join(here,'generate-v2.mjs');
const baseRuntimePath=path.join(here,'.generate-all-runtime.mjs');
const v3RuntimePath=path.join(here,'.generate-v3-runtime.mjs');

let base=await fs.readFile(baseSourcePath,'utf8');
const baseBrands="const brands=PRIORITY_BRAND_NAMES.map(n=>byName.get(n)).filter(Boolean);";
if(!base.includes(baseBrands)) throw new Error('Expected limited brand selection not found in generate.mjs');
base=base.replace(baseBrands,"const brands=[...allBrands];");
const subpageSeed="const subpageBrands=brands.slice(0,20),priorityAreas=areas.slice(0,12);";
const subpageSeedV3="const subpageNames=new Set(['메가MGC커피','컴포즈커피','빽다방','이디야커피','교촌치킨','bhc치킨','BBQ치킨','굽네치킨','맘스터치','프랭크버거']);const subpageBrands=brands.filter(b=>subpageNames.has(b.name)),priorityAreas=areas.slice(0,12);";
if(!base.includes(subpageSeed)) throw new Error('Expected subpage seed selection not found in generate.mjs');
base=base.replace(subpageSeed,subpageSeedV3);
base=base.replaceAll('브랜드 42개','브랜드 ${brands.length}개');
base=base.replaceAll('프랜차이즈 브랜드 42개','프랜차이즈 브랜드 ${brands.length}개');
base=base.replace('검색용 정식 구조를 검수하기 위해 우선 42개 브랜드만 정적 HTML로 출력했습니다. 정식 공개는 공식 데이터 검증을 통과한 브랜드만 허용합니다.','현재 프리뷰 카탈로그 ${brands.length}개 브랜드를 정적 HTML로 출력합니다. 정식 공개는 공식 데이터 검증을 통과한 브랜드만 색인 대상으로 승격합니다.');
await fs.writeFile(baseRuntimePath,base,'utf8');

let source=await fs.readFile(v2SourcePath,'utf8');
const routingImport="import {BRAND_SLUGS,SUBPAGE_PREVIEW_BRANDS,SUBPAGE_QUALITY_RULES,OFFICIAL_LINKS,GUIDE_RELATIONS,TOOL_SLUG_RENAMES} from './routing.mjs';";
const routingImportV3="import {BRAND_SLUGS,SUBPAGE_PREVIEW_BRANDS,SUBPAGE_QUALITY_RULES,OFFICIAL_LINKS,GUIDE_RELATIONS,TOOL_SLUG_RENAMES,brandSlugFor} from './routing-v3.mjs';";
if(!source.includes(routingImport)) throw new Error('Expected routing import not found in generate-v2.mjs');
source=source.replace(routingImport,routingImportV3);
const baseImport="await import(`./generate.mjs?v2=${Date.now()}`);";
if(!source.includes(baseImport)) throw new Error('Expected base generator import not found in generate-v2.mjs');
source=source.replace(baseImport,"await import(`./.generate-all-runtime.mjs?v3=${Date.now()}`);");
const limitedPublished="const publishedBrands=PRIORITY_BRAND_NAMES.map(name=>{const original=originalByName.get(name);if(!original)throw new Error(`Priority brand missing: ${name}`);const slug=BRAND_SLUGS[name];if(!slug)throw new Error(`Permanent slug missing: ${name}`);return {...original,originalSlug:original.slug,slug};});";
const allPublished="const publishedBrands=allBrands.map(original=>({...original,originalSlug:original.slug,slug:brandSlugFor(original.name,original.slug)}));const slugOwner=new Map();for(const b of publishedBrands){if(slugOwner.has(b.slug))throw new Error(`Brand slug collision: ${b.slug} => ${slugOwner.get(b.slug)} / ${b.name}`);slugOwner.set(b.slug,b.name);}for(const name of PRIORITY_BRAND_NAMES)if(!originalByName.has(name))throw new Error(`Priority brand missing: ${name}`);";
if(!source.includes(limitedPublished)) throw new Error('Expected limited published brand selection not found in generate-v2.mjs');
source=source.replace(limitedPublished,allPublished);
const compareBefore="const from=path.join(out,'compare',a.originalSlug,b.originalSlug),to=path.join(out,'compare',a.slug,b.slug);if(await exists(from)){";
const compareAfter="const from=path.join(out,'compare',a.originalSlug,b.originalSlug),to=path.join(out,'compare',a.slug,b.slug);if(from===to)continue;if(await exists(from)){";
if(!source.includes(compareBefore)) throw new Error('Expected compare rename block not found in generate-v2.mjs');
source=source.replace(compareBefore,compareAfter);
await fs.writeFile(v3RuntimePath,source,'utf8');
try{
  await import(`${pathToFileURL(v3RuntimePath).href}?run=${Date.now()}`);
}finally{
  await fs.rm(v3RuntimePath,{force:true});
  await fs.rm(baseRuntimePath,{force:true});
}
