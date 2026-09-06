import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const records = JSON.parse(fs.readFileSync(new URL('data/vehicle-image-sources.json', root))).records;
const families = {'grandeur-gn7':'hyundai-grandeur','sorento-mq4':'kia-sorento','avante-cn7':'hyundai-avante','k8-gl3':'kia-k8','ioniq5-ne':'hyundai-ioniq-5','ev6-cv':'kia-ev6','g80-rg3':'genesis-g80'};
export function reviewedImage(id) {
  const r = records.find(r => r.family_id === families[id]);
  if (!r) throw new Error(`Missing reviewed static photo: ${id}`);
  return {...r, url:r.image_url, source_url:r.source_page, checked_at:r.reviewed_on};
}
