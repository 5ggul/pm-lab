import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Deterministic page builds use the last validated official snapshots. Only the
// dedicated collector contacts the provider; PR and local UI builds stay offline.
const scripts=path.dirname(fileURLToPath(import.meta.url));
for (const name of ['build-official-issues-index.mjs','validate-official-issues.mjs','build-official-issues-hub.mjs','patch-official-issues-links.mjs']) {
  execFileSync(process.execPath,[path.join(scripts,name)],{stdio:'inherit',maxBuffer:8*1024*1024});
}
console.log('Official report and recall information built from validated snapshots.');
