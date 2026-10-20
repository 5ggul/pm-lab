import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseCsv, decodeCsv, normalizeRows, isoDate, buildIndex, sha256, validateAliases, SOURCE_FIELDS, assertSnapshotQuality, rawSnapshotPath} from './official-issues-data.mjs';

const fixture = lines => Buffer.from(SOURCE_FIELDS.reports.join(',') + '\r\n' + lines.join('\r\n'));
const families = [{family_id: 'hyundai-grandeur', maker: '현대', family_name: '그랜저'}, {family_id: 'kia-k8', maker: '기아', family_name: 'K8'}];
const aliases = {schema_version: 1, entries: [{family_id: 'hyundai-grandeur', maker: '현대자동차(주)', model: '그랜저(GRANDEUR)', status: 'verified', reviewed_at: '2026-10-14', evidence: 'Test reviewed source identity'}]};
const manifests = Object.fromEntries(['reports', 'recalls'].map((kind, i) => [kind, {dataset_id: i ? '3048950' : '15016450', source_url: `https://www.data.go.kr/data/${i ? '3048950' : '15016450'}/fileData.do`, checked_at: '2026-10-14T00:00:00Z', content_changed_at: '2026-10-14T00:00:00Z'}]));
const make = (rows, options = {}) => {const bytes = fixture(rows), snapshot = {...normalizeRows(bytes, 'reports'), sha256: sha256(bytes)}; return buildIndex({families, aliases, snapshots: {reports: snapshot}, manifests: {...manifests, reports: {...manifests.reports, sha256: snapshot.sha256}}, ...options});};

test('CSV supports quoted commas, escaped quotes and multiline fields', () => assert.deepEqual(parseCsv('a,b\r\n"x,y","a""b\nc"\r\n'), [['a','b'], ['x,y','a"b\nc']]));
test('CSV rejects unclosed quotes and text following a closing quote', () => {assert.throws(() => parseCsv('a,"b')); assert.throws(() => parseCsv('"a"z,b'));});
test('source header drift and HTML are rejected', () => {assert.throws(() => decodeCsv(Buffer.from('new,header\n1,2'), 'reports')); assert.throws(() => decodeCsv(Buffer.from('<html>error</html>'), 'reports'));});
test('date normalization rejects impossible calendar dates', () => {assert.equal(isoDate('20250229'), null); assert.equal(isoDate('2024.02.29'), '2024-02-29');});
test('same four-field report rows remain separate official records', () => {const i = make(['2025-01-02,현대자동차(주),그랜저(GRANDEUR),2023','2025-01-02,현대자동차(주),그랜저(GRANDEUR),2023']); assert.equal(i.sources.reports.rows, 2); assert.equal(i.families.find(f=>f.family_id==='hyundai-grandeur').report_count, 2);});
test('snapshot replacement does not append previous counts', () => {const previous = make(['2025-01-02,현대자동차(주),그랜저(GRANDEUR),2023','2025-01-02,현대자동차(주),그랜저(GRANDEUR),2023']); const i=make(['2025-02-01,현대자동차(주),그랜저(GRANDEUR),2024'], {previous}); assert.equal(i.sources.reports.rows,1); assert.equal(i.families.find(f=>f.family_id==='hyundai-grandeur').report_count,1);});
test('maker identity is part of exact reviewed matching', () => {const i=make(['2025-01-02,다른 제작사,그랜저(GRANDEUR),2023']);assert.equal(i.sources.reports.matched_rows,0);assert.equal(i.sources.reports.unmatched_rows,1);});
test('unreviewed generation or name prefix is not guessed into a family', () => {const i=make(['2025-01-02,현대자동차(주),그랜저 신형,2023']);assert.equal(i.sources.reports.unmatched_rows,1);});
test('unknown family has a nonzero-state distinction from verified zero', () => {const i=make(['2025-01-02,현대자동차(주),그랜저(GRANDEUR),2023']); assert.equal(i.families.find(f=>f.family_id==='kia-k8').match_status,'unmapped');});
test('missing maker/date/year remain held in row accounting', () => {const i=make(['2025-01-02,현대자동차(주),그랜저(GRANDEUR),2023','2025-01-02,,그랜저,2023','bad,현대자동차(주),그랜저,2023','2025-01-02,현대자동차(주),그랜저,']);assert.equal(i.sources.reports.held_rows,3);assert.equal(i.sources.reports.rows,4);});
test('model year and received month cross counts remain consistent', () => {const i=make(['2025-01-02,현대자동차(주),그랜저(GRANDEUR),2023','2025-02-01,현대자동차(주),그랜저(GRANDEUR),2023','2025-02-02,현대자동차(주),그랜저(GRANDEUR),2024']);const f=i.families.find(f=>f.family_id==='hyundai-grandeur');assert.deepEqual(f.by_model_year,[{year:2023,count:2},{year:2024,count:1}]);assert.equal(f.reports.filter(r=>r.model_year===2023&&r.received_month==='2025-02').reduce((a,r)=>a+r.count,0),1);});
test('observed date range is derived from row dates, not update or filename', () => {const i=make(['2025-01-02,현대자동차(주),그랜저(GRANDEUR),2023','2025-12-31,현대자동차(주),그랜저(GRANDEUR),2024']);assert.deepEqual(i.sources.reports.period,{from:'2025-01-02',to:'2025-12-31',basis:'received_date'});assert.equal(i.sources.reports.declared_period,null);assert.equal(i.sources.reports.coverage_status,'observed_only');});
test('unavailable data is not a verified zero count dataset', () => {const i=buildIndex({families, aliases, snapshots:{},manifests});assert.equal(i.sources.reports.available,false);assert.equal(i.sources.reports.coverage_status,'unavailable');assert.equal(i.sources.reports.sha256,null);});
test('a repeated unchanged check keeps the public content snapshot stable', () => {const lines=['2025-01-02,현대자동차(주),그랜저(GRANDEUR),2023'];const i=make(lines);const later=make(lines,{previous:i,manifests:{...manifests,reports:{...manifests.reports,sha256:i.sources.reports.sha256,checked_at:'2026-10-15T00:00:00Z'}}});assert.deepEqual(later,i);});
test('ambiguous reviewed aliases fail instead of double counting', () => {assert.throws(()=>validateAliases({...aliases,entries:[...aliases.entries,{...aliases.entries[0],family_id:'kia-k8'}]},families));});
test('large source row loss or growth requires review of the exact new hash', () => {
  const prior={rows:100,normalized:Array(100),period:{to:'2025-12-31'},sha256:'old'};
  assert.throws(()=>assertSnapshotQuality({rows:50,normalized:Array(50),period:{to:'2025-12-31'},sha256:'new'},prior));
  assert.throws(()=>assertSnapshotQuality({rows:401,normalized:Array(401),period:{to:'2025-12-31'},sha256:'new'},prior));
  assert.doesNotThrow(()=>assertSnapshotQuality({rows:50,normalized:Array(50),period:{to:'2025-12-31'},sha256:'new'},prior,[{sha256:'new',reviewed_at:'2026-10-14',evidence:'Reviewed replacement dataset period and scope'}]));
});
test('invalid-row coverage never bypasses the source guard', () => assert.throws(()=>assertSnapshotQuality({rows:100,normalized:Array(94),period:{to:'2025-12-31'},sha256:'new'},null)));
test('observed source end-date regression requires exact snapshot review', () => assert.throws(()=>assertSnapshotQuality({rows:100,normalized:Array(100),period:{to:'2025-06-30'},sha256:'new'},{rows:100,period:{to:'2025-12-31'}})));
test('immutable raw pointers reject traversal or unexpected file names', () => {assert.throws(()=>rawSnapshotPath('/tmp','reports',{raw_file:'../../secret'},path));assert.equal(rawSnapshotPath('/tmp','reports',{raw_file:'reports-'+ 'a'.repeat(64)+'.csv'},path),path.join('/tmp','raw','reports-'+ 'a'.repeat(64)+'.csv'));});
test('recall source rows keep production dates, reason and official source link', () => {const bytes=Buffer.from(SOURCE_FIELDS.recalls.join(',')+'\n현대자동차(주),그랜저(GRANDEUR),2020-01-01,2020-02-01,2025-01-02,"부품, 결함"');const snapshot={...normalizeRows(bytes,'recalls'),sha256:sha256(bytes)};const i=buildIndex({families,aliases,snapshots:{recalls:snapshot},manifests:{...manifests,recalls:{...manifests.recalls,sha256:snapshot.sha256}}});const r=i.families.find(f=>f.family_id==='hyundai-grandeur').historical_recalls[0];assert.equal(r.reason,'부품, 결함');assert.equal(r.production_from,'2020-01-01');assert.equal(r.source_url,manifests.recalls.source_url);});

test('collector preserves last good raw data and records failure without exposing a bad response', () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'peekmycar-official-issues-'));
  try {
    const sources={schema_version:1,...manifests};fs.writeFileSync(path.join(temp,'sources.json'),JSON.stringify(sources));
    const mock=path.join(temp,'mock.mjs');
    const report=fixture(['2025-01-02,현대자동차(주),그랜저(GRANDEUR),2023']).toString();
    const recall=SOURCE_FIELDS.recalls.join(',')+'\n현대자동차(주),그랜저(GRANDEUR),2020-01-01,2020-02-01,2025-01-02,부품 결함';
    fs.writeFileSync(mock,`globalThis.fetch=async u=>{u=String(u);if(process.env.FAKE_FAIL==='1')return new Response('<html>temporary failure</html>',{status:200});if(u.includes('fileData.do')){const id=u.includes('15016450')?'15016450':'3048950';return new Response('<script type="application/ld+json">'+JSON.stringify({'@type':'Dataset',url:'https://www.data.go.kr/data/'+id+'/fileData.do',dateModified:'2026-10-01',distribution:[{encodingFormat:'CSV',contentUrl:'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_'+id+'&fileDetailSn=1'}]})+'</script>');}return new Response(u.includes('15016450')?${JSON.stringify(report)}:${JSON.stringify(recall)});};`);
    const script=fileURLToPath(new URL('./fetch-official-issues.mjs',import.meta.url));
    const env={...process.env,OFFICIAL_ISSUES_DATA_DIR:temp,OFFICIAL_ISSUES_STATUS_FILE:path.join(temp,'status.json')};
    const good=spawnSync(process.execPath,['--import',pathToFileURL(mock).href,script],{env,encoding:'utf8'});assert.equal(good.status,0,good.stderr);
    const manifest=JSON.parse(fs.readFileSync(path.join(temp,'source-manifest.json')));const rawPath=rawSnapshotPath(temp,'reports',manifest.sources.reports,path);const before=fs.readFileSync(rawPath);
    const bad=spawnSync(process.execPath,['--import',pathToFileURL(mock).href,script],{env:{...env,FAKE_FAIL:'1'},encoding:'utf8'});assert.equal(bad.status,1);assert.deepEqual(fs.readFileSync(rawPath),before);
    assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'source-manifest.json'))).sources.reports.raw_file,manifest.sources.reports.raw_file);
    const status=JSON.parse(fs.readFileSync(path.join(temp,'status.json')));assert.equal(status.ok,false);assert.equal(status.source_states.reports.available,true);assert.equal(status.source_states.reports.last_successful_at,manifest.sources.reports.last_successful_at);
  } finally {
    const resolved=path.resolve(temp);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('peekmycar-official-issues-'));fs.rmSync(resolved,{recursive:true,force:true});
  }
});

test('offline build never replaces an available index when its manifest or raw snapshot is missing', () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'peekmycar-official-issues-'));
  try {
    fs.writeFileSync(path.join(temp,'sources.json'),JSON.stringify({schema_version:1,...manifests}));
    const indexFile=path.join(temp,'index.json'),original=JSON.stringify({sources:{reports:{available:true}}});fs.writeFileSync(indexFile,original);
    fs.writeFileSync(path.join(temp,'source-manifest.json'),JSON.stringify({sources:{reports:{...manifests.reports,available:true,raw_file:'reports-'+'a'.repeat(64)+'.csv'}}}));
    const script=fileURLToPath(new URL('./build-official-issues-index.mjs',import.meta.url));const env={...process.env,OFFICIAL_ISSUES_DATA_DIR:temp,OFFICIAL_ISSUES_INDEX_FILE:indexFile};
    assert.notEqual(spawnSync(process.execPath,[script],{env,encoding:'utf8'}).status,0);assert.equal(fs.readFileSync(indexFile,'utf8'),original);
    fs.writeFileSync(path.join(temp,'source-manifest.json'),JSON.stringify({sources:{}}));
    assert.notEqual(spawnSync(process.execPath,[script],{env,encoding:'utf8'}).status,0);assert.equal(fs.readFileSync(indexFile,'utf8'),original);
  } finally {const resolved=path.resolve(temp);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('peekmycar-official-issues-'));fs.rmSync(resolved,{recursive:true,force:true});}
});

test('validator rejects incorrect model-year partitions even when every grand total matches', () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'peekmycar-official-issues-'));
  try {
    const bytes=fixture(['2025-01-02,현대자동차(주),그랜저(GRANDEUR),2023']);
    const i=make(['2025-01-02,현대자동차(주),그랜저(GRANDEUR),2023']);
    fs.mkdirSync(path.join(temp,'raw'));fs.writeFileSync(path.join(temp,'raw/reports.csv'),bytes);
    fs.writeFileSync(path.join(temp,'aliases-reviewed.json'),JSON.stringify(aliases));
    fs.writeFileSync(path.join(temp,'source-manifest.json'),JSON.stringify({sources:{...manifests,reports:{...manifests.reports,sha256:sha256(bytes),available:true}}}));
    const indexFile=path.join(temp,'index.json'),catalogFile=path.join(temp,'catalog.json');fs.writeFileSync(catalogFile,JSON.stringify({families}));fs.writeFileSync(indexFile,JSON.stringify(i));
    const script=fileURLToPath(new URL('./validate-official-issues.mjs',import.meta.url));const env={...process.env,OFFICIAL_ISSUES_DATA_DIR:temp,OFFICIAL_ISSUES_INDEX_FILE:indexFile,OFFICIAL_ISSUES_CATALOG_FILE:catalogFile};
    const good=spawnSync(process.execPath,[script],{env,encoding:'utf8'});assert.equal(good.status,0,good.stderr);
    i.families.find(f=>f.family_id==='hyundai-grandeur').by_model_year[0].year=2022;fs.writeFileSync(indexFile,JSON.stringify(i));
    assert.notEqual(spawnSync(process.execPath,[script],{env,encoding:'utf8'}).status,0);
  } finally {const resolved=path.resolve(temp);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('peekmycar-official-issues-'));fs.rmSync(resolved,{recursive:true,force:true});}
});
