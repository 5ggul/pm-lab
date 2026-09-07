export function sizeGeometry(a,b,view='side',layout='overlay'){
  if(!['front','side','back'].includes(view)||!['overlay','beside'].includes(layout))throw Error('Invalid view');
  const axis=view==='side'?'length_mm':'width_mm';
  for(const d of [a,b])for(const key of ['length_mm','width_mm','height_mm'])if(!Number.isFinite(d[key])||d[key]<=0)throw Error('Exact positive dimensions required');
  const scale=Math.min(760/(layout==='overlay'?Math.max(a[axis],b[axis]):a[axis]+b[axis]),250/Math.max(a.height_mm,b.height_mm));
  return {scale,axis,boxes:[a,b].map((d,i)=>{const width=d[axis]*scale,height=d.height_mm*scale;return{x:layout==='overlay'?480-width/2:i?900-width:60,y:350-height,width,height,horizontal:d[axis],vertical:d.height_mm}})};
}
export function dimensionSvg(a,b,view='side',layout='overlay',opacity=.3){
  const g=sizeGeometry(a.dimensions,b.dimensions,view,layout),colors=['#ed5555','#087dfa'];
  return `<svg viewBox="0 0 960 440" role="img" aria-label="두 차량의 ${view==='side'?'길이':'폭'}와 높이를 같은 비율로 비교한 도식"><defs><pattern id="dimensionGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#e5eaf0" stroke-width="1"/></pattern></defs><rect x="30" y="30" width="900" height="320" fill="url(#dimensionGrid)"/><path d="M30 350H930" stroke="#a8b6c5"/>${g.boxes.map((box,i)=>`<g data-size="${i?'b':'a'}"><text x="${i?905:55}" y="65" text-anchor="${i?'end':'start'}" fill="${colors[i]}" font-size="20">${i?'B':'A'} 전고 ${box.vertical.toLocaleString('ko-KR')} mm</text><rect data-envelope="${i?'b':'a'}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${colors[i]}" fill-opacity="${opacity}" stroke="${colors[i]}" stroke-width="2"/><text x="${box.x+8}" y="${box.y+25}" fill="${colors[i]}" font-size="19" font-weight="700">${i?'B':'A'}</text><path d="M${box.x} ${385+i*28}h${box.width}" stroke="${colors[i]}" stroke-width="2"/><text x="${box.x+box.width/2}" y="${379+i*28}" text-anchor="middle" fill="${colors[i]}" font-size="18">${box.horizontal.toLocaleString('ko-KR')} mm</text></g>`).join('')}</svg>`;
}
