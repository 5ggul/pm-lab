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
import { recentRiseBadge, recentRiseSignal } from "@/lib/recent-rise";
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
    return {
      game,
      trend: computeTrend(game.universeId, history, game.sourceUpdatedAt, observedAt, interval),
      recentRise: recentRiseSignal(history, interval),
    };
  });
  const trends = evaluatedTrends
    .filter((row) => row.trend.eligible && row.recentRise != null)
    .sort((a, b) => (b.recentRise?.score ?? 0) - (a.recentRise?.score ?? 0))
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
    ...trends.map(({ game, recentRise }) => ({
      game,
      badge: recentRise ? recentRiseBadge(recentRise) : "상승 확인",
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
            <div className="hero-sticker"><PlayIcon name="spark"/> 한국어 Roblox 게임 커뮤니티</div>
            <h1 id="home-heading">지금 뜨는<br/><em>로블록스 게임을</em><br/>한 곳에서!</h1>
            <p className="home-intro">코드·공략·질문·파티까지. 좋아하는 게임을 찾고, 친구들과 함께 더 재미있게 즐겨요.</p>
            <div className="hero-cta-row">
              <Link className="hero-primary-cta" href="/games">지금 인기 게임 보기 <PlayIcon name="arrow"/></Link>
              <Link className="hero-secondary-cta" href="/community/free">커뮤니티 둘러보기</Link>
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

        <section className="home-live-stage" aria-label="실시간 게임 탐색">
          <div className="home-live-panel home-hot-panel">
            <div className="home-panel-head">
              <div>
                <h2><span className="home-panel-icon home-panel-fire" aria-hidden="true">🔥</span>지금 뜨는 게임</h2>
                <p>지금 플레이 인원이 확인되는 인기 게임이에요.</p>
              </div>
              <Link href="/games">전체 보기 →</Link>
            </div>
            {hotGames.length ? (
              <div className="home-hot-grid">
                {hotGames.slice(0, 6).map((game, index) => (
                  <Link className="home-hot-card" href={"/game/" + game.slug} key={game.universeId}>
                    <div className="home-hot-cover">
                      <ResilientGameImage
                        sources={[game.heroImageUrl, ...(game.mediaImages ?? []).map(image => image.url), game.thumbnailUrl]}
                        name={game.nameKo}
                        width={520}
                        height={320}
                        eager={index < 3}
                        fetchPriority={index === 0 ? "high" : "auto"}
                      />
                      <span>{index + 1}</span>
                    </div>
                    <strong>{game.nameKo}</strong>
                    <div className="home-hot-meta">
                      <span>{compactNumber(game.playing)}명</span>
                      <span>{genreLabel(game.genreL1 ?? game.genre)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="home-live-empty">현재 플레이 인원을 확인하고 있어요.</div>
            )}
          </div>

          <aside className="home-live-panel home-rising-panel" data-trend-state={risingFallbackUsed ? emptyTrend.kind : "rising"}>
            <div className="home-panel-head">
              <div>
                <h2><span className="home-panel-icon home-panel-rise"><PlayIcon name="rise"/></span>실시간 급상승</h2>
                <p>{risingFallbackUsed ? "확실한 상승 신호가 부족한 자리는 지금 인기 게임으로 표시해요." : "가장 최근의 신뢰 가능한 상승 신호예요."}</p>
              </div>
              <Link href="/rising">전체 보기 →</Link>
            </div>
            <div className="home-rising-list">
              {risingDisplayRows.slice(0, 5).map(({ game, badge, fallback }, index) => (
                <Link className="home-rising-row" href={"/game/" + game.slug} key={game.universeId}>
                  <span className="home-rising-rank">{index + 1}</span>
                  <span className="home-rising-name">
                    <strong>{game.nameKo}</strong>
                    <small className={fallback ? "is-fallback" : undefined}>{fallback ? "지금 인기" : badge}</small>
                  </span>
                  <b>{compactNumber(game.playing)}명</b>
                </Link>
              ))}
            </div>
            {latestFetchedAt && <div className="home-rising-time rising-data-stamp"><b>최신 데이터</b>{formatKstDateTime(latestFetchedAt)}</div>}
          </aside>
        </section>

        <section className="home-portal-actions" aria-label="로블잼 바로가기">
          <Link
            className="home-portal-card home-portal-guide"
            href={editorialGuides[0] ? "/game/" + editorialGuides[0].game.slug + "/guides/" + editorialGuides[0].guide.slug : "/guides"}
          >
            <span className="home-portal-card-icon"><PlayIcon name="book"/></span>
            <span className="home-portal-card-copy">
              <small>인기 공략</small>
              <strong>{editorialGuides[0]?.guide.title ?? "게임 공략 모아보기"}</strong>
              <em>{editorialGuides[0] ? editorialGuides[0].game.nameKo + " · 출처 확인 공략" : "공식 확인 공략과 유저 공략을 함께 봐요."}</em>
            </span>
            <PlayIcon name="arrow"/>
          </Link>

          <Link
            className="home-portal-card home-portal-benefit"
            href={benefitGroups[0] ? "/game/" + benefitGroups[0].game.slug + "/codes" : "/codes"}
          >
            <span className="home-portal-card-icon"><PlayIcon name="code"/></span>
            <span className="home-portal-card-copy">
              <small>공짜 혜택</small>
              <strong>{benefitGroups[0] ? benefitGroups[0].game.nameKo + " 무료 보상 " + benefitGroups[0].rows.length + "개" : "확인된 공짜 혜택 보기"}</strong>
              <em>{benefitGroups[0]?.rows[0]?.reward_text || "공식 출처에서 확인된 무료 보상만 보여드려요."}</em>
            </span>
            <PlayIcon name="arrow"/>
          </Link>

          <Link className="home-portal-card home-portal-community" href="/community/free">
            <span className="home-portal-card-icon"><PlayIcon name="chat"/></span>
            <span className="home-portal-card-copy">
              <small>자유 톡</small>
              <strong>게임 이야기를 자유롭게 나눠요</strong>
              <em>추천, 자랑, 오늘 한 게임까지 편하게 이야기해요.</em>
            </span>
            <PlayIcon name="arrow"/>
          </Link>
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
