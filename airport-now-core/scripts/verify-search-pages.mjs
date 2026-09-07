import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'_site/airport-now-preview');
const base='https://5ggul.github.io/pm-lab/airport-now-preview/';
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
assert.ok(sitemap.trimStart().startsWith('<?xml'));
const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>x[1]);assert.equal(new Set(urls).size,urls.length);assert.equal(urls.length,43);
const titleSet=new Set(),descriptionSet=new Set();let schemas=0,airports=0;
for(const url of urls){
 assert.ok(url.startsWith(base));const relative=url.slice(base.length),file=path.join(root,relative,'index.html');assert.ok(fs.existsSync(file),url);
 const html=fs.readFileSync(file,'utf8');assert.match(html,/<meta name="robots" content="[^"]*noindex/);
 assert.ok(html.includes('href="'+url+'"'),`canonical: ${url}`);
 for(const legal of ['about','contact','privacy','terms','disclaimer'])assert.ok(new RegExp('href="[^"\\s]*'+legal+'/"').test(html),`${url}: ${legal}`);
 for(const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)){
   const data=JSON.parse(match[1]);assert.equal(data['@context'],'https://schema.org');schemas++;
   for(const node of data['@graph']||[data])if(node['@type']==='BreadcrumbList'){
     node.itemListElement.forEach((item,i)=>{assert.equal(item.position,i+1);assert.ok(item.name);assert.ok(item.item.startsWith(base));});
   }
 }
 if(/^airports\/[^/]+\/$/.test(relative)){
   airports++;const title=html.match(/<title>(.*?)<\/title>/)[1],description=html.match(/<meta name="description" content="(.*?)">/)[1];
   assert.ok(!titleSet.has(title));assert.ok(!descriptionSet.has(description));titleSet.add(title);descriptionSet.add(description);
   assert.ok(html.includes('"Airport"'));assert.ok(!description.includes('검증 스냅샷'));
 }
 // Only inspect local HTML links; query-driven data URLs and external sources are out of scope.
 for(const [,href] of html.matchAll(/href="([^"?#]+)(?:[?#][^"]*)?"/g)){
   if(/^(?:https?:|mailto:|tel:|\/)/.test(href)||!href.endsWith('/'))continue;
   const target=path.resolve(path.dirname(file),href,'index.html');assert.ok(fs.existsSync(target),`broken local link ${relative} -> ${href}`);
 }
}
assert.equal(airports,15);assert.ok(schemas>=32);
const guide=fs.readFileSync(path.join(root,'guide/incheon-arrival-check/index.html'),'utf8');
const article=guide.match(/<article[^>]*>([\s\S]*?)<\/article>/)[1];
assert.ok(article.replace(/<[^>]+>/g,'').length>1000);assert.equal((article.match(/<h3>/g)||[]).length,5);
console.log(JSON.stringify({pages:urls.length,airports,schemas,arrivalFaq:5,checks:'noindex, unique airport metadata, canonical, JSON-LD, footer and local links'}));
