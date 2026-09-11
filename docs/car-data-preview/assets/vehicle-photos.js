const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const manifestUrl=new URL('../data/vehicle-photo-index.json',import.meta.url);
let pending;
export function loadPhotos(){
  return pending??=fetch(manifestUrl,{cache:'no-cache',signal:AbortSignal.timeout(8000)})
    .then(r=>{if(!r.ok)throw new Error('photos');return r.json()})
    .then(d=>new Map((d.records||[]).map(r=>[r.family_id,r])))
    .catch(()=>new Map());
}
export function photoMarkup(f,record,detail=false,priority=false){
  const maker=String(f.maker||f.family_name||'차량').trim();
  const placeholder='<div class="vehicle-card-photo-placeholder" aria-hidden="true"></div>';
  if(!record)return `<figure class="vehicle-photo vehicle-photo-empty${detail?' family-photo':''}"><div class="vehicle-card-media"><div class="vehicle-card-photo-placeholder"><span>${esc(maker.slice(0,2))}</span><small>대표 사진 없음</small></div></div><figcaption>${esc(maker)} · 사양 정보는 차량 상세에서 확인</figcaption></figure>`;
  const src=record.image_url;
  const variants=record.optimized?.files||[];
  const pictureStart=variants.length?`<picture data-optimized-photo="true"><source type="image/webp" srcset="${variants.map(f=>new URL("../"+f.path,import.meta.url).href+" "+f.width+"w").join(", ")}" sizes="${detail?"(max-width:700px) 92vw, 300px":"(max-width:700px) 92vw, (max-width:1000px) 65vw, 540px"}">`:"";
  return `<figure class="vehicle-photo${detail?' family-photo':''}" data-photo-family="${esc(f.family_id)}"><div class="vehicle-card-media">${placeholder}${pictureStart}<img src="${esc(src)}" alt="${esc(f.family_name)} ${esc(record.generation)} 차량 사진" width="${record.width}" height="${record.height}" loading="${detail||priority?'eager':'lazy'}" fetchpriority="${detail||priority?'high':'low'}" decoding="async">${variants.length?"</picture>":""}</div><figcaption><span class="vehicle-photo-generation">사진: ${esc(record.generation)}</span><a class="vehicle-card-credit" href="${esc(record.source_page)}" target="_blank" rel="noopener noreferrer">${esc(record.author)} · ${esc(record.license)}</a> · <a class="vehicle-photo-license" href="${esc(record.license_url)}" target="_blank" rel="noopener noreferrer">이용 조건</a><span class="vehicle-photo-note">${esc(record.display_note||'연식·트림에 따라 외관 차이')}</span></figcaption></figure>`;
}
export function bindPhotoFallback(host){
  host.addEventListener('error',e=>{
    if(e.target.matches?.('.vehicle-photo img')){
      e.target.hidden=true;const figure=e.target.closest('figure');figure.dataset.photoError='true';
      const note=figure.querySelector('.vehicle-card-photo-placeholder');
      if(note){note.removeAttribute('aria-hidden');note.setAttribute('role','status');note.textContent='사진을 불러오지 못했습니다';}
    }
  },true);
}
export function installPhotoStyles(){
  if(document.getElementById('vehiclePhotoStyle'))return;
  const style=document.createElement('style');style.id='vehiclePhotoStyle';
  style.textContent=`
    .vehicle-photo{margin:0;min-width:0}.vehicle-photo .vehicle-card-media{position:relative;aspect-ratio:16/9;background:#f0f2f4;overflow:hidden;border-bottom:1px solid #ddd}
    .vehicle-photo .vehicle-card-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block}.vehicle-photo img[hidden]{display:none!important}
    .vehicle-card .vehicle-photo-empty .vehicle-card-media{height:76px;aspect-ratio:auto}.vehicle-card .vehicle-photo-empty figcaption{padding:6px 12px}
    .vehicle-photo .vehicle-card-photo-placeholder{height:100%;background:linear-gradient(145deg,#e9edf1 0%,#f7f8f9 58%,#e1e6ea 100%)}
    .vehicle-photo-empty .vehicle-card-photo-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;color:#25313d}
    .vehicle-photo-empty .vehicle-card-photo-placeholder span{display:grid;place-items:center;width:48px;height:48px;border:1px solid #aeb8c2;border-radius:50%;background:rgba(255,255,255,.72);font-size:14px;font-weight:800;letter-spacing:-.5px}
    .vehicle-photo-empty .vehicle-card-photo-placeholder small{font-size:11px;color:#68737d;letter-spacing:.02em}
    .vehicle-photo[data-photo-error] .vehicle-card-photo-placeholder{display:flex;align-items:center;justify-content:center;font-size:12px;color:#666}
    .vehicle-photo figcaption{padding:8px 12px;font-size:11px;line-height:1.5;color:#666;overflow-wrap:anywhere}
    .vehicle-photo .vehicle-card-credit{position:static;display:inline;width:auto;max-width:none;padding:0;background:none;font-size:11px;color:#555;white-space:normal;overflow:visible;text-decoration:underline}
    .vehicle-photo-license{color:#555}.vehicle-photo-generation,.vehicle-photo-note{display:block}.vehicle-photo-note{font-size:10px;color:#777}
    .family-head.has-photo{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;align-items:start}.family-heading{min-width:0}.family-photo .vehicle-card-media{height:155px;aspect-ratio:auto}.family-photo figcaption{height:100px;box-sizing:border-box;overflow:auto}
    @media(max-width:700px){.family-head.has-photo{grid-template-columns:minmax(0,1fr);gap:12px}.family-photo .vehicle-card-media{height:145px}.family-photo figcaption{height:100px}.vehicle-photo figcaption a{display:inline-flex;align-items:center;min-height:44px}.family-photo figcaption a{min-height:24px}.family-photo .vehicle-photo-note{font-size:10px}}
  `;
  document.head.appendChild(style);
}
