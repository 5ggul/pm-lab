import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSourceStatus, statusToJavascript} from './core.mjs';
import {probeFtcRegistry} from './ftc-registry.mjs';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const persistedPath=resolve(repoRoot,'data/franchise/source-status.json');
let previous={sources:[]};
try{previous=JSON.parse(await readFile(persistedPath,'utf8'))}catch{}

const status=await buildSourceStatus();
const extraFtc=await probeFtcRegistry({serviceKey:process.env.DATA_GO_KR_SERVICE_KEY||''});
status.sources.splice(Math.max(0,status.sources.length-2),0,...extraFtc);
const previousById=new Map((previous.sources||[]).map(x=>[x.id,x]));
status.sources=status.sources.map(current=>{
 const prev=previousById.get(current.id);if(!prev)return current;
 const metadataFailed=['METADATA_UNAVAILABLE','PORTAL_UNAVAILABLE'].includes(current.availability);
 const previousMetadataGood=['METADATA_VERIFIED','METADATA_VERIFIED_LICENSE_REVIEW','PORTAL_VERIFIED','READY'].includes(prev.availability);
 let merged={...current};
 if(metadataFailed&&previousMetadataGood){merged={...current,name:prev.name||current.name,provider:prev.provider||current.provider,license:prev.license||current.license,modifiedAt:prev.modifiedAt||current.modifiedAt,format:prev.format||current.format,spatialCoverage:prev.spatialCoverage||current.spatialCoverage,guideUrl:prev.guideUrl||current.guideUrl,availability:prev.availability,metadataProbe:'STALE_AFTER_ERROR',metadataProbeError:current.error,lastMetadataSuccessAt:prev.checkedAt||prev.lastMetadataSuccessAt||null}}
 if(['LIVE_ERROR','AUTH_PROBE_ERROR','PORTAL_UNAVAILABLE','CONNECT_ERROR','HTTP_ERROR','API_ERROR'].includes(current.live)&&['LIVE_VERIFIED','READY'].includes(prev.live)){merged.live='STALE_AFTER_ERROR';merged.lastLiveSuccessAt=prev.checkedAt||prev.lastLiveSuccessAt||null;merged.liveProbeError=current.error||current.resultMsg||current.live}
 return merged;
});
status.sourceCount=status.sources.length;status.previousSnapshotAt=previous.generatedAt||null;
const outputs=[[persistedPath,JSON.stringify(status,null,2)+'\n'],[resolve(repoRoot,'docs/franchise-data-preview/source-status.json'),JSON.stringify(status,null,2)+'\n'],[resolve(repoRoot,'docs/franchise-data-preview/source-status-final.js'),statusToJavascript(status)]];
for(const [file,content] of outputs){await mkdir(dirname(file),{recursive:true});await writeFile(file,content,'utf8')}
console.log(JSON.stringify({generatedAt:status.generatedAt,dataMode:status.dataMode,sourceCount:status.sources.length,sources:status.sources.map(s=>({id:s.id,availability:s.availability,live:s.live,role:s.role,totalCount:s.totalCount}))},null,2));
