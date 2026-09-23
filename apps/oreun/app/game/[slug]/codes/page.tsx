import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import {
  getContentSources,
  getPublishedCodes,
  isFreshCodeCheck,
} from "@/lib/content/queries";
import { formatKstDateTime } from "@/lib/format";
import { isIndexingReleased } from "@/lib/indexing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return {};
  const codes = await getPublishedCodes(game.universeId).catch(() => []);
  const ready =
    isIndexingReleased() &&
    game.indexState === "indexable" &&
    codes.some(
      (code) => code.code_status === "active" && isFreshCodeCheck(code),
    );

  return {
    title: `${game.nameKo} 코드`,
    description: `${game.nameKo} 코드와 마지막 확인 시각을 확인합니다.`,
    alternates: { canonical: `/game/${game.slug}/codes` },
    robots: ready
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function GameCodesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [game, games] = await Promise.all([
    getGameBySlug(slug),
    getGameCatalog(),
  ]);
  if (!game) notFound();

  const [codes, sources] = await Promise.all([
    getPublishedCodes(game.universeId).catch(() => []),
    getContentSources(game.universeId).catch(() => []),
  ]);
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const active = codes.filter((code) => code.code_status === "active");
  const expired = codes.filter((code) => code.code_status === "expired");

  return (
    <>
      <Header games={games} />
      <main className="page content-page">
        <div className="breadcrumb">
          <Link href={`/game/${game.slug}`}>{game.nameKo}</Link> / 코드
        </div>
        <div className="page-title">
          <h1>{game.nameKo} 코드</h1>
          <p>최근에 확인한 코드와 마지막 확인 시각을 함께 보여드립니다.</p>
        </div>

        {active.length ? (
          <section>
            <div className="section-head">
              <h2>활성 코드</h2>
              <span>{active.length}개</span>
            </div>
            <div className="code-list">
              {active.map((code) => {
                const source = code.source_id
                  ? sourceMap.get(code.source_id)
                  : null;
                const fresh = isFreshCodeCheck(code);
                return (
                  <article className="code-card" key={code.id}>
                    <div>
                      <code>{code.code}</code>
                      <strong>{code.reward_text || "보상 내용 미표기"}</strong>
                    </div>
                    <div className="code-meta">
                      <span className={fresh ? "fresh-mark" : "stale-mark"}>
                        {fresh ? "최근 확인" : "다시 확인 필요"}
                      </span>
                      <span>
                        마지막 확인 {formatKstDateTime(code.last_checked_at)}
                      </span>
                      {source && (
                        <a
                          href={source.source_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                        >
                          출처 · {source.label} ↗
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="no-data">
            <strong>현재 확인된 활성 코드가 없습니다.</strong>
            <p>새 코드가 확인되면 이 페이지에 추가됩니다.</p>
          </div>
        )}

        {expired.length > 0 && (
          <section>
            <div className="section-head">
              <h2>만료 확인</h2>
              <span>{expired.length}개</span>
            </div>
            <div className="code-list expired">
              {expired.map((code) => (
                <article className="code-card" key={code.id}>
                  <code>{code.code}</code>
                  <span>만료됨</span>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="callout">
          코드 입력 위치나 보상은 게임 업데이트로 바뀔 수 있습니다. Roblox
          비밀번호나 세션 쿠키를 요구하는 외부 “코드 입력” 사이트는 사용하지
          마세요.
        </div>
      </main>
    </>
  );
}
