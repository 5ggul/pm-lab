(function(root){
  function cameraLabel(raw){
    const text=String(raw||'');
    if(!/빌트인\s*캠|builtin\s*cam/i.test(text))return '';
    const absent=/(?:빌트인\s*캠|builtin\s*cam)\s*(?:[:：=(_-]\s*)*(?:off|x|무|없음|미장착|미적용|비장착|제외|미탑재|미설치|비적용)(?=$|[^a-z])/i.test(text);
    return absent?'캠 없음':'빌트인 캠';
  }
  function optionLabel(row){
    const fuel={gasoline:'휘발유',diesel:'경유',lpg:'LPG',hybrid:'하이브리드',phev:'플러그인 하이브리드',electric:'전기',hydrogen:'수소'}[row.powertrain]||'';
    const unit=row.powertrain==='electric'||row.powertrain==='phev'&&Number(row.combined_efficiency)>0&&Number(row.combined_efficiency)<7?'km/kWh':row.powertrain==='hydrogen'?'km/kg':'km/L';
    const efficiency=row.combined_efficiency==null?'효율 없음':`${row.combined_efficiency} ${unit}`;
    const name=String(row.raw_model||row.family_name||'신고 사양')
      .replace(/(\d(?:\.\d)?)T[-_]?GDI/gi,'$1 터보 직분사')
      .replace(/GDI/gi,'직분사')
      .replace(/(\d)DCT/gi,'$1단 DCT')
      .replace(/빌트인\s*캠\s*(?:Off|미적용|미장착|비장착|제외)/gi,'캠 없음');
    return [name,fuel,efficiency].filter(Boolean).join(' · ');
  }
  function optionLabels(rows){
    const labels=rows.map(optionLabel);
    function disambiguate(extra){
      const counts=new Map();
      labels.forEach(label=>counts.set(label,(counts.get(label)||0)+1));
      labels.forEach((label,index)=>{if(counts.get(label)>1)labels[index]+=' · '+extra(rows[index],index)});
    }
    disambiguate(row=>`도심 ${row.city_efficiency??'—'} · 고속 ${row.highway_efficiency??'—'}`);
    disambiguate(row=>`${row.displacement_cc??'—'}cc · ${row.type||'유형 미표기'} · ${row.range_km??'—'}km`);
    disambiguate(row=>`자료 행 #${String(row.calc_id||'').split(':').pop()}`);
    return labels;
  }
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  root.CAR_SPEC_LABELS=Object.freeze({cameraLabel,optionLabel,optionLabels,escapeHtml});
})(globalThis);
