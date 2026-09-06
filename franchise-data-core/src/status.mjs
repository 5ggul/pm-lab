import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {buildSourceStatus, statusToJavascript} from './core.mjs';

const root = resolve(new URL('../..', import.meta.url).pathname);
const status = await buildSourceStatus();
const outputs = [
  [resolve(root, '../data/franchise/source-status.json'), JSON.stringify(status, null, 2) + '\n'],
  [resolve(root, '../docs/franchise-data-preview/source-status.json'), JSON.stringify(status, null, 2) + '\n'],
  [resolve(root, '../docs/franchise-data-preview/source-status-final.js'), statusToJavascript(status)]
];
for (const [file, content] of outputs) {
  await mkdir(dirname(file), {recursive: true});
  await writeFile(file, content, 'utf8');
}
console.log(JSON.stringify({generatedAt: status.generatedAt, dataMode: status.dataMode, sources: status.sources.map(s => ({id:s.id, availability:s.availability, live:s.live}))}, null, 2));
