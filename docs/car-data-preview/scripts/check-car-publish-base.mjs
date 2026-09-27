import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

// Compare committed inputs, not the dirty generated working tree. Other products
// may advance main, but a car change requires a new build and QA on that revision.
export function changedCarInputs(base, target='origin/main', cwd=process.cwd()) {
  if (!/^[a-f0-9]{40}$/i.test(base || '')) throw new Error('Missing immutable build SHA');
  return execFileSync('git', ['diff','--name-only',base,target,'--',
    'docs/car-data-preview', 'docs/_config.yml', 'docs/404.html',
    '.github/workflows/car-*.yml'], {cwd,encoding:'utf8'}).trim().split('\n').filter(Boolean);
}

export function assertPublishContext(env) {
  if (env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_EVENT_NAME === 'pull_request') {
    throw new Error('Publishing car data is allowed only from main, never a PR or review branch');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertPublishContext(process.env);
  const changed=changedCarInputs(process.env.GITHUB_SHA);
  if (changed.length) {
    console.error(`Car inputs changed during this run; refusing stale publication:\n${changed.join('\n')}`);
    const workflow=process.argv[2];
    if (!/^car-[a-z-]+\.yml$/.test(workflow || '')) throw new Error('Missing retry workflow');
    execFileSync('gh',['workflow','run',workflow,'--ref','main'],{stdio:'inherit'});
    console.error('A fresh main run was requested. This outdated run did not publish.');
    process.exitCode=1;
  }
}
