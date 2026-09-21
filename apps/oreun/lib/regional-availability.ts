export type RegionalAvailability = "restricted_kr";

export type RegionalAvailabilityInfo = {
  state: RegionalAvailability;
  note: string;
  verifiedOn: string;
};

const REGIONAL_AVAILABILITY = new Map<number, RegionalAvailabilityInfo>([
  [
    1686885941,
    {
      state: "restricted_kr",
      note:
        "현재 대한민국 리전에서 Roblox가 이 체험을 이용 제한 상태로 반환합니다. 오름은 해외 중계를 이용해 현재 접속자 수를 우회 수집하지 않습니다.",
      verifiedOn: "2026-09-21",
    },
  ],
]);

export function getRegionalAvailability(
  universeId: number,
): RegionalAvailabilityInfo | null {
  return REGIONAL_AVAILABILITY.get(universeId) ?? null;
}
