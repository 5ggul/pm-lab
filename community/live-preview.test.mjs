import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.COMMUNITY_REVIEW_ORIGIN||'https://peekmycar-community-review.vercel.app';
const config=await(await fetch(origin+'/community/config.json')).json();
assert(config.url&&config.key);
const http=[];
for(const route of ['/','/community/','/cars/','/compare/','/tools/annual-cost/','/review-build.json']){
 const r=await fetch(origin+route);assert.equal(r.status,200,route);assert(r.headers.get('x-robots-tag')?.includes('noindex'),route);const body=await r.text();if(route.endsWith('/'))assert(/name="robots" content="noindex/.test(body),route);http.push({route,status:r.status,noindex:true});
}
const api=async(path,options={})=>fetch(config.url+'/rest/v1/'+path,{...options,headers:{apikey:config.key,'Content-Type':'application/json',...options.headers}});
const publicRead=await api('pmc_posts?select=id&limit=1');assert.equal(publicRead.status,200);
for(const table of ['pmc_profiles','pmc_reports']){const r=await api(table+'?select=*&limit=1');assert([401,403].includes(r.status),table);}
const noWrite=await api('rpc/pmc_write',{method:'POST',body:JSON.stringify({action:'profile',payload:{nickname:'unauthorized-test'}})});assert([401,403].includes(noWrite.status));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});const ui=[];
try{
 for(const width of [375,390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/community/');await page.getByText('아직 등록된 글이 없습니다. 첫 질문이나 후기를 남겨주세요.').waitFor();
  assert(await page.locator('#login').isEnabled());assert(await page.locator('#writePost').isEnabled());
  await page.locator('#vehicleQuery').fill('쏘렌토');await page.locator('#vehicleFilter').selectOption('kia-sorento');await page.getByRole('button',{name:'실사용 후기',exact:true}).click();
  await page.getByText('아직 등록된 글이 없습니다. 첫 질문이나 후기를 남겨주세요.').waitFor();
  assert.equal(await page.locator('#boardName').textContent(),'기아 쏘렌토');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert(overflow<=0);assert.deepEqual(errors,[]);
  if(width===1280){await page.getByRole('button',{name:'구글 로그인',exact:true}).click();await page.waitForURL(/accounts\.google\.com/);ui.push({width,overflow,errors,googleAuthorization:'opened',oauthReturn:'requires user sign-in'});}else ui.push({width,overflow,errors});
  await page.close();
 }
}finally{await browser.close();}
const result={http,anonymousPermissions:'public posts read; profiles/reports and write RPC denied',ui};
fs.mkdirSync(new URL('../output/community-qa/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../output/community-qa/live-preview.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
