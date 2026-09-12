import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {pageUrl,siteConfig} from './site-config.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const pages=[];function walk(d){for(const x of fs.readdirSync(d,{withFileTypes:true})){if(['assets','data','scripts'].includes(x.name))continue;const f=path.join(d,x.name);if(x.isDirectory())walk(f);else if(x.name.endsWith('.html'))pages.push(f)}}walk(root);
const failures=[];let checked=0;const excludedPrefixes=['qa/','search/','cars/family/','cars/record/'];
const candidates=[];
for(const file of pages){const rel=path.relative(root,file).replaceAll('\\','/'),html=fs.readFileSync(file,'utf8'),url='https://audit.invalid/'+rel;
 assert.match(html,/<meta[^>]+name="robots"[^>]+noindex/i,rel+' must remain preview noindex');
 assert.equal(siteConfig.indexingEnabled,false);
 assert.deepEqual([...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)].map(m=>m[1]),[pageUrl(rel)],rel+' canonical configuration');
 for(const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>JSON.parse(match[1]),rel+' structured data JSON');
 const refs=[...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map(m=>m[1]);
 for(const m of html.matchAll(/\bsrcset="([^"]+)"/g))refs.push(...m[1].split(',').map(s=>s.trim().split(/\s+/)[0]));
 for(const raw of refs){const ref=raw.replaceAll('&amp;','&');if(/^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/.test(ref)||ref.includes('${'))continue;let u;try{u=new URL(ref,url)}catch{failures.push({rel,ref,error:'invalid URL'});continue}
 let target=path.join(root,decodeURIComponent(u.pathname));if(u.pathname.endsWith('/'))target=path.join(target,'index.html');checked++;
 if(!fs.existsSync(target)){failures.push({rel,ref,error:'missing file'});continue}
 if(u.hash&&target.endsWith('.html')){const id=decodeURIComponent(u.hash.slice(1)),s=fs.readFileSync(target,'utf8');if(id&&!s.includes('id="'+id+'"')&&!s.includes("id='"+id+"'")&&!s.includes('name="'+id+'"'))failures.push({rel,ref,error:'missing anchor'})}
 }
 const route='/'+rel.replace(/index\.html$/,'');let reason=null,status='review_candidate';
 if(/<meta\b[^>]*http-equiv="refresh"/i.test(html)){status='redirect';reason='Compatibility redirect'}
 else if(excludedPrefixes.some(p=>rel.startsWith(p))||rel==='qa.html'||rel==='404.html'){status='excluded';reason='Internal or query-based navigation'}
 else if(['cars/hyundai/grandeur-gn7/3-5/index.html','cars/hyundai/grandeur-gn7/3-5/automobile-tax/index.html','cars/hyundai/grandeur-gn7/compare/index.html'].includes(rel)){status='excluded';reason='Navigation-only compatibility route'}
 candidates.push({path:route,status,reason:reason||'Static content passed the local release checks; production URL review remains'});
}
assert.deepEqual(failures,[],'Broken internal references');
const manifest=read('data/vehicle-image-sources.json');let sourceBytes=0;const totals={};let imageFiles=0;
for(const r of manifest.records){assert(r.image_url&&r.source_page&&r.author&&r.license&&r.license_url);assert(r.optimized?.source_sha256);sourceBytes+=r.optimized.source_bytes;
 for(const f of r.optimized.files){const bytes=fs.readFileSync(path.join(root,f.path));assert.equal(bytes.length,f.bytes,f.path);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),f.sha256,f.path);assert.equal(bytes.subarray(8,12).toString(),'WEBP');totals[f.width]=(totals[f.width]||0)+bytes.length;imageFiles++}
}
const full=read('data/generated/family-detail-index.json'),small=read('data/generated/catalog-list-index.json');assert.equal(small.families.length,full.families.length);assert.equal(small.family_count,full.families.length);assert.deepEqual(small.families.map(f=>f.family_id),full.families.map(f=>f.family_id));
for(const [i,f] of small.families.entries())for(const [key,value] of Object.entries(f)){const expected=key==='manufacturer_detail'?Boolean(full.families[i][key]):key==='powertrains'?(full.families[i].powertrains||[]).map(p=>({powertrain:p.powertrain,combined_efficiency:p.combined_efficiency})):key==='path'?(full.families[i].static_detail_path||null):full.families[i][key];assert.deepEqual(value,JSON.parse(JSON.stringify(expected)),`${f.family_id} ${key}`)}
const report={schema_version:2,production_origin:null,indexing_enabled:false,notes:'Candidate inventory only. Not an indexing instruction or approval prediction.',pages:candidates.sort((a,b)=>a.path.localeCompare(b.path))};
fs.writeFileSync(path.join(root,'data/release-candidates.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pages:pages.length,internal_references:checked,broken:failures.length,review_candidates:candidates.filter(p=>p.status==='review_candidate').length,excluded:candidates.filter(p=>p.status==='excluded').length,redirects:candidates.filter(p=>p.status==='redirect').length,photos:manifest.records.length,image_files:imageFiles,original_bytes:sourceBytes,webp_bytes_by_width:totals,catalog_bytes:{before:fs.statSync(path.join(root,'data/generated/family-detail-index.json')).size,after:fs.statSync(path.join(root,'data/generated/catalog-list-index.json')).size}},null,2));
