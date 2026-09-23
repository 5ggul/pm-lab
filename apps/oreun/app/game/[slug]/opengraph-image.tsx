import { ImageResponse } from "next/og";
import { getGameBySlug } from "@/lib/catalog";
import { compactNumber } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);

  if (!game) {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07070B",
          color: "#F4F1EA",
          fontSize: 64,
          fontWeight: 800,
        }}
      >
        오름 · 로블록스 게임 정보
      </div>,
      size,
    );
  }

  const current =
    game.playing == null ? "데이터 확인 중" : `${compactNumber(game.playing)}명 플레이 중`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: "#07070B",
        color: "#F4F1EA",
      }}
    >
      <div style={{ display: "flex", fontSize: 27, color: "#C8F542", fontWeight: 800 }}>
        오름 · 로블록스 게임 정보
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 900, letterSpacing: "-3px" }}>
          {game.nameKo}
        </div>
        <div style={{ display: "flex", fontSize: 31, color: "#A9A7B2" }}>
          {game.name}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderTop: "2px solid #2B2B36",
          paddingTop: 28,
        }}
      >
        <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>{current}</div>
        <div style={{ display: "flex", fontSize: 22, color: "#A9A7B2" }}>
          Roblox 공개 데이터 · 오름
        </div>
      </div>
    </div>,
    size,
  );
}
