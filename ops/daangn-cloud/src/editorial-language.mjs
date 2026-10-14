/** Display labels only. Source evidence, dates and amounts remain unchanged. */
export function publicCondition(value) {
  return String(value ?? '').replace(/(^|\n|\s)(?:기재된\s*기한|행사\s*종료)\s*:?\s*(?=\d{1,4}[-/.])/g, '$1할인 기한: ');
}
export function publicDealBody(value) {
  return publicCondition(value).replace(/\s*다른 판매처의 최저가를 확인한 정보는 아닙니다\./g, '').trim();
}
export function editorialWordingFailures(item) {
  const body = String(item?.postBody || '');
  if (item?.copyContext?.kind !== 'hotdeal') return [];
  const errors = [];
  if (/기재된\s*기한/.test(body) || /행사\s*종료\s*:?\s*\d/.test(body)) errors.push('DEADLINE_LABEL_NOT_UPDATED');
  if (body.includes('다른 판매처의 최저가를 확인한 정보는 아닙니다.')) errors.push('REMOVED_EDITORIAL_SENTENCE');
  return errors;
}
