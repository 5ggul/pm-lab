import fs from 'node:fs';
const marker='/* shard-load-recovery */';
for(const [route,code] of [
  ['compare/',`gEl.innerHTML='<option value="">불러오는 중</option>';rEl.innerHTML='<option value="">—</option>';if(mode==='all')clearComparison('차량 사양을 불러오는 중입니다.');try{await CAR_CALC_LOADER.ensureFamily(allData,f)}catch(error){if(mode==='all'&&familyByInput(side==='A'?familyA:familyB)===f)clearComparison('차량 사양을 불러오지 못했습니다. 차량을 다시 선택하세요.');return}`],
  ['tools/annual-cost/',`generation.innerHTML='<option value="">불러오는 중</option>';sourceRow.innerHTML='<option value="">—</option>';if(mode==='all')renderAllEmpty('차량 사양을 불러오는 중입니다.');try{await CAR_CALC_LOADER.ensureFamily(allData,f)}catch(error){if(mode==='all'&&familyByInput()===f)renderAllEmpty('차량 사양을 불러오지 못했습니다. 차량을 다시 선택하세요.');return}`]
]) {
  const file=new URL('../'+route+'index.html',import.meta.url);
  let html=fs.readFileSync(file,'utf8');
  if(html.includes(marker))continue;
  const needle='await CAR_CALC_LOADER.ensureFamily(allData,f);';
  if(!html.includes(needle))throw new Error(`${route}: shard initialization changed; update recovery patch`);
  fs.writeFileSync(file,html.replace(needle,marker+code));
}
