// ICO supports a PNG payload. Keep the reviewed brand image byte-for-byte,
// including its transparency; no replacement artwork or resampling is needed.
export function createFaviconIco(input) {
  const png=Buffer.from(input);
  if(png.length<24 || png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || png.toString('ascii',12,16)!=='IHDR')throw new Error('Favicon source must be a PNG image');
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  if(width!==height || width<1 || width>256)throw new Error('Favicon source must be square and at most 256 pixels');
  const header=Buffer.alloc(22);
  header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);
  header[6]=width===256?0:width;header[7]=height===256?0:height;
  header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);
  header.writeUInt32LE(png.length,14);header.writeUInt32LE(header.length,18);
  return Buffer.concat([header,png]);
}
