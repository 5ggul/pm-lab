import {existsSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
export const PREVIEW = Object.freeze({
  SSG_PREVIEW_MODE: 'true',
  SSG_BASE_PATH: '/pm-lab/franchise-ssg-preview',
  SSG_SITE_URL: 'https://5ggul.github.io/pm-lab/franchise-ssg-preview'
});

// Keep the same single-pass ordering as franchise-ssg-preview.yml.
// v11.37 owns the v11.3-v11.36 baseline: never run the old npm chain first.
const stages = [
  [37, 'sales-semantics', []],
  [38, 'mobile-safeguards', []],
  [39, 'brand-evidence', []],
  [40, 'market-design', []],
  [41, 'cinematic-motion', [40]],
  [42, 'data-interface', []],
  [43, 'control-ux', [42]],
  [44, 'v42-refinement', [42]],
  [45, 'public-freshness', [44, 42]],
  [46, 'workflow-ux', [45, 44, 42]],
  [47, 'trust-signal', [46, 45, 44, 42]],
  [48, 'brand-distinctness', [46, 45, 44, 42, 39]],
  [49, 'bulk-usability', [46, 45, 44, 42, 39]],
  [50, 'discovery-tools', [49, 46, 45, 44, 42, 39]],
  [51, 'viewport-guard', [50, 49]],
  [52, 'release-candidate', [51, 50, 49]]
];
const suffix = new Map(stages.map(([version, name]) => [version, name]));
const validator = version => `run-validate-v11-${version}-${suffix.get(version)}.mjs`;
const inherited = [52, 51, 50, 49, 46, 45, 39, 38, 37];
const build = ['run-audit-v10-data.mjs'];
for (const [version, name, checks] of stages) {
  build.push(`run-generate-v11-${version}-${name}.mjs`);
  if (version === 37) build.push('run-fix-v11-37-structured-sales.mjs');
  if (version === 48) build.push('run-fix-v11-48-copy.mjs');
  build.push(validator(version), ...checks.map(validator));
}
build.push(...inherited.map(validator));
export const BUILD_STEPS = Object.freeze(build);
// Validate the final RC, not historical markup intentionally replaced by later UI stages.
export const VALIDATE_STEPS = Object.freeze(
  [52, 51, 50, 49, 46, 45, 44, 42, 39, 38, 37].map(validator)
);

export function previewEnvironment(source = process.env) {
  for (const [key, value] of Object.entries(PREVIEW)) {
    if (source[key] !== undefined && source[key] !== value) {
      throw new Error(`${key} conflicts with the locked preview configuration.`);
    }
  }
  if (source.SSG_RELEASE_BUILD_APPROVED === 'YES') {
    throw new Error('Production approval cannot be used with the preview pipeline.');
  }
  return {...source, ...PREVIEW};
}

export function planFor(mode = 'build') {
  if (mode === 'build' || mode === 'generate') return [...BUILD_STEPS];
  if (mode === 'validate') return [...VALIDATE_STEPS];
  throw new Error(`Unknown preview mode: ${mode}. Use build, generate, or validate.`);
}

export function runPipeline(mode = 'build', options = {}) {
  const scripts = planFor(mode);
  const env = previewEnvironment(options.env ?? process.env);
  const root = options.root ?? repo;
  const core = path.join(root, 'franchise-ssg-core');
  const exists = options.exists ?? existsSync;
  const execute = options.execute ?? spawnSync;
  // Fail before the first write if the checkout is incomplete.
  const missing = [...new Set(scripts)].filter(file => !exists(path.join(core, file)));
  if (missing.length) throw new Error(`Missing preview scripts: ${missing.join(', ')}`);
  for (const script of scripts) {
    const result = execute(process.execPath, [path.join(core, script)], {
      cwd: root, env, stdio: 'inherit', shell: false
    });
    if (result.error) throw new Error(`${script}: ${result.error.message}`);
    if (result.status !== 0 || result.signal) {
      throw new Error(`${script} failed (${result.signal ?? result.status ?? 'unknown'}).`);
    }
  }
  return scripts.length;
}

export function main(args = process.argv.slice(2)) {
  const dryPlan = args[0] === '--plan';
  const mode = (dryPlan ? args[1] : args[0]) ?? 'build';
  if (args.length > (dryPlan ? 2 : 1)) throw new Error('Unexpected preview arguments.');
  if (dryPlan) {
    // Pure inspection: do not run generators, validators, publishing, or release code.
    console.log(JSON.stringify({mode, uiVersion: '11.52', scripts: planFor(mode)}, null, 2));
    return;
  }
  console.log(`Preview ${mode}: ${runPipeline(mode)} steps passed; UI v11.52.`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { main(); }
  catch (error) {
    console.error(`[preview-pipeline] ${error.message}`);
    process.exitCode = 1;
  }
}
