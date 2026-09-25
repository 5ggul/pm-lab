import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import SearchBox from "@/components/SearchBox";
import FixtureBanner from "@/components/FixtureBanner";
import GameVisualCard from "@/components/GameVisualCard";
import DiscoveryShelf from "@/components/DiscoveryShelf";
import PlayIcon from "@/components/PlayIcon";
import CommunityTiles from "@/components/CommunityTiles";
import HeroWorld from "@/components/HeroWorld";
import HomeBrandStrip from "@/components/HomeBrandStrip";
import ResilientGameImage from "@/components/ResilientGameImage";
import { genreLabel } from "@/lib/discovery";
import { getGameCatalog } from "@/lib/catalog";
import { getPreviewFixtureHistory, previewFixtureEnabled } from "@/lib/history";
import { getPersistentHistories } from "@/lib/repository/supabase-public";
import { getAllPublishedCodes, getRecentUpdateEvents } from "@/lib/content/queries";
import { computeTrend } from "@/lib/trend";
import { risingEmptyState } from "@/lib/rising-empty-state";
import { getPublicGuideCatalog } from "@/lib/content/queries";
import { getCommunityPostFeed } from "@/lib/community/queries";
import { getOpenPartyFeed } from "@/lib/party/queries";
import { compactNumber, formatKstDateTime, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const games = await getGameCatalog();
  const live = games
    .filter(game => game.playing != null && game.freshnessState !== "unavailable")
    .sort((a, b) => (b.playing ?? -1) - (a.playing ?? -1));
  const visualLive = live.filter(game => game.heroImageUrl || game.thumbnailUrl);
  const hotGames = visualLive.slice(0, 8);
  const featured = hotGames.slice(0, 4);
  const latestFetchedAt = live.map(game => game.fetchedAt).filter(Boolean).sort().at(-1);

  let persistentHistories: Awaited<ReturnType<typeof getPersistentHistories>> = null;
  let historyReadFailed = false;
  try {
    persistentHistories = await getPersistentHistories(games.map(game => game.universeId), 168);
  } catch {
    historyReadFailed = true;
  }

  const observedAt = new Date();
  const evaluatedTrends = games.map(game => {
    const storedHistory = persistentHistories?.get(game.universeId);
    const usingStoredHistory = Boolean(storedHistory?.length);
    const history = usingStoredHistory ? storedHistory! : getPreviewFixtureHistory(game);
    const interval = usingStoredHistory ? 60 : previewFixtureEnabled() ? 360 : 60;
    return { game, trend: computeTrend(game.universeId, history, game.sourceUpdatedAt, observedAt, interval) };
  });
  const trends = evaluatedTrends
    .filter(({ trend }) => trend.eligible && (trend.metrics.relativeGrowth ?? 0) > 0 && (trend.metrics.absoluteMomentum ?? 0) > 0)
    .sort((a, b) => (b.trend.score ?? 0) - (a.trend.score ?? 0))
    .slice(0, 6);
  const emptyTrend = risingEmptyState(
    evaluatedTrends.map(row => row.trend),
    historyReadFailed || (persistentHistories === null && !previewFixtureEnabled())
  );
  const trendUniverseIds = new Set(trends.map(({ game }) => game.universeId));
  const risingFallbackGames = trends.length >= 4
    ? []
    : visualLive
        .filter(game => !trendUniverseIds.has(game.universeId))
        .slice(0, Math.max(0, 6 - trends.length));
  const risingDisplayRows = [
    ...trends.map(({ game, trend }) => ({
      game,
      badge: trend.score == null ? "상승 확인" : "상승 " + trend.score.toFixed(0),
      fallback: false,
    })),
    ...risingFallbackGames.map(game => ({
      game,
      badge: "지금 인기",
      fallback: true,
    })),
  ].slice(0, 6);
  const risingFallbackUsed = risingFallbackGames.length > 0;

  const [recentUpdateEvents, recentFreePosts, openParties, publishedGuides, publishedCodes] = await Promise.all([
    getRecentUpdateEvents(100).catch(() => []),
    getCommunityPostFeed({ limit: 4 }).catch(() => []),
    getOpenPartyFeed(20).catch(() => []),
    getPublicGuideCatalog().catch(() => null),
    getAllPublishedCodes(100).catch(() => []),
  ]);

  const gameByUniverse = new Map(games.map(game => [game.universeId, game]));
  const seenUpdateGames = new Set<number>();
  const editorialGuides = (publishedGuides ?? []).flatMap(guide => {
    const game = gameByUniverse.get(Number(guide.universe_id));
    return game ? [{ guide, game }] : [];
  }).slice(0, 8);
  const activeBenefitsByGame = new Map<number, typeof publishedCodes>();
  for (const benefit of publishedCodes.filter(code => code.code_status === "active")) {
    const universeId = Number(benefit.universe_id);
    const rows = activeBenefitsByGame.get(universeId) ?? [];
    rows.push(benefit);
    activeBenefitsByGame.set(universeId, rows);
  }
  const benefitGroups = [...activeBenefitsByGame.entries()]
    .flatMap(([universeId, rows]) => {
      const game = gameByUniverse.get(universeId);
      return game ? [{ game, rows }] : [];
    })
    .sort((a, b) => (b.game.playing ?? -1) - (a.game.playing ?? -1))
    .slice(0, 4);
  const detectedUpdates = recentUpdateEvents.flatMap(event => {
    const id = Number(event.universe_id);
    const game = gameByUniverse.get(id);
    if (!game || !(game.heroImageUrl || game.thumbnailUrl) || seenUpdateGames.has(id)) return [];
    seenUpdateGames.add(id);
    return [{ game, event }];
  }).slice(0, 8);

  const remainingLive = live.filter(game => !hotGames.some(hot => hot.universeId === game.universeId)).slice(0, 12);

  return (
    <>
      <Header games={games}/>
      <FixtureBanner/>
      <main className="page media-home roblejam-home">
        <div className="mobile-home-search"><SearchBox games={games}/></div>
        <section className="play-hero roblejam-hero" aria-labelledby="home-heading">
          <div className="roblejam-hero-copy">
            <div className="hero-sticker"><PlayIcon name="spark"/> 게임하는 친구들이 모이는 곳</div>
            <h1 id="home-heading">함께라면<br/><em>게임이 더 재밌다!</em></h1>
            <p className="home-intro">지금 뜨는 게임을 찾고, 자유롭게 이야기하고, 공략과 공짜 혜택을 챙기고, 같이 플레이할 친구를 찾아보세요.</p>
            <div className="hero-cta-row">
              <Link className="hero-primary-cta" href="/games">지금 시작하기 <PlayIcon name="arrow"/></Link>
              <Link className="hero-secondary-cta" href="/community/free">자유 톡 가기</Link>
            </div>
            <div className="quick-game-links">
              <span>바로 가기</span>
              {hotGames.slice(0, 3).map(g => (
                <Link href={"/game/" + g.slug} key={g.slug}>
                  {g.slug === "dress-to-impress" ? "DTI" : g.nameKo}<span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </div>
          <HeroWorld games={featured.length ? featured : visualLive.slice(0, 4)}/>
        </section>

        <section className="why-roblejam-section" aria-labelledby="why-roblejam-heading">
          <div className="why-roblejam-head">
            <span aria-hidden="true">✦</span>
            <div>
              <h2 id="why-roblejam-heading">로블잼에서 할 수 있는 것</h2>
              <p>게임을 찾고, 혜택을 챙기고, 이야기하고, 같이 플레이해요.</p>
            </div>
          </div>
          <div className="why-roblejam">
            <Link href="/games" className="why-card why-card-game">
              <span className="why-card-icon"><PlayIcon name="game"/></span>
              <strong>게임을 발견하고</strong>
              <small>지금 많이 하는 게임과 새로 뜨는 게임을 찾아요.</small>
              <b>게임 찾기 →</b>
            </Link>
            <Link href="/community/free" className="why-card why-card-chat">
              <span className="why-card-icon"><PlayIcon name="chat"/></span>
              <strong>자유롭게 이야기하고</strong>
              <small>질문만 하지 말고 게임 얘기도 편하게 나눠요.</small>
              <b>자유 톡 →</b>
            </Link>
            <div className="why-card why-card-benefit">
              <span className="why-card-icon"><PlayIcon name="book"/></span>
              <strong>공략과 공짜 혜택</strong>
              <small>막힌 부분은 공략으로, 무료 보상은 바로 챙겨요.</small>
              <span className="why-card-actions"><Link href="/guides">공략</Link><Link href="/codes">공짜 혜택</Link></span>
            </div>
            <Link href="/games?intent=party" className="why-card why-card-party">
              <span className="why-card-icon"><PlayIcon name="party"/></span>
              <strong>같이 플레이해요</strong>
              <small>같은 게임을 하는 친구와 파티를 찾아요.</small>
              <b>파티 찾기 →</b>
            </Link>
          </div>
        </section>

        <div className="section-head spotlight-head">
          <h2><PlayIcon name="game"/>지금 핫한 게임</h2>
          <span>{latestFetchedAt ? "현재값 갱신 " + formatKstDateTime(latestFetchedAt) : "현재값 확인 중"} · <Link href="/games">더보기 →</Link></span>
        </div>
        {hotGames.length > 0 && (
          <section className="hot-game-rail" aria-label="지금 핫한 게임">
            {hotGames.map((game, index) => (
              <Link className="hot-game-card" href={"/game/" + game.slug} key={game.universeId}>
                <div className="hot-game-image">
                  <ResilientGameImage
                    sources={[game.heroImageUrl, ...(game.mediaImages ?? []).map(image => image.url), game.thumbnailUrl]}
                    name={game.nameKo}
                    width={480}
                    height={300}
                    eager={index < 4}
                    fetchPriority={index === 0 ? "high" : "auto"}
                  />
                  <span className="hot-game-rank">#{index + 1}</span>
                </div>
                <strong>{game.nameKo}</strong>
                <small><span aria-hidden="true">🔥</span>{compactNumber(game.playing)}명 플레이 중</small>
              </Link>
            ))}
          </section>
        )}

        <section className="home-rising-section" data-trend-state={risingFallbackUsed ? emptyTrend.kind : "rising"}>
          <div className="section-head">
            <div>
              <h2><PlayIcon name="rise"/>상승 중</h2>
              <p className="rising-explainer">
                {risingFallbackUsed
                  ? trends.length
                    ? "확실한 상승 게임을 먼저 보여주고, 빈 자리는 지금 인기 있는 게임으로 채웠어요."
                    : emptyTrend.kind === "unavailable"
                      ? "상승 데이터를 불러오지 못해 지금 인기 있는 게임을 대신 보여드려요."
                      : "상승 비교 데이터가 아직 충분하지 않아 지금 인기 있는 게임을 보여드려요."
                  : "최근 인원 변화와 플레이 규모를 함께 반영한 게임이에요."}
              </p>
            </div>
            <Link href="/rising">전체 보기 →</Link>
          </div>
          <div className="visual-card-grid visual-card-grid-3" data-rising-fallback={risingFallbackUsed ? "true" : "false"}>
            {risingDisplayRows.map(({ game, badge }, index) => (
              <GameVisualCard key={game.universeId} game={game} rank={index + 1} badge={badge}/>
            ))}
          </div>
        </section>

        <section className="home-community-section">
          <div className="section-head community-section-head">
            <h2><PlayIcon name="chat"/>커뮤니티</h2>
            <span>질문만 하는 곳이 아니에요. 원하는 방식으로 이야기하고 같이 놀아보세요.</span>
          </div>
          <CommunityTiles/>
        </section>

        {recentFreePosts.length > 0 && (
          <section className="home-free-preview">
            <div className="section-head">
              <h2><PlayIcon name="chat"/>지금 올라온 자유 톡</h2>
              <Link href="/community/free">전체 보기 →</Link>
            </div>
            <div className="home-free-grid">
              {recentFreePosts.map(post => (
                <Link href={"/community/free/" + post.id} className="home-free-card" key={post.id}>
                  <span>{post.game_name_ko ?? "자유게시판"}</span>
                  <strong>{post.title}</strong>
                  <p>{post.body}</p>
                  <small>{post.author_name} · 댓글 {post.comment_count}</small>
                </Link>
              ))}
            </div>
          </section>
        )}

        {remainingLive.length > 0 && (
          <section>
            <div className="section-head">
              <h2><PlayIcon name="rise"/>실시간 TOP</h2>
              <span className="section-note">현재값 확인 {live.length}/{games.length} · <Link href="/games">전체 보기 →</Link></span>
            </div>
            <div className="visual-card-grid">
              {remainingLive.map((game, index) => <GameVisualCard key={game.universeId} game={game} rank={index + hotGames.length + 1}/>)}
            </div>
          </section>
        )}

        {detectedUpdates.length > 0 && (
          <section>
            <div className="section-head">
              <h2><PlayIcon name="megaphone"/>업데이트 감지</h2>
              <span className="section-note">Roblox 업데이트 시각 변화 기준 · <Link href="/updates">전체 기록 →</Link></span>
            </div>
            <div className="visual-card-grid">
              {detectedUpdates.map(({ game, event }) => (
                <GameVisualCard key={game.universeId} game={game} href={"/game/" + game.slug + "/updates"} badge={relativeTime(event.first_observed_at)}/>
              ))}
            </div>
          </section>
        )}

        {publishedGuides === null && <p className="callout">공략 목록을 불러오지 못했습니다. 잠시 뒤 다시 확인해 주세요.</p>}
        {editorialGuides.length > 0 && (
          <section>
            <div className="section-head"><h2><PlayIcon name="book"/>공략</h2><Link href="/guides">전체 보기 →</Link></div>
            <div className="content-link-grid">
              {editorialGuides.map(({ guide, game }) => (
                <Link className="content-link-card" href={"/game/" + game.slug + "/guides/" + guide.slug} key={guide.id}>
                  <ResilientGameImage
                    className="guide-card-image"
                    sources={[game.heroImageUrl, ...(game.mediaImages ?? []).map(image => image.url), game.thumbnailUrl]}
                    name={game.nameKo}
                    width={768}
                    height={432}
                  />
                  <div className="guide-card-copy">
                    <span>{game.nameKo}</span>
                    <strong>{guide.title}</strong>
                    <small>{guide.guide_type === "mechanic" ? "조작·규칙" : "입문"}<span aria-hidden="true">읽어보기 ↗</span></small>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="home-benefits-section">
          <div className="section-head">
            <div>
              <h2><PlayIcon name="code"/>공짜 혜택</h2>
              <p className="rising-explainer">지금 받을 수 있다고 확인된 무료 보상만 모았어요.</p>
            </div>
            <Link href="/codes">전체 혜택 →</Link>
          </div>
          {benefitGroups.length ? (
            <div className="benefit-card-grid">
              {benefitGroups.map(({ game, rows }) => (
                <Link className="benefit-card" href={"/game/" + game.slug + "/codes"} key={game.universeId}>
                  <ResilientGameImage
                    className="benefit-card-image"
                    sources={[game.heroImageUrl, ...(game.mediaImages ?? []).map(image => image.url), game.thumbnailUrl]}
                    name={game.nameKo}
                    width={520}
                    height={300}
                  />
                  <div className="benefit-card-copy">
                    <span>🎁 지금 받을 수 있는 혜택 {rows.length}개</span>
                    <strong>{game.nameKo}</strong>
                    <p>{rows[0]?.reward_text || "무료 보상"}</p>
                    <b>혜택 받기 →</b>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Link className="benefit-empty-card" href="/codes">
              <span aria-hidden="true">🎁</span>
              <div><strong>새 공짜 혜택을 확인하고 있어요</strong><small>확인된 무료 보상이 생기면 바로 여기에 보여드려요.</small></div>
              <b>혜택 페이지 →</b>
            </Link>
          )}
        </section>

        <DiscoveryShelf games={games.filter(g => Boolean(g.heroImageUrl || g.thumbnailUrl) && g.regionalAvailability !== "restricted_kr")}/>

        <HomeBrandStrip
          gameCount={games.length}
          liveCount={live.length}
          guideCount={publishedGuides?.length ?? 0}
          openPartyCount={openParties.length}
          hasCommunityPosts={recentFreePosts.length > 0}
        />
      </main>
    </>
  );
}
