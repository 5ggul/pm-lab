/** Display labels only. Source evidence, dates and amounts remain unchanged. */
export function publicCondition(value) {
  return String(value ?? '').replace(/(^|\n|\s)(?:기재된\s*기한|행사\s*종료)\s*:?\s*(?=\d{1,4}[-/.])/g, '$1할인 기한: ');
}

function dedupeLine(line, seen) {
  const value = String(line || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) {
    if (seen.has(value)) return '';
    seen.add(value);
    return value;
  }

  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
  const kept = [];
  for (const sentence of sentences) {
    // Treat a sentence as the same fact whether it appears in a paragraph or
    // as a checklist bullet. Keep the first visual form and drop only the
    // repeated fact, not the surrounding layout or line breaks.
    const key = sentence.replace(/^[-•]\s*/, '').replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(sentence);
  }
  return kept.join(' ');
}

function dedupeExactSentences(value) {
  const seen = new Set();
  const paragraphs = String(value || '')
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);

  const output = [];
  for (const paragraph of paragraphs) {
    const keptLines = paragraph
      .split(/\n/)
      .map(line => dedupeLine(line, seen))
      .filter(Boolean);
    if (keptLines.length) output.push(keptLines.join('\n'));
  }
  return output.join('\n\n');
}

export function publicDealBody(value) {
  const cleaned = publicCondition(value)
    .replace(/\s*다른 판매처의 최저가를 확인한 정보는 아닙니다\./g, '')
    .trim();
  // V5+ verified-offer copy uses these explicit price labels. Restrict exact
  // sentence dedupe to that path so legacy copy rhythms are not collapsed.
  // Preserve intentional line breaks so card, checklist and Q&A layouts remain
  // visually distinct instead of being flattened into one repeated paragraph.
  return /(상품가는|쿠폰 적용가는|판매처 할인 전 표시가|배송비까지)/.test(cleaned)
    ? dedupeExactSentences(cleaned)
    : cleaned;
}

export function editorialWordingFailures(item) {
  const body = String(item?.postBody || '');
  if (item?.copyContext?.kind !== 'hotdeal') return [];
  const errors = [];
  if (/기재된\s*기한/.test(body) || /행사\s*종료\s*:?\s*\d/.test(body)) errors.push('DEADLINE_LABEL_NOT_UPDATED');
  if (body.includes('다른 판매처의 최저가를 확인한 정보는 아닙니다.')) errors.push('REMOVED_EDITORIAL_SENTENCE');
  return errors;
}
