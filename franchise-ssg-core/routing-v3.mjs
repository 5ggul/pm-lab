export * from './routing.mjs';
import {BRAND_SLUGS} from './routing.mjs';

export function brandSlugFor(name, fallback='brand'){
  if(BRAND_SLUGS[name]) return BRAND_SLUGS[name];
  const slug=String(name??'')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/&/g,'-')
    .replace(/[·ㆍ/＋+]/g,'-')
    .replace(/['’"“”]/g,'')
    .replace(/[^0-9a-z가-힣]+/g,'-')
    .replace(/-{2,}/g,'-')
    .replace(/^-|-$/g,'');
  return slug || String(fallback||'brand').toLowerCase();
}
