const GUIDE_TYPE_LABELS: Record<string, string> = {
  beginner: "입문",
  mechanic: "조작·규칙",
  progression: "성장",
  troubleshooting: "문제 해결",
  faq: "FAQ",
  guide: "일반",
};

export function getGuideTypeLabel(type: string) {
  return GUIDE_TYPE_LABELS[type] ?? "가이드";
}
