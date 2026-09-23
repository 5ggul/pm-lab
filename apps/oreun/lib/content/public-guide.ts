// Formatting only. Editorial meaning is corrected in the source, not deleted
// by substring/length filters. Short controls and warnings remain intact.
export function publicGuideParagraphs(body: string) {
  return body.split(/\r?\n\s*\r?\n/).map(paragraph => paragraph.trim()).filter(Boolean);
}
export function publicGuideExcerpt(body: string, fallback: string) {
  return publicGuideParagraphs(body)[0] ?? fallback;
}
