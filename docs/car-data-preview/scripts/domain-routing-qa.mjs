import assert from 'node:assert/strict';
import fs from 'node:fs';
import {host404} from './build-host-404.mjs';
import {siteConfig} from './site-config.mjs';

for (const base of ['https://example.invalid/','https://example.invalid/pm-lab/car-data-preview/']) {
  const html=host404(base);
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const resolved=new URL(match[1],new URL('cars/missing/deep/',base));
    assert(resolved.href.startsWith(base),`${resolved.href} escaped ${base}`);
    assert(!resolved.pathname.includes('missing'),'404 links must ignore the missing route');
  }
  assert(html.includes(`href="${new URL(base).pathname}cars/"`));
}
assert.equal(fs.readFileSync(new URL('../../404.html',import.meta.url),'utf8').replaceAll('\r\n','\n'),host404(siteConfig.baseUrl));
console.log('Domain routing QA PASS: root and nested mounts, missing-path recovery, generated host 404');
