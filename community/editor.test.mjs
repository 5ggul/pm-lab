// Browser interaction tests use a mocked API; database authorization is tested separately.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});
const user='00000000-0000-4000-8000-000000000001';
let png;
const results=[];
try{for(const width of [375,390,768,1280]){
 const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let posts=[],uploads=0,removed=0,requests=[];
 await page.route('**/community/config.json',r=>r.fulfill({json:{url:'https://community.test',key:'test-public-key'}}));
 await page.addInitScript(({user})=>{localStorage.setItem('sb-community-auth-token',JSON.stringify({access_token:'test-session',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:user,email:'test@example.invalid',aud:'authenticated'}}));},{user});
 await page.route('https://community.test/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  const reply=json=>route.fulfill({json,headers:{'Access-Control-Allow-Origin':'*'}});
  if(path.includes('/auth/'))return reply({id:user});
  if(path.includes('pmc_profiles'))return reply({nickname:'검수계정'});
  if(path.includes('/rpc/pmc_write')){const{action,payload}=request.postDataJSON();requests.push({action,payload});if(action==='create_post'){const p={...payload,id:crypto.randomUUID(),photo_paths:payload.photos,author_id:user,author_nickname:'검수계정',created_at:new Date().toISOString()};posts.push(p);return reply(p.id);}if(action==='edit_post'){const p=posts.find(p=>p.id===payload.id);Object.assign(p,payload,{photo_paths:payload.photos});return reply(p.id);}return reply(null);}
  if(path.includes('pmc_posts')){const id=url.searchParams.get('id');let found=id?posts.filter(p=>'eq.'+p.id===id):posts.filter(p=>'eq.'+p.kind===url.searchParams.get('kind'));return reply(id?found[0]||null:found);}
  if(path.includes('pmc_comments'))return reply([]);
  if(path.includes('/storage/')){if(request.method()==='DELETE'){removed++;return reply([]);}if(path.includes('/sign/')&&request.method()==='POST')return reply({signedURL:'/object/sign/pmc-post-images/test.webp?token=test'});if(request.method()==='GET')return route.fulfill({contentType:'image/png',body:png});uploads++;return reply({Key:'test'});}
  return route.fulfill({status:404,json:{message:'Unmocked '+path}});
 });
 await page.goto('http://127.0.0.1:4190/community/');await page.getByText('검수계정',{exact:true}).waitFor();png=await page.screenshot({clip:{x:0,y:0,width:64,height:64}});
 await page.locator('#vehicleQuery').fill('쏘렌토');await page.getByRole('button',{name:'기아 쏘렌토',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('vehicle'),'kia-sorento');
 await page.getByRole('button',{name:'선택 해제'}).click();
 assert.equal(await page.locator('.board-tabs button').count(),3);
 await page.getByRole('button',{name:'글쓰기',exact:true}).click();
 assert.equal(await page.locator('#postForm [name=vehicle_id]').count(),0);
 await page.locator('#postForm [name=title]').fill('차종 없는 자유게시판 글');await page.locator('#postForm [name=body]').fill('사진 첨부와 차량 선택 없는 글쓰기를 검수합니다.');
 await page.locator('#postPhotos').setInputFiles({name:'not-image.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await page.getByText('JPG, PNG, WebP 사진만 첨부할 수 있습니다.').waitFor();
 await page.locator('#postPhotos').setInputFiles({name:'test.png',mimeType:'image/png',buffer:png});await page.locator('#photoPreviews img').waitFor();await page.waitForFunction(()=>!document.querySelector('#postPhotos').disabled);
 assert.equal(await page.locator('#photoPreviews li').count(),1);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert(overflow<=0);
 await page.screenshot({path:fileURLToPath(new URL('../output/community-qa/editor-'+width+'.png',import.meta.url)),fullPage:true});
 await page.getByRole('button',{name:'등록하기',exact:true}).click();await page.locator('.post-photos img').waitFor();await page.waitForFunction(()=>document.querySelector('.post-photos img')?.naturalWidth>0);
 assert.equal(uploads,1);assert.equal(requests[0].payload.kind,'free');assert(!('vehicle_id' in requests[0].payload));assert.equal(requests[0].payload.photos.length,1);
 await page.locator('#postActions').getByRole('button',{name:'수정',exact:true}).click();await page.getByRole('button',{name:'사진 삭제',exact:true}).click();await page.getByRole('button',{name:'등록하기',exact:true}).click();await page.locator('#editor').waitFor({state:'hidden'});assert.equal(requests.at(-1).payload.photos.length,0);assert.equal(removed,1);
 assert.deepEqual(errors,[]);results.push({width,overflow,photoUpload:true,photoRemoval:true,noVehicleRequired:true,errors});await page.close();
}}finally{await browser.close();}
fs.writeFileSync(new URL('../output/community-qa/editor.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
