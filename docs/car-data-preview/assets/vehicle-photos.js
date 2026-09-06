const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const manifestUrl=new URL('../data/vehicle-image-sources.json',import.meta.url);
let pending;
export function loadPhotos(){
  return pending??=fetch(manifestUrl,{signal:AbortSignal.timeout(4000)})
    .then(r=>{if(!r.ok)throw new Error('photos');return r.json()})
    .then(d=>new Map((d.records||[]).map(r=>[r.family_id,r])))
    .catch(()=>new Map());
}
export function photoMarkup(f,record,detail=false){
  const placeholder='<div class="vehicle-card-photo-placeholder" aria-hidden="true"></div>';
  if(!record)return `<figure class="vehicle-photo vehicle-photo-empty${detail?' family-photo':''}"><div class="vehicle-card-media">${placeholder}</div><figcaption>차량 사진 준비 중</figcaption></figure>`;
  const src=record.image_url;
  return `<figure class="vehicle-photo${detail?' family-photo':''}" data-photo-family="${esc(f.family_id)}"><div class="vehicle-card-media">${placeholder}<img src="${esc(src)}" alt="${esc(f.family_name)} ${esc(record.generation)} 차량 사진" width="${record.width}" height="${record.height}" loading="${detail?'eager':'lazy'}" decoding="async"></div><figcaption><span class="vehicle-photo-generation">사진: ${esc(record.generation)}</span><a class="vehicle-card-credit" href="${esc(record.source_page)}" target="_blank" rel="noopener noreferrer">${esc(record.author)} · ${esc(record.license)}</a> · <a class="vehicle-photo-license" href="${esc(record.license_url)}" target="_blank" rel="noopener noreferrer">이용 조건</a><span class="vehicle-photo-note">${esc(record.display_note||'사진의 연식·트림은 세부 사양과 다를 수 있습니다.')}</span></figcaption></figure>`;
}
export function bindPhotoFallback(host){
  host.addEventListener('error',e=>{
    if(e.target.matches?.('.vehicle-photo img')){e.target.hidden=true;e.target.closest('figure').dataset.photoError='true';}
  },true);
}
export function installPhotoStyles(){
  if(document.getElementById('vehiclePhotoStyle'))return;
  const style=document.createElement('style');style.id='vehiclePhotoStyle';
  style.textContent=`
    .vehicle-photo{margin:0;min-width:0}.vehicle-photo .vehicle-card-media{position:relative;aspect-ratio:16/9;background:#f0f2f4;overflow:hidden;border-bottom:1px solid #ddd}
    .vehicle-photo .vehicle-card-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block}.vehicle-photo img[hidden]{display:none!important}
    .vehicle-card .vehicle-photo-empty .vehicle-card-media{height:76px;aspect-ratio:auto}.vehicle-card .vehicle-photo-empty figcaption{padding:6px 12px}
    .vehicle-photo .vehicle-card-photo-placeholder{height:100%;background:linear-gradient(160deg,#f7f7f7,#eceff1)}
    .vehicle-photo figcaption{padding:8px 12px;font-size:11px;line-height:1.5;color:#666;overflow-wrap:anywhere}
    .vehicle-photo .vehicle-card-credit{position:static;display:inline;width:auto;max-width:none;padding:0;background:none;font-size:11px;color:#555;white-space:normal;overflow:visible;text-decoration:underline}
    .vehicle-photo-license{color:#555}.vehicle-photo-generation,.vehicle-photo-note{display:block}.vehicle-photo-note{font-size:10px;color:#777}
    .family-head.has-photo{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;align-items:start}.family-heading{min-width:0}.family-photo .vehicle-card-media{height:155px;aspect-ratio:auto}.family-photo figcaption{height:100px;box-sizing:border-box;overflow:auto}
    @media(max-width:700px){.family-head.has-photo{grid-template-columns:minmax(0,1fr);gap:12px}.family-photo .vehicle-card-media{height:145px}.family-photo figcaption{height:100px}.vehicle-photo figcaption a{display:inline-flex;align-items:center;min-height:44px}.family-photo figcaption a{min-height:24px}.family-photo .vehicle-photo-note{font-size:10px}}
  `;
  document.head.appendChild(style);
}
