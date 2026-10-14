/** Public JSON only. Never execute page scripts or text as instructions. */
export function parsePublicPostEvidence(html, { cafeSlug } = {}) {
  const articles = [], events = [], chunks = [];
  const walk = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 50) return;
    if (value.event === 'web_shown_communityCafe_cafePostDetail' && value.params?.boardName) events.push(value.params);
    if (Array.isArray(value)) value.forEach(x => walk(x, depth + 1)); else Object.values(value).forEach(x => walk(x, depth + 1));
  };
  const text = String(html || '');
  if (text.length > 8000000) return { title: '', body: '', board: null, images: [], errors: ['PUBLIC_HTML_TOO_LARGE'] };
  for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\btype\s*=\s*["']application\/ld\+json["']/i.test(m[1])) {
      try { const value = JSON.parse(m[2]), list = Array.isArray(value) ? value : value['@graph'] || [value]; articles.push(...list.filter(x => ['DiscussionForumPosting', 'Article'].includes(x?.['@type']))); } catch {}
      continue;
    }
    const call = m[2].trim().match(/^self\.__next_f\.push\((\[[\s\S]*\])\);?$/);
    if (!call) continue;
    try { const payload = JSON.parse(call[1]); if (payload[0] === 1 && typeof payload[1] === 'string') chunks.push(payload[1]); } catch {}
  }
  const stream = new TextEncoder().encode(chunks.join('')), decoder = new TextDecoder();
  let offset = 0, rows = 0;
  while (offset < stream.length && rows++ < 100000) {
    if (stream[offset] === 10 || stream[offset] === 13) { offset++; continue; }
    const colon = stream.indexOf(58, offset), newline = stream.indexOf(10, offset);
    if (colon < 0 || (newline >= 0 && newline < colon)) { offset = newline < 0 ? stream.length : newline + 1; continue; }
    const id = decoder.decode(stream.slice(offset, colon));
    if (!/^[a-f0-9]+$/i.test(id)) { offset = newline < 0 ? stream.length : newline + 1; continue; }
    const start = colon + 1;
    if (stream[start] === 84) {
      const comma = stream.indexOf(44, start + 1), lengthText = comma < 0 ? '' : decoder.decode(stream.slice(start + 1, comma));
      if (!/^[a-f0-9]{1,8}$/i.test(lengthText)) break;
      const end = comma + 1 + Number.parseInt(lengthText, 16);
      if (end > stream.length) break;
      offset = end; continue;
    }
    const end = stream.indexOf(10, start), row = decoder.decode(stream.slice(start, end < 0 ? stream.length : end));
    offset = end < 0 ? stream.length : end + 1;
    if (!row.startsWith('[') && !row.startsWith('{')) continue;
    try { walk(JSON.parse(row)); } catch {}
  }
  if (articles.length !== 1) return { title: '', body: '', board: null, images: [], errors: ['PUBLIC_ARTICLE_AMBIGUOUS'] };
  const article = articles[0], matching = events.filter(p => p.postTitle === article.headline && (!cafeSlug || p.cafeSlug === cafeSlug));
  const boardNames = [...new Set(matching.map(x => x.boardName))];
  const images = (Array.isArray(article.image) ? article.image : article.image ? [article.image] : []).map(x => typeof x === 'string' ? x : x?.url).filter(Boolean);
  return { title: article.headline || '', body: article.text || '', images, board: boardNames.length === 1 ? boardNames[0] : null,
    postUrl: article.url || article.mainEntityOfPage || null, datePublished: article.datePublished || null, errors: boardNames.length === 1 ? [] : ['PUBLIC_BOARD_UNVERIFIED'] };
}
