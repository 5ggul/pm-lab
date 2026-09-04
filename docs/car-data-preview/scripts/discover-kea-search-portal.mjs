import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');
const start='https://min24.energy.or.kr/trans_hp/AHP/HP_03/HP_03_01_010.do';
const out=path.join(root,'data','generated','kea-search-portal-discovery.json');
function get(url){try{return execFileSync('curl',['-fsSL','--retry','2','--retry-all-errors','--connect-timeout','10','--max-time','40','-A','Mozilla/5.0 pm-lab-car-preview',url],{encoding:'utf8',maxBuffer:16*1024*1024})}catch(e){return''}}
function abs(base,v){try{return new URL(v,base).toString()}catch{return null}}
function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
const html=get(start),assets=[];for(const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)){const u=abs(start,m[1]);if(u&&new URL(u).origin===new URL(start).origin)assets.push(u)}
const docs=[{url:start,text:html,kind:'html'}];for(const u of [...new Set(assets)]){const text=get(u);if(text)docs.push({url:u,text,kind:'script'})}
const endpoints=new Map(),contexts=[];const patterns=[/url\s*:\s*["']([^"']+)["']/gi,/ajax[^\n]{0,500}/gi,/[^"'\s<>]+\.do(?:\?[^"'\s<>]*)?/gi,/[^"'\s<>]*(?:excel|download|search|select|list|fuel|car)[^"'\s<>]*/gi];
for(const d of docs){for(const re of patterns){for(const m of d.text.matchAll(re)){const raw=m[1]||m[0],value=clean(raw);if(!value)continue;if(/\.do|ajax|excel|download|search|select|list|fuel|car/i.test(value)){const u=value.includes('.do')?abs(d.url,value):null;if(u&&new URL(u).origin===new URL(start).origin)endpoints.set(u,{url:u,found_in:d.url,kind:'same_origin_endpoint'});if(contexts.length<1200)contexts.push({found_in:d.url,text:value.slice(0,1000)})}}}for(const needle of ['HP_03_01_010','연료','차량형식','엑셀','excel','download','ajax','search','fuel','vhcl','carType']){let pos=0,count=0;const lower=d.text.toLowerCase(),n=needle.toLowerCase();while((pos=lower.indexOf(n,pos))>=0&&count<30){contexts.push({found_in:d.url,needle,text:clean(d.text.slice(Math.max(0,pos-260),Math.min(d.text.length,pos+700))).slice(0,1200)});pos+=n.length;count++}}}
const uniqueContexts=[],seen=new Set();for(const c of contexts){const k=`${c.found_in}|${c.text}`;if(!seen.has(k)){seen.add(k);uniqueContexts.push(c)}}
const output={schema_version:1,fetched_at:new Date().toISOString(),start_url:start,html_bytes:Buffer.byteLength(html),scripts:docs.filter(d=>d.kind==='script').map(d=>({url:d.url,bytes:Buffer.byteLength(d.text)})),endpoints:[...endpoints.values()],contexts:uniqueContexts.slice(0,1600)};fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');console.log(`KEA portal discovery: ${output.scripts.length} scripts / ${output.endpoints.length} endpoint candidates / ${output.contexts.length} contexts`);
