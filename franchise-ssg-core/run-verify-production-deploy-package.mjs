import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {verifyDeployPackage} from './deployment-package.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const TEST_MODE=String(process.env.SSG_RELEASE_TEST_MODE||'').toLowerCase()==='true';
const defaultPackage=TEST_MODE?path.join(os.tmpdir(),'franchise-production-deploy-package'):path.join(repo,'build/franchise-production-deploy-package');
const packageRoot=path.resolve(process.env.SSG_PRODUCTION_DEPLOY_PACKAGE||defaultPackage);
const result=await verifyDeployPackage(packageRoot);
const summary={productionDeployPackageValidation:result.ready?'PASS':'FAIL',testMode:TEST_MODE,packageDigest:result.manifest?.packageDigest||null,sourceHead:result.manifest?.sourceHead||null,candidateTreeHash:result.manifest?.candidateTreeHash||null,fileCount:result.files?.fileCount||0,totalBytes:result.files?.totalBytes||0,rollbackMode:result.manifest?.rollback?.mode||null,errors:result.errors,productionDeploy:false};
console.log(JSON.stringify(summary,null,2));
if(!result.ready)process.exit(1);
