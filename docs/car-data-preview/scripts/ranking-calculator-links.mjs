const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const decodeAttribute = value => value.replace(/&(?:amp|lt|gt|quot|apos|#39|#\d+|#x[0-9a-f]+);/gi, entity => {
  const named = {'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'"};
  if (named[entity.toLowerCase()] !== undefined) return named[entity.toLowerCase()];
  const number = entity.slice(2, -1);
  const code = /^x/i.test(number) ? parseInt(number.slice(1), 16) : Number(number);
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
});

function attributes(tag) {
  const result = new Map();
  for (const match of tag.matchAll(/([a-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)) {
    const key = match[1].toLowerCase();
    const values = result.get(key) ?? [];
    values.push(decodeAttribute(match[2] ?? match[3] ?? match[4]));
    result.set(key, values);
  }
  return result;
}

function oneAttribute(attrs, key) {
  const values = attrs.get(key);
  return values?.length === 1 && values[0] !== '' ? values[0] : null;
}

function hasClass(attrs, name) {
  return oneAttribute(attrs, 'class')?.split(/\s+/).includes(name) ?? false;
}

function removeOwnedLinks(article) {
  return article.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, link => {
    const opening = link.match(/^<a\b[^>]*>/i)[0];
    return hasClass(attributes(opening), 'rank-calc-link') ? '' : link;
  });
}

function insertIntoInformation(article, link) {
  const start = article.search(/<div\b[^>]*>\s*<h[23]\b/i);
  if (start < 0) return article;
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 0;
  for (let match; (match = tags.exec(article));) {
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (depth === 0) return article.slice(0, match.index) + link + article.slice(match.index);
  }
  return article;
}

/** Link only the exact, uniquely identified hybrid specification already shown in each ranking row. */
export function applyHybridRankingCalculatorLinks(html, calcIndex) {
  const byId = new Map();
  for (const row of Array.isArray(calcIndex?.rows) ? calcIndex.rows : []) {
    if (typeof row?.calc_id !== 'string' || !row.calc_id) continue;
    const matches = byId.get(row.calc_id) ?? [];
    matches.push(row);
    byId.set(row.calc_id, matches);
  }
  const articles = [...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)].filter(match => hasClass(attributes(match[0].match(/^<article\b[^>]*>/i)[0]), 'rank-row'));
  const occurrences = new Map();
  for (const match of articles) {
    const id = oneAttribute(attributes(match[0].match(/^<article\b[^>]*>/i)[0]), 'data-calc-id');
    if (id) occurrences.set(id, (occurrences.get(id) ?? 0) + 1);
  }
  const replacements = new Map();
  for (const match of articles) {
    const attrs = attributes(match[0].match(/^<article\b[^>]*>/i)[0]);
    const id = oneAttribute(attrs, 'data-calc-id');
    const family = oneAttribute(attrs, 'data-family-id');
    const source = id && byId.get(id);
    const article = removeOwnedLinks(match[0]);
    const row = source?.length === 1 ? source[0] : null;
    const eligible = id && family && occurrences.get(id) === 1 && row?.family_id === family
      && row.powertrain === 'hybrid' && row.full_cost_ready === true;
    const href = eligible ? '../../tools/annual-cost/?mode=all&calc=' + encodeURIComponent(id) : null;
    const result = href ? insertIntoInformation(article, `<a class="rank-calc-link" href="${escapeHtml(href)}">이 사양으로 계산</a>`) : article;
    replacements.set(match.index, result);
  }
  return html.replace(/<article\b[^>]*>[\s\S]*?<\/article>/gi, (article, offset) => replacements.get(offset) ?? article);
}
