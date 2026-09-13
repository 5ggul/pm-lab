import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');

const read = (name) => fs.readFileSync(path.join(repoRoot, '.github', 'workflows', name), 'utf8');
const fail = (message) => {
  console.error(`auto-refresh workflow validation failed: ${message}`);
  process.exitCode = 1;
};

const workflows = {
  efficiency: read('car-efficiency-ingest.yml'),
  family: read('car-family-build.yml'),
  fuel: read('car-fuel-price-refresh.yml'),
  manufacturer: read('car-manufacturer-spec-refresh.yml'),
  publicPages: read('car-preview-validate.yml'),
};

const scheduled = [
  ['car-efficiency-ingest.yml', workflows.efficiency],
  ['car-fuel-price-refresh.yml', workflows.fuel],
  ['car-manufacturer-spec-refresh.yml', workflows.manufacturer],
];

for (const [name, source] of scheduled) {
  if (!/^\s*schedule:\s*$/m.test(source) || !/^\s*- cron:\s*['"][^'"]+['"]\s*$/m.test(source)) {
    fail(`${name} has no cron schedule`);
  }
}

if (!/DATA_GO_KR_SERVICE_KEY:\s*\$\{\{\s*secrets\.DATA_GO_KR_SERVICE_KEY\s*\}\}/.test(workflows.efficiency)) {
  fail('KEA ingestion is not connected to DATA_GO_KR_SERVICE_KEY');
}
if (!/OPINET_API_KEY:\s*\$\{\{\s*secrets\.OPINET_API_KEY\s*\}\}/.test(workflows.fuel)) {
  fail('fuel refresh is not connected to OPINET_API_KEY');
}

const dispatchChecks = [
  ['KEA ingestion', workflows.efficiency, 'car-family-build.yml'],
  ['family data build', workflows.family, 'car-preview-validate.yml'],
  ['fuel refresh', workflows.fuel, 'car-preview-validate.yml'],
  ['manufacturer specification refresh', workflows.manufacturer, 'car-preview-validate.yml'],
];

for (const [label, source, target] of dispatchChecks) {
  if (!source.includes(target)) fail(`${label} does not dispatch ${target}`);
  if (!/^\s*actions:\s*write\s*$/m.test(source)) fail(`${label} cannot dispatch another workflow (actions: write missing)`);
}

const requiredBuildCommands = [
  'build-car-data.mjs',
  'build-launch-readiness.mjs',
  'build-reviewed-pilot.mjs',
  'prelaunch-public-qa.mjs',
  'build-index-quality-gate.mjs',
];
for (const command of requiredBuildCommands) {
  if (!workflows.publicPages.includes(command)) fail(`public-page rebuild is missing ${command}`);
}

if (!workflows.publicPages.includes('Regenerate car preview outputs [car-generated]')) {
  fail('public-page rebuild does not publish generated HTML safely');
}
if (!/^\s*concurrency:\s*$/m.test(workflows.publicPages) || !/^\s*cancel-in-progress:\s*true\s*$/m.test(workflows.publicPages)) {
  fail('public-page rebuild does not cancel an older run when fresher data arrives');
}

if (!process.exitCode) {
  console.log('auto-refresh workflows: collectors, rebuild chain, validation, and publication are connected');
}
