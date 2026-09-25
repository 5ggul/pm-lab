"use client";

import { useMemo, useState } from "react";
import type { GameView } from "@/lib/types";
import PlayIcon from "./PlayIcon";

type PickerGame = Pick<GameView, "slug" | "nameKo" | "name" | "aliases" | "thumbnailUrl" | "playing">;

function norm(value: string) {
  return value.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

export default function GamePicker({
  games,
  allowGeneral = false,
  defaultSlug = "",
}: {
  games: PickerGame[];
  allowGeneral?: boolean;
  defaultSlug?: string;
}) {
  const ordered = useMemo(
    () =>
      [...games].sort(
        (a, b) =>
          (b.playing ?? -1) - (a.playing ?? -1) ||
          a.nameKo.localeCompare(b.nameKo, "ko"),
      ),
    [games],
  );
  const [selectedSlug, setSelectedSlug] = useState(defaultSlug);
  const [query, setQuery] = useState("");

  const selected = ordered.find((game) => game.slug === selectedSlug) ?? null;
  const needle = norm(query.trim());
  const results = useMemo(() => {
    const source = needle
      ? ordered.filter((game) =>
          [game.nameKo, game.name, ...(game.aliases ?? [])]
            .map(norm)
            .some((value) => value.includes(needle)),
        )
      : ordered;
    return source.slice(0, 12);
  }, [needle, ordered]);

  return (
    <div className="game-picker-pro">
      <div className="game-picker-art" aria-hidden="true">
        <img src="/brand/community-game-picker.webp" alt="" width={720} height={240} />
      </div>
      <div className="game-picker-copy">
        <span>게임 선택</span>
        <strong>{allowGeneral ? "어디에 올릴 이야기인가요?" : "어떤 게임 공략인가요?"}</strong>
        <small>
          {allowGeneral
            ? "게임을 고르거나, 게임과 상관없는 글은 자유게시판으로 남겨도 돼요."
            : "게임 이름을 검색해 선택하세요. 인기·연관 게임까지 함께 찾을 수 있어요."}
        </small>
      </div>

      <input type="hidden" name="game_slug" value={selectedSlug} />

      <div className="game-picker-controls">
        <div className="game-picker-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`게임 이름 검색 · ${ordered.length.toLocaleString("ko-KR")}개`}
            aria-label="게임 이름 검색"
          />
        </div>
        <div className="game-picker-selected" data-empty={!selectedSlug}>
          {selected ? (
            <>
              {selected.thumbnailUrl ? <img src={selected.thumbnailUrl} alt="" width={42} height={42} /> : <i aria-hidden="true"><PlayIcon name="game" /></i>}
              <div><small>선택됨</small><strong>{selected.nameKo}</strong></div>
              <button type="button" onClick={() => setSelectedSlug("")}>변경</button>
            </>
          ) : allowGeneral ? (
            <>
              <i aria-hidden="true"><PlayIcon name="chat" /></i>
              <div><small>현재 선택</small><strong>자유게시판</strong></div>
            </>
          ) : (
            <>
              <i aria-hidden="true"><PlayIcon name="game" /></i>
              <div><small>아직 선택 안 함</small><strong>게임을 선택해 주세요</strong></div>
            </>
          )}
        </div>
      </div>

      <div className="game-picker-results" role="listbox" aria-label="게임 검색 결과">
        {allowGeneral && (
          <button
            type="button"
            className={!selectedSlug ? "is-selected" : undefined}
            onClick={() => setSelectedSlug("")}
          >
            <i aria-hidden="true"><PlayIcon name="chat" /></i>
            <span><strong>자유게시판</strong><small>특정 게임과 상관없는 이야기</small></span>
            <b>{!selectedSlug ? "✓" : ""}</b>
          </button>
        )}
        {results.map((game) => (
          <button
            type="button"
            key={game.slug}
            className={selectedSlug === game.slug ? "is-selected" : undefined}
            onClick={() => {
              setSelectedSlug(game.slug);
              setQuery("");
            }}
          >
            {game.thumbnailUrl ? <img src={game.thumbnailUrl} alt="" width={42} height={42} loading="lazy" /> : <i aria-hidden="true"><PlayIcon name="game" /></i>}
            <span>
              <strong>{game.nameKo}</strong>
              <small>{game.playing == null ? "Roblox 게임" : game.playing.toLocaleString("ko-KR") + "명 플레이 중"}</small>
            </span>
            <b>{selectedSlug === game.slug ? "✓" : ""}</b>
          </button>
        ))}
        {results.length === 0 && (
          <p className="game-picker-empty">검색 결과가 없어요. 다른 이름으로 검색해 보세요.</p>
        )}
      </div>
    </div>
  );
}
