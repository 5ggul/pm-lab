import { SOURCES, productionReadySources } from '../core.js';
import { CAPABILITIES, productionEnabledCapabilities } from '../src/capability-registry.js';

const requireProduction=process.argv.includes('--require-production');
const sources=Object.values(SOURCES).map(x=>({id:x.id,state:x.state,readiness:x.readiness,productionEnabled:x.productionEnabled}));
const capabilities=Object.values(CAPABILITIES).map(x=>({id:x.id,state:x.state,productionEnabled:x.productionEnabled}));
const report={
  productionDeployAllowed:false,
  productionReadySources:productionReadySources().length,
  productionEnabledCapabilities:productionEnabledCapabilities().length,
  sources,
  capabilities,
  blockers:[
    'KAC_FULL_LIST_OPERATION_NOT_LIVE_VERIFIED',
    'IIAC_DEPARTURE_OPERATION_NOT_VERIFIED',
    'DATA_GO_KR_LIVE_FIXTURES_REQUIRED',
    'KMA_API_HUB_LIVE_FIXTURES_REQUIRED',
    'USER_PRODUCTION_APPROVAL_REQUIRED'
  ]
};
console.log(JSON.stringify(report,null,2));
if(requireProduction&&(report.productionReadySources===0||report.blockers.length))process.exit(2);
