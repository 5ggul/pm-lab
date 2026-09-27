(function(){
  const shardPromises=new Map();
  function familyKey(f){return f?.family_id||`raw:${f?.fallback_catalog_id||''}`}
  async function load(url){
    const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('계산 데이터 목록을 불러오지 못했습니다.');
    const data=await response.json();
    Object.defineProperties(data,{_bootstrapUrl:{value:new URL(url,location.href)},_loadedShards:{value:new Set()},_rowIds:{value:new Set((data.rows||[]).map(r=>r.calc_id))}});
    return data;
  }
  async function ensureFamily(data,family){
    const key=familyKey(family),shard=data?.family_shards?.[key];if(!shard)return [];
    if(!data._loadedShards.has(shard)){
      const url=new URL(`all-car-calc-shards/${shard}.json`,data._bootstrapUrl);
      if(!shardPromises.has(url.href))shardPromises.set(url.href,fetch(url,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('차량 사양을 불러오지 못했습니다.');return r.json()}));
      let payload;
      try {payload=await shardPromises.get(url.href)} catch(error) {
        shardPromises.delete(url.href);
        throw error;
      }
      for(const row of payload.rows||[]){const existing=data.rows.find(item=>item.calc_id===row.calc_id);if(existing)Object.assign(existing,row);else{data.rows.push(row);data._rowIds.add(row.calc_id)}}
      data._loadedShards.add(shard);
    }
    return data.rows.filter(r=>(family.family_id&&r.family_id===family.family_id)||(!family.family_id&&r.catalog_id===family.fallback_catalog_id));
  }
  async function ensureCalc(data,calcId){
    const key=data?.calc_families?.[calcId];if(!key)return null;
    const family=data.families.find(f=>familyKey(f)===key);if(!family)return null;
    await ensureFamily(data,family);return data.rows.find(r=>r.calc_id===calcId)||null;
  }
  window.CAR_CALC_LOADER={load,ensureFamily,ensureCalc,familyKey};
})();
