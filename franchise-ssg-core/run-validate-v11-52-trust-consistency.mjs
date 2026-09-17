import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateTrustConsistency} from './trust-consistency-integrator.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-52-release-candidate.json'),'utf8'));
const validation=validateTrustConsistency(out);
const errors=[];
if(manifest.uiVersion!=='11.52'||report.uiVersion!=='11.52')errors.push('uiVersion');
if(manifest.v11_52?.trustConsistencyUx!==true||report.trustConsistencyUx!==true)errors.push('trustConsistencyUx flag');
if(manifest.v11_52?.candidateSetChanged!==false||manifest.v11_52?.indexPolicyChanged!==false||manifest.v11_52?.dataSemanticsChanged!==false||manifest.v11_52?.productionDeployed!==false||report.productionDeployed!==false)errors.push('immutable contracts');
if(report.rcReady!==true||manifest.v11_52?.rcReady!==true)errors.push('rcReady');
if(errors.length){console.error(JSON.stringify({v11_52TrustConsistencyValidation:'FAIL',errors,validation},null,2));process.exit(1)}
console.log(JSON.stringify({v11_52TrustConsistencyValidation:'PASS',...validation,rcReady:true,productionDeployed:false},null,2));
