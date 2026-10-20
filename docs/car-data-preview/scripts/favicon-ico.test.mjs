import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createFaviconIco} from './favicon-ico.mjs';
const brand=fs.readFileSync(new URL('../assets/brand/favicon-96.png',import.meta.url));
test('default favicon is a valid ICO containing the exact existing brand PNG',()=>{
  const ico=createFaviconIco(brand);
  assert.equal(ico.readUInt16LE(0),0);assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),1);
  assert.equal(ico[6],96);assert.equal(ico[7],96);
  assert.equal(ico.readUInt32LE(14),brand.length);assert.equal(ico.readUInt32LE(18),22);
  assert.deepEqual(ico.subarray(22),brand);
});
test('HTML errors and unsupported image dimensions cannot become a favicon',()=>{
  assert.throws(()=>createFaviconIco(Buffer.from('<!doctype html>Not found')));
  for(const [width,height] of [[0,0],[128,96],[257,257]]) {
    const invalid=Buffer.from(brand);invalid.writeUInt32BE(width,16);invalid.writeUInt32BE(height,20);
    assert.throws(()=>createFaviconIco(invalid));
  }
});
