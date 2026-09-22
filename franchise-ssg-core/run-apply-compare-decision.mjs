import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyCompareDecision} from './compare-decision-integrator.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../docs/franchise-ssg-preview');
console.log(JSON.stringify(applyCompareDecision(root)));
