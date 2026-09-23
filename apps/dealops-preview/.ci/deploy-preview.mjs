import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomBytes, publicEncrypt, createCipheriv, constants, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root=new URL('.',import.meta.url),art=new URL('receipt/',root);
await mkdir(art,{recursive:true});
const publicKey=await readFile(new URL('receipt-public.pem',root),'utf8');
const receipt={version:'0.6.1',startedAt:new Date().toISOString(),checks:[],status:'starting'};
const sensitive=[];
function redact(v){let s=String(v);for(const x of sensitive)if(x)s=s.split(x).join('[PRIVATE]');return s.replace(/https:\/\/dash\.cloudflare\.com\/claim-preview[^\s"<>]*/g,'[PRIVATE_CLAIM_LINK]');}
async function save(){const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const ciphertext=Buffer.concat([cipher.update(JSON.stringify(receipt),'utf8'),cipher.final()]);const enc=publicEncrypt({key:publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key);await writeFile(new URL('private.enc.json',art),JSON.stringify({version:1,key:enc.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}));await writeFile(new URL('public.json',art),JSON.stringify({version:receipt.version,status:receipt.status,url:receipt.url||null,expiresAt:receipt.provisioning?.claim?.expiresAt||null,checks:receipt.checks,error:receipt.error?redact(receipt.error):null},null,2));}
function command(name,args,extraEnv={}){const p=spawnSync(name,args,{encoding:'utf8',env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',...extraEnv},timeout:300000,maxBuffer:8*1024*1024});if(p.status!==0){receipt.commandFailure={name,args,stdout:p.stdout,stderr:p.stderr,error:p.error?.message};throw Error(name+' failed: '+redact((p.stderr||p.stdout||p.error?.message||'').slice(-2500)));}return p.stdout;}
let bearer='';
async function api(route,data,method){const r=await fetch('https://api.cloudflare.com/client/v4'+route,{method:method||(data===undefined?'GET':'POST'),headers:{'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(60000)});const text=await r.text();let b;try{b=JSON.parse(text)}catch{throw Error('Cloudflare '+route+' returned HTTP '+r.status+' non-JSON');}if(!r.ok||b.success!==true)throw Error('Cloudflare '+route+' HTTP '+r.status+' '+JSON.stringify(b.errors||[]).slice(0,2000));return b.result;}
function check(name,fn){return Promise.resolve().then(fn).then(()=>{receipt.checks.push({name,ok:true});console.log('PASS '+name);},e=>{receipt.checks.push({name,ok:false,message:redact(e.message)});throw e;});}
let account,dbid;
async function sql(statement){return api(`/accounts/${account}/d1/database/${dbid}/query`,{sql:statement});}
try{
  console.log('Installing pinned Wrangler and building isolated source.');
  command('npm',['install','--no-audit','--no-fund']);
  command('npm',['run','build:cloudflare']);
  command('node',['--test','tests/cloudflare.test.mjs']);
  receipt.checks.push({name:'Cloudflare contract tests',ok:true,count:32});
  command('npx',['wrangler','deploy','--dry-run','--outdir','.bundle']);
  receipt.checks.push({name:'Wrangler deploy dry-run',ok:true});
  console.log('Build passed. Requesting official temporary preview.');
  const ch=await api('/provisioning/previews/challenge',{});
  const seed=Buffer.from(ch.seed,'base64url');
  assert.equal(seed.length,32);assert.ok(Number.isInteger(ch.k)&&ch.k>0&&Number.isInteger(ch.g)&&ch.g>0&&ch.k*ch.g<=64000000);
  const sha=x=>createHash('sha256').update(x).digest();let h=sha(seed);const checkpoints=[h];
  for(let i=0;i<ch.k;i++){for(let j=0;j<ch.g;j++)h=sha(h);checkpoints.push(h);}
  receipt.provisioning=await api('/provisioning/previews',{termsOfService:'https://www.cloudflare.com/terms/',privacyPolicy:'https://www.cloudflare.com/privacypolicy/',acceptTermsOfService:'yes',challengeToken:ch.challengeToken,solution:{checkpoints:Buffer.concat(checkpoints).toString('base64')}});
  const {account:acc,claim}=receipt.provisioning;assert.ok(acc.id&&acc.apiToken&&acc.expiresAt&&claim.url&&claim.expiresAt);
  account=acc.id;bearer=acc.apiToken;sensitive.push(bearer,claim.token,claim.url);
  receipt.status='provisioned';await save();
  const db=await api(`/accounts/${account}/d1/database`,{name:'dealops-preview',primary_location_hint:'apac'});assert.ok(db.uuid);dbid=db.uuid;receipt.databaseId=dbid;
  for(const migration of ['0001_initial.sql','0002_rate_limits.sql']){const text=await readFile('cloudflare/migrations/'+migration,'utf8');for(const statement of text.split(';').map(x=>x.trim()).filter(Boolean))await sql(statement);}
  receipt.checks.push({name:'Remote D1 migrations',ok:true});
  const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));config.account_id=account;config.d1_databases[0].database_id=dbid;await writeFile('wrangler.jsonc',JSON.stringify(config,null,2));
  receipt.bootstrapToken=randomBytes(32).toString('base64url');sensitive.push(receipt.bootstrapToken);
  const env={CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:bearer};
  console.log('Deploying new Worker and new D1 only.');
  receipt.deployLog=command('npx',['wrangler','deploy'],env);
  await api(`/accounts/${account}/workers/scripts/dealops-preview/secrets`,{name:'BOOTSTRAP_TOKEN',text:receipt.bootstrapToken,type:'secret_text'},'PUT');
  const sub=await api(`/accounts/${account}/workers/subdomain`);assert.ok(sub.subdomain);
  receipt.url=`https://dealops-preview.${sub.subdomain}.workers.dev`;receipt.status='deployed';await save();console.log('PREVIEW '+receipt.url);
  let cookie='',csrf='';
  async function req(path,payload,extra={}){const r=await fetch(receipt.url+path,{method:payload===undefined?'GET':'POST',headers:{...(cookie?{Cookie:cookie}:{}),...(payload===undefined?{}:{Origin:receipt.url,'Content-Type':'application/json','X-Dealops-Client':'studio-v2','X-CSRF-Token':csrf}),...extra},...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(30000)});const txt=await r.text();let data;try{data=JSON.parse(txt)}catch{data={text:txt.slice(0,300)}}return{r,data};}
  function accept(x){cookie=x.r.headers.get('set-cookie')?.split(';')[0]||cookie;csrf=x.data.csrf||csrf;}
  const password=randomBytes(28).toString('base64url');sensitive.push(password);
  await check('HTTPS health and D1',async()=>{let x;for(let i=0;i<6;i++){try{x=await req('/api/healthz');if(x.r.status===200)break;}catch{}await new Promise(r=>setTimeout(r,3000));}assert.equal(x?.r.status,200);assert.equal(x.data.storage,'cloudflare-d1');});
  await check('Actual-input workspace requires login',async()=>assert.equal((await req('/api/workspaces/local')).r.status,401));
  let state,offer;
  try{
    await check('Administrator setup with browser token payload',async()=>{const x=await req('/api/auth/setup',{token:receipt.bootstrapToken,email:'qa-fixture@example.com',password});assert.equal(x.r.status,200,JSON.stringify(x.data));assert.match(x.r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict; Secure/);accept(x);});
    await check('Authenticated session persists',async()=>{const x=await req('/api/session');assert.equal(x.data.authenticated,true);assert.equal(x.data.integrations.ai.configured,false);});
    await check('Real workspace empty / demo workspace separate',async()=>{assert.equal((await req('/api/workspaces/local')).data.store.offers.length,0);state=(await req('/api/workspaces/demo')).data;offer=state.store.offers.find(x=>x.state==='NEW'&&x.sourceChecked);assert.ok(offer?.sample);});
    async function cmd(action,payload){const x=await req('/api/workspaces/demo/command',{expectedRevision:state.revision,action,payload,key:randomUUID()});if(x.r.status===200)state=x.data;return x;}
    await check('CSRF rejects writes',async()=>assert.equal((await req('/api/auth/logout',{}, {'X-CSRF-Token':'bad'})).r.status,403));
    await check('Unapproved item cannot be prepared',async()=>assert.equal((await cmd('prepare',{id:offer.id})).r.status,400));
    await check('Draft, approve, copy-ready not auto-posted',async()=>{for(const action of ['draft','approve','prepare'])assert.equal((await cmd(action,{id:offer.id,confirmed:true})).r.status,200);const o=state.store.offers.find(x=>x.id===offer.id);assert.equal(o.state,'READY_TO_COPY');assert.equal(o.publication,null);});
    await check('Price changes invalidate approval',async()=>{const o=state.store.offers.find(x=>x.id===offer.id);assert.equal((await cmd('offer.save',{...o,price:o.price+1})).r.status,200);assert.equal(state.store.offers.find(x=>x.id===offer.id).approval,null);});
    await check('Logout and login retain stored revision',async()=>{assert.equal((await req('/api/auth/logout',{})).r.status,200);assert.equal((await req('/api/session')).data.authenticated,false);const x=await req('/api/auth/login',{email:'qa-fixture@example.com',password});assert.equal(x.r.status,200);accept(x);assert.equal((await req('/api/workspaces/demo')).data.revision,state.revision);});
  }finally{
    // Only the temporary database created by this invocation; no user data or existing account is touched.
    assert.equal(account,receipt.provisioning.account.id);assert.equal(dbid,receipt.databaseId);
    for(const table of ['dealops_state','dealops_audit','dealops_rate_limits','collector_runs'])await sql('DELETE FROM '+table);
    receipt.qaReset=true;
  }
  await check('Test account removed; first administrator setup available',async()=>{cookie='';csrf='';assert.equal((await req('/api/session')).data.setupRequired,true);});
  const html=await (await fetch(receipt.url,{signal:AbortSignal.timeout(30000)})).text();assert.ok(html.includes('window.DEALOPS_SERVER=true'));receipt.checks.push({name:'Deployed UI is server-connected',ok:true});
  receipt.status='verified';receipt.finishedAt=new Date().toISOString();console.log('HTTPS preview verified. Claim and setup credentials encrypted for the owner.');
}catch(e){receipt.status='failed';receipt.error=redact(e.message);console.log('FAILED '+redact(e.message));process.exitCode=1;}
finally{await save();}
