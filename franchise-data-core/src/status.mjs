import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSourceStatus, statusToJavascript} from './core.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const status = await buildSourceStatus();
const outputs = [
  [resolve(repoRoot, 'data/franchise/source-status.json'), JSON.stringify(status, null, 2) + '\n'],
  [resolve(repoRoot, 'docs/franchise-data-preview/source-status.json'), JSON.stringify(status, null, 2) + '\n'],
  [resolve(repoRoot, 'docs/franchise-data-preview/source-status-final.js'), statusToJavascript(status)]
];
for (const [file, content] of outputs) {
  await mkdir(dirname(file), {recursive: true});
  await writeFile(file, content, 'utf8');
}
console.log(JSON.stringify({generatedAt: status.generatedAt, dataMode: status.dataMode, sources: status.sources.map(s => ({id:s.id, availability:s.availability, live:s.live}))}, null, 2));
