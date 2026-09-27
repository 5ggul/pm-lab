import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const base=process.env.PEEKMYCAR_CHECK_ORIGIN||'https://peekmycar.pages.dev';
const root=new URL('../../../build/peekmycar-production/',import.meta.url);
const expected=JSON.parse(fs.readFileSync(new URL('review-build.json',root),'utf8'));
async function request(route,redirect='follow'){
 const response=await fetch(new URL(route,base),{redirect,signal:AbortSignal.timeout(30000)});
 return response;
}
// Retry only while the new deployment propagates; never accept a different release.
let manifest;
for(let attempt=0;attempt<6;attempt++){
 const response=await request('/review-build.json');
 if(response.ok){manifest=await response.json();if(manifest.homeSha256===expected.homeSha256&&manifest.sha===expected.sha)break;}
 if(attempt<5)await new Promise(resolve=>setTimeout(resolve,10000));
}
assert.equal(manifest?.homeSha256,expected.homeSha256,'Published homepage does not match verified bundle');
assert.equal(manifest?.sha,expected.sha,'Published source revision mismatch');
const homeResponse=await request('/');assert.equal(homeResponse.status,200);
const home=await homeResponse.text();
assert.equal(createHash('sha256').update(home).digest('hex'),expected.homeSha256,'Served homepage differs from bundle');
assert(home.includes('cf3JAkkg0CRbxH3Ca-2oeZ_WvRRadX4wc9TsQHBYwKc'));
assert(home.includes('880621f4f133970ab62d9be0a296e5c6dbb77a57'));
assert(home.includes('content="index,follow,max-image-preview:large"'));
if(new URL(base).hostname.endsWith('.pages.dev'))assert(homeResponse.headers.get('x-robots-tag')?.includes('noindex'));
else assert(!homeResponse.headers.get('x-robots-tag')?.includes('noindex'),'Production home must be indexable');
for(const route of ['/cars/','/compare/','/tools/annual-cost/','/rankings/','/recalls/','/community/','/assets/brand/favicon-96.png','/sitemap.xml','/robots.txt']){
 const response=await request(route);assert.equal(response.status,200,route);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff',route);
 if(route==='/community/'){assert(response.headers.get('x-robots-tag')?.includes('noindex'));assert(response.headers.get('cache-control')?.includes('no-store'));}
}
for(const route of ['/docs/car-data-preview/cars/','/car-data-preview/cars/']){
 const response=await request(route,'manual');assert.equal(response.status,301,route);assert.equal(new URL(response.headers.get('location'),base).pathname,'/cars/');
}
const missing=await request('/cars/not-a-car/deep/');assert.equal(missing.status,404);assert((await missing.text()).includes('페이지를 찾을 수 없습니다'));
const fuel=await request('/data/fuel-price.json');assert.equal(fuel.status,200);assert(fuel.headers.get('cache-control')?.includes('must-revalidate'));
assert.equal((await fuel.json()).price_as_of,expected.fuelDate);
console.log(JSON.stringify({origin:base,sha:manifest.sha,fuelDate:manifest.fuelDate,checks:'headers, routes, robots, verification tags, artifact parity',failures:0}));
