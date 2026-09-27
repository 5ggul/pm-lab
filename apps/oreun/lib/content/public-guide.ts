// Formatting only. Editorial meaning is corrected in the source, not deleted
// by substring/length filters. Short controls and warnings remain intact.
export function publicGuideParagraphs(body: string) {
  return body.split(/\r?\n\s*\r?\n/).map(paragraph => paragraph.trim()).filter(Boolean);
}
export function publicGuideExcerpt(body: string, fallback: string) {
  return publicGuideParagraphs(body)[0] ?? fallback;
}

export function isActionablePublicGuide(guide: { guide_type: string; body: string }) {
  const paragraphs = publicGuideParagraphs(guide.body);
  const length = guide.body.replace(/\s+/g, " ").trim().length;
  if (guide.guide_type === "mechanic") return paragraphs.length >= 3 && length >= 220;
  if (guide.guide_type === "troubleshooting" || guide.guide_type === "faq") return paragraphs.length >= 3 && length >= 260;
  return paragraphs.length >= 4 && length >= 360;
}
