"use client";

import { usePathname, useRouter } from "next/navigation";

export default function UpdateRadarFilters({
  games,
  selectedGame,
  selectedHours,
  defaultRangeLabel,
}: {
  games: Array<{ slug: string; name: string }>;
  selectedGame: string;
  selectedHours: string;
  defaultRangeLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function update(key: "game" | "hours", value: string) {
    const params = new URLSearchParams(window.location.search);
    if (!value || (key === "game" && value === "all") || (key === "hours" && value === "default")) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="update-radar-controls" aria-label="업데이트 감지 필터">
      <label>
        <span>게임</span>
        <select
          aria-label="게임"
          value={selectedGame}
          onChange={(event) => update("game", event.target.value)}
        >
          <option value="all">전체 게임</option>
          {games.map((game) => (
            <option key={game.slug} value={game.slug}>
              {game.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>기간</span>
        <select
          aria-label="기간"
          value={selectedHours}
          onChange={(event) => update("hours", event.target.value)}
        >
          <option value="default">기본 · {defaultRangeLabel}</option>
          <option value="1">최근 1시간</option>
          <option value="3">최근 3시간</option>
          <option value="6">최근 6시간</option>
          <option value="all">수집 전체</option>
        </select>
      </label>

      {(selectedGame !== "all" || selectedHours !== "default") && (
        <button
          className="secondary-button"
          type="button"
          onClick={() => router.push(pathname)}
        >
          초기화
        </button>
      )}
    </div>
  );
}
