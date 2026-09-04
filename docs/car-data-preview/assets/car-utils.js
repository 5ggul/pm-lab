(function(){
  function fuelKey(v){
    const raw=String(v?.fuelType||v?.fuel||'').toLowerCase();
    if(['gas','gasoline','hybrid'].includes(raw)) return raw==='hybrid'?'hybrid':'gasoline';
    if(raw==='diesel') return 'diesel';
    if(raw==='lpg') return 'lpg';
    if(['electric','ev'].includes(raw)) return 'electric';
    return raw;
  }
  function getEnergyPrice(v,C){
    const k=fuelKey(v);
    if(k==='gasoline'||k==='hybrid') return Number(C?.gasPrice)||null;
    if(k==='diesel') return Number(C?.dieselPrice)||null;
    if(k==='lpg') return Number(C?.lpgPrice)||null;
    return null;
  }
  function getEnergyLabel(v){
    const k=fuelKey(v);
    return k==='gasoline'?'휘발유':k==='hybrid'?'휘발유':k==='diesel'?'경유':k==='lpg'?'LPG':k==='electric'?'전기':'에너지';
  }
  function getFuelDisplay(v){
    const k=fuelKey(v);
    return k==='gasoline'?'휘발유':k==='hybrid'?'하이브리드':k==='diesel'?'경유':k==='lpg'?'LPG':k==='electric'?'전기':'미확인';
  }
  function getEfficiencyUnit(v){return fuelKey(v)==='electric'?'km/kWh':'km/L'}
  function imageCreditHtml(meta){
    if(!meta) return '';
    const source=meta.sourceUrl||meta.source_url||'#',licenseUrl=meta.licenseUrl||meta.license_url||'#';
    const author=meta.author||'저작자',license=meta.license||'라이선스';
    return `<details class="photo-credit"><summary>사진 출처</summary><span>${author} · <a href="${source}" target="_blank" rel="noopener">원본</a> · <a href="${licenseUrl}" target="_blank" rel="noopener">${license}</a> · 화면 표시용 크롭</span></details>`;
  }
  window.CAR_UTILS={fuelKey,getEnergyPrice,getEnergyLabel,getFuelDisplay,getEfficiencyUnit,imageCreditHtml};
})();
