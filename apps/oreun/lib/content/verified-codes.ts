import type { GameCode } from "./queries";

const checkedAt = "2026-09-25T05:00:00.000Z";

const VERIFIED_PREVIEW_CODES: GameCode[] = [
  {
    id: "verified-preview-code:1176784616:2MILLION",
    universe_id: 1176784616,
    code: "2MILLION",
    reward_text: "Mercenary Pursuit 스킨",
    code_status: "active",
    visibility: "published",
    source_id: "editorial-source:tower-defense-simulator",
    review_status: "approved",
    reviewed_at: checkedAt,
    reviewed_by: null,
    review_note: "Roblox 공식 게임 설명에서 2026-09-25 직접 확인한 Preview 검증 코드 · Mercenary Pursuit 스킨 보상",
    verified_at: checkedAt,
    last_checked_at: checkedAt,
    expires_at: null,
    notes: "Tower Defense Simulator Roblox 공식 설명에 'use code 2MILLION for a free Mercenary Pursuit skin!'로 안내됨.",
    created_at: checkedAt,
    updated_at: checkedAt,
  },
];

export function getVerifiedPreviewCodes(universeId?: number) {
  if (process.env.R1_PREVIEW_NO_INDEX === "0") return [] as GameCode[];
  return VERIFIED_PREVIEW_CODES.filter(
    (code) => universeId == null || Number(code.universe_id) === universeId,
  );
}
