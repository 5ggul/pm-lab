(function(root){
  function cameraLabel(raw){
    const text=String(raw||'');
    if(!/빌트인\s*캠|builtin\s*cam/i.test(text))return '';
    const absent=/(?:빌트인\s*캠|builtin\s*cam)\s*(?:[:：=(_-]\s*)*(?:off|x|무|없음|미장착|미적용|비장착|제외|미탑재|미설치|비적용)(?=$|[^a-z])/i.test(text);
    return absent?'캠 없음':'빌트인 캠';
  }
  root.CAR_SPEC_LABELS=Object.freeze({cameraLabel});
})(globalThis);
