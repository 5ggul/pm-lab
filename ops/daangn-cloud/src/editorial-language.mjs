/** Display labels only. Source evidence, dates and amounts remain unchanged. */
export function publicCondition(value) {
  return String(value ?? '').replace(/(^|\n|\s)(?:기재된\s*기한|행사\s*종료)\s*:?\s*(?=\d{1,4}[-/.])/g, '$1할인 기한: ');
}

function dedupeExactSentences(value) {
  const seen = new Set();
  const paragraphs = String(value || '')
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);

  const output = [];
  for (const paragraph of paragraphs) {
    if (/^https?:\/\//i.test(paragraph)) {
      if (!seen.has(paragraph)) {
        seen.add(paragraph);
        output.push(paragraph);
      }
      continue;
    }

    const sentences = paragraph
      .split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(Boolean);
    const kept = [];
    for (const sentence of sentences) {
      const key = sentence.replace(/\s+/g, ' ');
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(sentence);
    }
    if (kept.length) output.push(kept.join(' '));
  }
  return output.join('\n\n');
}

export function publicDealBody(value) {
  const cleaned = publicCondition(value)
    .replace(/\s*다른 판매처의 최저가를 확인한 정보는 아닙니다\./g, '')
    .trim();
  return dedupeExactSentences(cleaned);
}

export function editorialWordingFailures(item) {
  const body = String(item?.postBody || '');
  if (item?.copyContext?.kind !== 'hotdeal') return [];
  const errors = [];
  if (/기재된\s*기한/.test(body) || /행사\s*종료\s*:?\s*\d/.test(body)) errors.push('DEADLINE_LABEL_NOT_UPDATED');
  if (body.includes('다른 판매처의 최저가를 확인한 정보는 아닙니다.')) errors.push('REMOVED_EDITORIAL_SENTENCE');
  return errors;
}
