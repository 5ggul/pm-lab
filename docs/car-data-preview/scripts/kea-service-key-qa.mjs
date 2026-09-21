import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDataGoServiceKey, dataGoServiceKeys } from './data-go-service-key.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(here,name),'utf8');
const encoded='abc%2B123%2Fz%3D';
const decoded='abc+123/z=';

assert.deepEqual(
  dataGoServiceKeys({DATA_GO_KR_SERVICE_KEY:` serviceKey=${encoded} `,DATAKEY:decoded}),
  [decoded],
  'the same public-data key must be deduplicated across both secret names'
);
assert.deepEqual(
  dataGoServiceKeys({DATA_GO_KR_SERVICE_KEY:' "first" ',DATAKEY:"'second'"}),
  ['first','second'],
  'different configured aliases must remain available as ordered fallbacks'
);

const url=addDataGoServiceKey(new URL('https://apis.data.go.kr/B553530/CAREFF/CAREFF_LIST'),decoded);
assert.equal(url.searchParams.get('serviceKey'),decoded);
assert.match(url.toString(),/serviceKey=abc%2B123%2Fz%3D/);

for(const name of ['fetch-kea-cars.mjs','fetch-kea-display-cars.mjs']){
  const source=read(name);
  assert.match(source,/https:\/\/apis\.data\.go\.kr\/B553530\/CAREFF\/CAREFF_LIST/);
  assert.doesNotMatch(source,/api\.energy\.or\.kr/);
  assert.match(source,/dataGoServiceKeys\(\)/);
  assert.match(source,/addDataGoServiceKey/);
  for(const field of ['COMP_NM','MODEL_NM','FUEL_NM','DISPLAY_EFF'])assert.ok(source.includes(field),`${name} is missing ${field}`);
}

const displayCollector=read('fetch-kea-display-cars.mjs');
assert.match(displayCollector,/function crossSourceId\(row\)/,'display API and CSV rows need a shared identity');
assert.match(displayCollector,/function stableId\(row\)\{return 'kea-display-'\+crossSourceId\(row\)/,'published record ids must use the cross-source identity');
assert.match(displayCollector,/merged\.set\(crossSourceId\(row\)/,'cross-source merge must deduplicate the same official row');
assert.match(displayCollector,/crossSourceDuplicates<1/,'a schema change that defeats cross-source deduplication must fail closed');
assert.match(displayCollector,/__source_row_index:index/,'source-local row indexes must remain stable across API and CSV merges');

console.log('KEA shared public-data key and official CAREFF endpoint validation passed');
