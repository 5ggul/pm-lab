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
  if(!record)return `<figure class="vehicle-photo vehicle-photo-empty${detail?' family-photo':''}"><div class="vehicle-card-media"><div class="vehicle-card-photo-placeholder"><span>${esc(maker.slice(0,2))}</span><small>대표 사진 없음</small></div></div>${detail?'<figcaption>확인된 대표 사진 없음. 사양은 아래 표에서 확인할 수 있습니다.</figcaption>':''}</figure>`;
  const src=record.image_url;
  const modelName=String(f.family_name||'차량').trim();
  const generation=String(record.generation||'').trim();
  const photoAlt=`${modelName}${generation&&!modelName.toLocaleLowerCase().includes(generation.toLocaleLowerCase())?' '+generation:''} 차량 사진`;
  const variants=record.optimized?.files||[];
  const pictureStart=variants.length?`<picture data-optimized-photo="true"><source type="image/webp" srcset="${variants.map(f=>new URL("../"+f.path,import.meta.url).href+" "+f.width+"w").join(", ")}" sizes="${detail?"(max-width:700px) 92vw, 300px":"(max-width:700px) 92vw, (max-width:1000px) 65vw, 540px"}">`:"";
  const attribution=`<span class="vehicle-photo-generation">사진: ${esc(record.generation)}</span><a class="vehicle-card-credit" href="${esc(record.source_page)}" target="_blank" rel="noopener noreferrer">${esc(record.author)} · ${esc(record.license)}</a> · <a class="vehicle-photo-license" href="${esc(record.license_url)}" target="_blank" rel="noopener noreferrer">이용 조건</a><span class="vehicle-photo-note">${esc(record.display_note||'연식·트림에 따라 외관 차이')}</span>`;
  return `<figure class="vehicle-photo${detail?' family-photo':''}" data-photo-family="${esc(f.family_id)}"><div class="vehicle-card-media">${placeholder}${pictureStart}<img src="${esc(src)}" alt="${esc(photoAlt)}" width="${record.width}" height="${record.height}" loading="${detail||priority?'eager':'lazy'}" fetchpriority="${detail||priority?'high':'low'}" decoding="async">${variants.length?"</picture>":""}</div>${detail?`<figcaption>${attribution}</figcaption>`:''}</figure>`;
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
export function installPhotoStyles(){}
