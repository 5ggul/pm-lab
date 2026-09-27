import type { GameCode } from "./queries";

const checkedAt = "2026-09-27T06:20:00.000Z";

const VERIFIED_EDITORIAL_CODES: GameCode[] = [
  {
    id: "verified-editorial-code:1176784616:2MILLION",
    universe_id: 1176784616,
    code: "2MILLION",
    reward_text: "Mercenary Pursuit 스킨",
    code_status: "active",
    visibility: "published",
    source_id: "editorial-source:tower-defense-simulator",
    review_status: "approved",
    reviewed_at: checkedAt,
    reviewed_by: null,
    review_note: "Roblox 공식 게임 설명에서 2026-09-27 다시 확인한 검증 코드 · Mercenary Pursuit 스킨 보상",
    verified_at: checkedAt,
    last_checked_at: checkedAt,
    expires_at: null,
    notes: "Tower Defense Simulator Roblox 공식 설명에 'Use code 2MILLION for a free Mercenary Pursuit skin!' 문구가 2026-09-27에도 확인됨.",
    created_at: checkedAt,
    updated_at: checkedAt,
  },
];

export function getVerifiedEditorialCodes(universeId?: number) {
  return VERIFIED_EDITORIAL_CODES.filter(
    (code) => universeId == null || Number(code.universe_id) === universeId,
  );
}
