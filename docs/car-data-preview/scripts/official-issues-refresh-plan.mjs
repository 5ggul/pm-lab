import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

// Timestamps alone are not new annual data. Rebuild only after an aggregate
// change or a source health transition visible to readers.
const health=status=>({ok:status?.ok===true,sources:Object.fromEntries(['reports','recalls'].map(kind=>[kind,{ok:status?.source_states?.[kind]?.ok===true,available:status?.source_states?.[kind]?.available===true}]))});
export function needsOfficialIssuesRebuild(beforeIndex,afterIndex,beforeStatus,afterStatus) {
  return beforeIndex!==afterIndex || JSON.stringify(health(beforeStatus))!==JSON.stringify(health(afterStatus));
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [beforeIndex,afterIndex,beforeStatus,afterStatus]=process.argv.slice(2);
  if (![beforeIndex,afterIndex,beforeStatus,afterStatus].every(Boolean)) throw new Error('Expected before/after index and status file paths');
  const read=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  const status=file=>{const text=read(file);return text?JSON.parse(text):null;};
  const result=needsOfficialIssuesRebuild(read(beforeIndex),read(afterIndex),status(beforeStatus),status(afterStatus));
  console.log(`needs_rebuild=${result}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,`needs_rebuild=${result}\n`);
}
