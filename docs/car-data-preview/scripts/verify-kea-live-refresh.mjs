import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const load=name=>JSON.parse(fs.readFileSync(path.join(root,'data','generated',name),'utf8'));
const statuses=[
  ['KEA normalized collector',load('kea-api-status.json'),'fetched','api'],
  ['KEA display collector',load('kea-display-status.json'),'fetched_native_api','native_api']
];
const now=Date.now();

for(const [label,status,expectedStatus,expectedTransport] of statuses){
  if(status?.ok!==true||status?.status!==expectedStatus||status?.transport!==expectedTransport){
    throw new Error(`${label} did not complete from the live public-data API`);
  }
  const age=now-Date.parse(status.fetched_at);
  if(!Number.isFinite(age)||age<0||age>30*60*1000){
    throw new Error(`${label} status is not from the current workflow run`);
  }
  if(!Number.isInteger(status.key_slot)||status.key_slot<1){
    throw new Error(`${label} did not record which configured key alias succeeded`);
  }
}

console.log('KEA live API refresh verified for both normalized collectors');
