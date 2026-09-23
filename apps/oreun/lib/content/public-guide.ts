const META_SENTENCE = /(?:이 가이드|이 페이지|별도 검증|임의로|단정하지|만들지 않습니다|추정하지|검증되지|확인되지 않기 때문에|고정 정보로|공식 설명만으로|자동으로 채우)/;

export function publicGuideParagraphs(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .trim()
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => sentence.trim() && !META_SENTENCE.test(sentence))
        .join(" ")
        .trim(),
    )
    .filter((paragraph) => paragraph.length >= 20);
}

export function publicGuideExcerpt(body: string, fallback: string) {
  return publicGuideParagraphs(body)[0] ?? fallback;
}
