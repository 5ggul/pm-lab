import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const report=JSON.parse(await readFile(resolve(root,'data/franchise/official/store-match-report.json'),'utf8'));
const snap=JSON.parse(await readFile(resolve(root,'data/franchise/official/stores-2025.json'),'utf8'));
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/주식회사|\(주\)|㈜|\(유\)|유한회사|농업회사법인|재단법인|사단법인/g,'').replace(/[^0-9a-z가-힣]/g,'');
const stripCommon=v=>norm(v).replace(/커피|치킨|피자|버거|카페|헤어|스터디카페|마라탕|떡볶이|국밥|순대국|샐러드|포케|세탁|영어|교육|수학/g,'');
const bigrams=s=>{const a=[];for(let i=0;i<s.length-1;i++)a.push(s.slice(i,i+2));return a};
function score(a,b){const x=norm(a),y=norm(b);if(!x||!y)return 0;if(x===y)return 1;if(x.includes(y)||y.includes(x))return .94;const sx=stripCommon(a),sy=stripCommon(b);if(sx&&sy&&(sx===sy))return .9;if(sx&&sy&&(sx.includes(sy)||sy.includes(sx)))return .82;const A=bigrams(x),B=new Set(bigrams(y));if(!A.length)return 0;return A.filter(z=>B.has(z)).length/Math.max(A.length,B.size)}
const official=(snap.records||[]).map(r=>({name:r.name,corp:r.corp,industryMajor:r.industryMajor,industryMid:r.industryMid,stores:r.stores}));
const unmatched=(report.unmatchedCatalog||[]).map(u=>{
 const candidates=official.map(r=>({...r,score:score(u.name,r.name)})).filter(r=>r.score>=.35).sort((a,b)=>b.score-a.score||String(a.name).localeCompare(String(b.name),'ko')).slice(0,8);
 return {name:u.name,slug:u.slug,aliases:u.aliases||[],candidates};
});
const review={schemaVersion:1,generatedAt:new Date().toISOString(),matched:report.matched,unmatched:report.unmatched,ambiguous:report.ambiguous,unmatchedCatalog:unmatched,ambiguousCatalog:report.ambiguousCatalog||[]};
await writeFile(resolve(root,'data/franchise/official/store-match-review.json'),JSON.stringify(review,null,2)+'\n','utf8');
console.log(JSON.stringify({unmatched:review.unmatched,ambiguous:review.ambiguous,highConfidenceCandidates:unmatched.filter(x=>x.candidates[0]?.score>=.82).map(x=>({name:x.name,candidate:x.candidates[0].name,score:x.candidates[0].score}))},null,2));
