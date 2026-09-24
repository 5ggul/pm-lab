export type RisingEmptyState = {
  kind: "unavailable" | "no-rise" | "insufficient";
  message: string;
};

// Call only when the positive-momentum list is empty. An eligible declining
// game proves that the calculation ran; it does not mean data is still loading.
export function risingEmptyState(
  results: ReadonlyArray<{ eligible: boolean }>,
  readFailed = false,
): RisingEmptyState {
  if (readFailed) return {
    kind: "unavailable",
    message: "상승 정보를 불러오지 못했습니다. 잠시 뒤 다시 확인해 주세요.",
  };
  if (results.some(result => result.eligible)) return {
    kind: "no-rise",
    message: "지금은 상승 조건에 맞는 게임이 없습니다.",
  };
  return {
    kind: "insufficient",
    message: "비교할 최신 관측이 아직 충분하지 않습니다.",
  };
}
