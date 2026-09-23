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
  recalls: read('car-recall-refresh.yml'),
  publicPages: read('car-preview-validate.yml'),
};

const scheduled = [
  ['car-efficiency-ingest.yml', workflows.efficiency],
  ['car-fuel-price-refresh.yml', workflows.fuel],
  ['car-manufacturer-spec-refresh.yml', workflows.manufacturer],
  ['car-recall-refresh.yml', workflows.recalls],
];

for (const [name, source] of scheduled) {
  if (!/^\s*schedule:\s*$/m.test(source) || !/^\s*- cron:\s*['"][^'"]+['"]\s*$/m.test(source)) {
    fail(`${name} has no cron schedule`);
  }
}

if (!workflows.recalls.includes("cron: '47 2,8,14,20 * * *'")) {
  fail('recall refresh must retry throughout the day after a transient source outage');
}

if (!/DATA_GO_KR_SERVICE_KEY:\s*\$\{\{\s*secrets\.DATA_GO_KR_SERVICE_KEY\s*\}\}/.test(workflows.efficiency)) {
  fail('KEA ingestion is not connected to DATA_GO_KR_SERVICE_KEY');
}
if (!/DATAKEY:\s*\$\{\{\s*secrets\.DATAKEY\s*\}\}/.test(workflows.efficiency)) {
  fail('KEA ingestion is not connected to the shared DATAKEY alias');
}
if (!workflows.efficiency.includes('kea-service-key-qa.mjs')) {
  fail('KEA ingestion does not validate shared-key normalization before collection');
}
if (!workflows.efficiency.includes('verify-kea-live-refresh.mjs')) {
  fail('KEA ingestion can publish without proving that the live API refreshed');
}
if (!/OPINET_API_KEY:\s*\$\{\{\s*secrets\.OPINET_API_KEY\s*\}\}/.test(workflows.fuel)) {
  fail('fuel refresh is not connected to OPINET_API_KEY');
}

const dispatchChecks = [
  ['KEA ingestion', workflows.efficiency, 'car-family-build.yml'],
  ['family data build', workflows.family, 'car-preview-validate.yml'],
  ['fuel refresh', workflows.fuel, 'car-preview-validate.yml'],
  ['manufacturer specification refresh', workflows.manufacturer, 'car-preview-validate.yml'],
  ['recall refresh', workflows.recalls, 'car-preview-validate.yml'],
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

const compareHtml=fs.readFileSync(path.join(repoRoot,'docs','car-data-preview','compare','index.html'),'utf8');
const rankingBuilder=fs.readFileSync(path.join(repoRoot,'docs','car-data-preview','scripts','build-clear-experience.mjs'),'utf8');
const comparisonBuilder=fs.readFileSync(path.join(repoRoot,'docs','car-data-preview','scripts','build-decision-flows.mjs'),'utf8');
const reviewedPilotBuilder=fs.readFileSync(path.join(repoRoot,'docs','car-data-preview','scripts','build-reviewed-pilot.mjs'),'utf8');
const priorityModelBuilder=fs.readFileSync(path.join(repoRoot,'docs','car-data-preview','scripts','build-priority-model-pages.mjs'),'utf8');
if (!compareHtml.includes('../data/generated/all-car-calc-bootstrap.json') || !compareHtml.includes('../assets/calc-data-loader.js')) fail('custom comparison does not load the sharded rolling calculation index');
if (!rankingBuilder.includes("read('data/generated/all-car-calc-index.json')")) fail('rankings are not rebuilt from the rolling calculation index');
if (!comparisonBuilder.includes("read('data/generated/all-car-calc-index.json')")) fail('comparison pages are not rebuilt from the rolling calculation index');
if (!comparisonBuilder.includes("read('data/recalls.json')")) fail('recall pages are not rebuilt from the refreshed recall snapshot');
if (!reviewedPilotBuilder.includes("import('./build-clear-experience.mjs')")) fail('public build chain does not invoke ranking rebuild');
if (!priorityModelBuilder.includes("import('./build-decision-flows.mjs')")) fail('public build chain does not invoke comparison and recall rebuild');
if (!/^\s*concurrency:\s*$/m.test(workflows.publicPages) || !/^\s*cancel-in-progress:\s*true\s*$/m.test(workflows.publicPages)) {
  fail('public-page rebuild does not cancel an older run when fresher data arrives');
}

if (!workflows.publicPages.includes("github.ref == 'refs/heads/main'")) fail('review-branch manual checks must not publish to main');

for (const [name,source] of Object.entries(workflows)) {
  const publish=source.split(/\n\s{6}- name:/).find(step=>step.includes('git push origin HEAD:main'));
  if (!publish?.includes("github.ref == 'refs/heads/main'")) fail(`${name}: publication must be restricted to main`);
  if (!/git fetch origin main\s+node docs\/car-data-preview\/scripts\/check-car-publish-base\.mjs car-[\w-]+\.yml\s+git reset --hard origin\/main/.test(publish || '')) fail(`${name}: stale-input guard must run before every reset/publication attempt`);
  if (!/^\s*actions:\s*write\s*$/m.test(source)) fail(`${name}: stale builds cannot queue a fresh run`);
}
for (const file of ['family-page-bootstrap.json','family-page-shards']) {
  if (!workflows.manufacturer.includes(`docs/car-data-preview/data/generated/${file}`)) fail(`manufacturer publication omits ${file}`);
}

if (!process.exitCode) {
  console.log('auto-refresh workflows: collectors, rebuild chain, validation, and publication are connected');
}
