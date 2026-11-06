export default function GameGlyph({
  name,
  thumbnailUrl,
}: {
  name: string;
  thumbnailUrl?: string | null;
}) {
  const chars =
    name.replace(/[^A-Za-z0-9가-힣]/g, "").slice(0, 2).toUpperCase() || "OR";

  return (
    <div className="game-glyph" aria-hidden="true">
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        chars
      )}
    </div>
  );
}
