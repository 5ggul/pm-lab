import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { communitySnapshot, growthReport } from './growth-engine.mjs';
import { readState, saveState } from './publish-journal.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = name => path.join(root, 'state', name + '.json');
const args = process.argv.slice(2);
const value = key => args[args.indexOf(key) + 1];
if (args[0] === 'record-members') {
  if (!args.includes('--members') || !args.includes('--source')) throw new Error('Use record-members --members <observed total> --source <where observed>');
  const members = Number(value('--members'));
  if (!Number.isSafeInteger(members) || members < 0) throw new Error('MEMBERS_MUST_BE_NONNEGATIVE_INTEGER');
  const source = value('--source');
  if (!source || source.startsWith('--')) throw new Error('OBSERVATION_SOURCE_REQUIRED');
  const snapshots = await readState(file('community-metrics'), []);
  snapshots.push(communitySnapshot({ members, source }));
  await saveState(file('community-metrics'), snapshots.slice(-180));
  console.log('Recorded observed member total; no per-post attribution inferred.');
} else if (args[0] === 'report') {
  const [published, metrics, snapshots] = await Promise.all([readState(file('published'), []), readState(file('metrics-history'), []), readState(file('community-metrics'), [])]);
  console.log(JSON.stringify(growthReport(published, metrics, snapshots), null, 2));
} else {
  console.log('Commands: report | record-members --members <total> --source <observation source>');
}
