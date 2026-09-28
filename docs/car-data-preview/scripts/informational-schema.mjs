// Indexed pages describe vehicles; they do not sell them or publish ratings.
// Vehicle inherits Product, so use a generic subject on the public release.
const productTypes = new Set(['Vehicle', 'Car', 'Product']);
const typeName = value => String(value).replace(/^https?:\/\/schema\.org\//, '');
export function isProductSubject(node) {
 return !!node && typeof node === 'object' && [node['@type']].flat().some(t => productTypes.has(typeName(t)));
}

export function informationalSchema(value) {
 if (Array.isArray(value)) return value.map(informationalSchema);
 if (!value || typeof value !== 'object') return value;
 if (isProductSubject(value)) {
  const result = {'@type': 'Thing'};
  for (const key of ['@context', '@id', 'name', 'url', 'image', 'sameAs', 'identifier', 'alternateName']) {
   if (value[key] !== undefined) result[key] = informationalSchema(value[key]);
  }
  const facts = [value.description, value.vehicleConfiguration];
  for (const property of [value.additionalProperty ?? []].flat()) {
   if (property && property.name && property.value !== undefined) facts.push(`${property.name}: ${property.value}${property.unitText ? ' ' + property.unitText : ''}`);
  }
  if (facts.filter(Boolean).length) result.description = facts.filter(Boolean).join(' · ');
  return result;
 }
 return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, informationalSchema(child)]));
}

export function normalizeInformationalHtml(html) {
 return html.replace(/(<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script\s*>)/gi,
  (_, open, json, close) => open + JSON.stringify(informationalSchema(JSON.parse(json))).replace(/</g, '\\u003c') + close);
}

export function assertInformationalSchema(value) {
 if (!value || typeof value !== 'object') return;
 if (isProductSubject(value)) throw new Error('Informational production page must not declare a Product/Vehicle/Car subject');
 for (const child of Object.values(value)) assertInformationalSchema(child);
}
