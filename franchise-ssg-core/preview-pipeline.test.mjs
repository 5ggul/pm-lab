import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {BUILD_STEPS, VALIDATE_STEPS, PREVIEW, planFor, previewEnvironment, runPipeline} from './run-preview-pipeline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const fake = overrides => ({root, env: {}, exists: () => true, execute: () => ({status: 0}), ...overrides});

test('unit: build starts with the audit and the v11.37 single-pass baseline', () => {
  assert.deepEqual(BUILD_STEPS.slice(0, 4), [
    'run-audit-v10-data.mjs', 'run-generate-v11-37-sales-semantics.mjs',
    'run-fix-v11-37-structured-sales.mjs', 'run-validate-v11-37-sales-semantics.mjs'
  ]);
  const generators = BUILD_STEPS.filter(x => x.startsWith('run-generate-'));
  assert.equal(generators.length, 16);
  assert.equal(new Set(generators).size, 16);
  assert.equal(generators.at(-1), 'run-generate-v11-52-release-candidate.mjs');
  assert.ok(!BUILD_STEPS.some(x => /v11-(?:[3-9]|[12]\d|3[0-6])-/.test(x)));
});

test('unit: copy repair runs before v11.48 validation', () => {
  const i = BUILD_STEPS.indexOf('run-generate-v11-48-brand-distinctness.mjs');
  assert.deepEqual(BUILD_STEPS.slice(i, i + 3), [
    'run-generate-v11-48-brand-distinctness.mjs', 'run-fix-v11-48-copy.mjs',
    'run-validate-v11-48-brand-distinctness.mjs'
  ]);
});

test('unit: generation cannot bypass validation or mutate the shared plan', () => {
  assert.deepEqual(planFor('generate'), planFor('build'));
  const plan = planFor(); plan.pop();
  assert.equal(planFor().length, BUILD_STEPS.length);
  assert.ok(Object.isFrozen(BUILD_STEPS));
});

test('unit: validate only audits current RC and inherited contracts', () => {
  assert.equal(VALIDATE_STEPS.length, 11);
  assert.ok(VALIDATE_STEPS.every(x => x.startsWith('run-validate-')));
  assert.equal(VALIDATE_STEPS[0], 'run-validate-v11-52-release-candidate.mjs');
});

test('unit: pipeline never includes production builders or deployment commands', () => {
  assert.ok([...BUILD_STEPS, ...VALIDATE_STEPS].every(x =>
    /^[a-z0-9-]+\.mjs$/.test(x) && !/production|deploy|handoff/.test(x)
  ));
  assert.throws(() => planFor('production'), /Unknown preview mode/);
});

test('unit: preview defaults preserve unrelated environment without mutation', () => {
  const source = {PATH: '/example'};
  assert.deepEqual(previewEnvironment(source), {...source, ...PREVIEW});
  assert.deepEqual(source, {PATH: '/example'});
  assert.deepEqual(previewEnvironment(PREVIEW), PREVIEW);
});

for (const [key, value] of Object.entries({
  SSG_PREVIEW_MODE: 'false', SSG_BASE_PATH: '/',
  SSG_SITE_URL: 'https://example.com', SSG_RELEASE_BUILD_APPROVED: 'YES'
})) {
  test(`unit: rejects conflicting ${key} before executing any scripts`, () => {
    let calls = 0;
    assert.throws(() => runPipeline('build', fake({env: {[key]: value}, execute: () => {calls++; return {status: 0};}})));
    assert.equal(calls, 0);
  });
}

test('unit: missing checkout file stops execution before the first mutation', () => {
  let calls = 0;
  assert.throws(() => runPipeline('build', fake({
    exists: name => !name.endsWith('run-generate-v11-52-release-candidate.mjs'),
    execute: () => {calls++; return {status: 0};}
  })), /Missing preview scripts/);
  assert.equal(calls, 0);
});

test('unit: failure stops downstream scripts', () => {
  let calls = 0;
  assert.throws(() => runPipeline('build', fake({execute: () => ({status: ++calls === 2 ? 1 : 0})})), /failed/);
  assert.equal(calls, 2);
});

test('unit: process errors and signals cannot report success', () => {
  for (const result of [{error: new Error('spawn failure')}, {status: null, signal: 'SIGTERM'}]) {
    assert.throws(() => runPipeline('build', fake({execute: () => result})));
  }
});

test('unit: runner uses Node directly, the repository root, and locked preview values', () => {
  const seen = [];
  assert.equal(runPipeline('validate', fake({execute: (bin, args, options) => {
    seen.push(path.basename(args[0]));
    assert.equal(bin, process.execPath);
    assert.equal(options.cwd, root);
    assert.equal(options.shell, false);
    assert.deepEqual(options.env, PREVIEW);
    return {status: 0};
  }})), VALIDATE_STEPS.length);
  assert.deepEqual(seen, [...VALIDATE_STEPS]);
});

test('unit: plan CLI performs no build and rejects unknown or extra arguments', () => {
  const runner = path.join(here, 'run-preview-pipeline.mjs');
  const planned = spawnSync(process.execPath, [runner, '--plan'], {encoding: 'utf8'});
  assert.equal(planned.status, 0);
  assert.deepEqual(JSON.parse(planned.stdout).scripts, [...BUILD_STEPS]);
  for (const args of [['production'], ['build', 'extra'], ['--plan', 'build', 'extra']]) {
    assert.notEqual(spawnSync(process.execPath, [runner, ...args], {encoding: 'utf8'}).status, 0);
  }
});

test('CI: npm entrypoints use the current preview runner', () => {
  const {scripts} = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8'));
  for (const mode of ['build', 'generate', 'validate']) {
    assert.equal(scripts[mode], `node run-preview-pipeline.mjs ${mode}`);
  }
});

test('CI: build order exactly matches the existing preview workflow', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/franchise-ssg-preview.yml'), 'utf8');
  const commands = [...workflow.matchAll(/^\s*(?:run:\s*)?node franchise-ssg-core\/([\w.-]+\.mjs)\s*$/gm)].map(x => x[1]);
  assert.deepEqual([...BUILD_STEPS], commands);
});

test('CI: every build and validation script exists in this checkout', () => {
  for (const script of new Set([...BUILD_STEPS, ...VALIDATE_STEPS])) {
    assert.ok(fs.statSync(path.join(here, script)).isFile(), `Missing ${script}`);
  }
});
