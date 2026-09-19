import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ReportForm from "@/components/community/ReportForm";
import {
  closePartyAction,
  createPartyAction,
  joinPartyAction,
  leavePartyAction,
} from "@/app/actions/community";
import { getGameBySlug, getGameCatalog } from "@/lib/catalog";
import {
  getCurrentAccessToken,
  getCurrentUser,
} from "@/lib/auth/session";
import { getCommunityPermissions } from "@/lib/community/queries";
import {
  getOwnPartyIds,
  getPartyFeed,
} from "@/lib/party/queries";
import { formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "파티 모집",
  robots: { index: false, follow: true },
};

const playstyleLabels: Record<string, string> = {
  casual: "가볍게",
  competitive: "경쟁",
  learning: "배우기",
  quest: "퀘스트",
  grind: "파밍",
};

export default async function PartyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    error?: string;
    created?: string;
    joined?: string;
    left?: string;
    closed?: string;
    reported?: string;
  }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [game, games, user, token] = await Promise.all([
    getGameBySlug(slug),
    getGameCatalog(),
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);
  if (!game) notFound();

  const [parties, permissions, ownPartyIds] = await Promise.all([
    getPartyFeed(game.universeId, 80).catch(() => []),
    token ? getCommunityPermissions(token).catch(() => null) : null,
    user && token
      ? getOwnPartyIds(token, user.id).catch(() => new Set<string>())
      : Promise.resolve(new Set<string>()),
  ]);

  const canPost = Boolean(
    user &&
      token &&
      permissions?.active &&
      permissions.age_confirmed_14_plus,
  );
  const returnPath = `/game/${game.slug}/party`;

  return (
    <>
      <Header games={games} />
      <main className="page party-page">
        <div className="breadcrumb">
          <Link href={`/game/${game.slug}`}>{game.nameKo}</Link> / 파티 모집
        </div>
        <div className="page-title">
          <span className="eyebrow">GAME PARTY</span>
          <h1>{game.nameKo} 파티 모집</h1>
          <p>
            게임 안에서 만날 사람을 찾는 공개 모집판입니다. 1:1 DM은 없고
            전화번호·이메일·카카오톡·Discord 초대 공유는 제한합니다.
          </p>
        </div>

        {query.error && <div className="callout danger">{query.error}</div>}
        {query.created && <div className="callout">파티 모집을 등록했습니다.</div>}
        {query.joined && <div className="callout">파티에 참여했습니다.</div>}
        {query.left && <div className="callout">파티에서 나왔습니다.</div>}
        {query.closed && <div className="callout">파티 모집을 닫았습니다.</div>}
        {query.reported && <div className="callout">신고가 접수됐습니다.</div>}

        <div className="callout">
          <strong>외부 연락처 없이 모집합니다.</strong>
          <br />
          선택적으로 넣을 수 있는 링크는 roblox.com 주소만 허용합니다. 계정
          비밀번호나 .ROBLOSECURITY를 공유하지 마세요.
        </div>

        {canPost ? (
          <details className="party-create panel">
            <summary>새 파티 모집 만들기</summary>
            <form action={createPartyAction} className="stack-form">
              <input
                type="hidden"
                name="game_universe_id"
                value={game.universeId}
              />
              <input type="hidden" name="game_slug" value={game.slug} />
              <label>
                제목
                <input
                  name="title"
                  minLength={5}
                  maxLength={100}
                  required
                  placeholder="예: 초보 같이 3판 하실 분"
                />
              </label>
              <label>
                한 줄 설명
                <textarea
                  name="note"
                  maxLength={1000}
                  rows={4}
                  placeholder="게임 안에서 할 목표와 필요한 조건만 적어 주세요."
                />
              </label>
              <div className="party-form-grid">
                <label>
                  플레이 방식
                  <select name="playstyle" defaultValue="casual">
                    <option value="casual">가볍게</option>
                    <option value="competitive">경쟁</option>
                    <option value="learning">배우기</option>
                    <option value="quest">퀘스트</option>
                    <option value="grind">파밍</option>
                  </select>
                </label>
                <label>
                  최대 인원
                  <select name="max_members" defaultValue="4">
                    {[2, 3, 4, 5, 6, 8, 10, 12].map((value) => (
                      <option key={value} value={value}>
                        {value}명
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  모집 시간
                  <select name="duration_minutes" defaultValue="120">
                    <option value="30">30분</option>
                    <option value="60">1시간</option>
                    <option value="120">2시간</option>
                    <option value="180">3시간</option>
                    <option value="360">6시간</option>
                  </select>
                </label>
              </div>
              <label>
                Roblox 링크 (선택)
                <input
                  name="roblox_join_url"
                  type="url"
                  pattern="https://(www\.)?roblox\.com/.*"
                  placeholder="https://www.roblox.com/..."
                />
                <small>roblox.com HTTPS 주소만 저장됩니다.</small>
              </label>
              <button className="primary-button" type="submit">
                모집 등록
              </button>
            </form>
          </details>
        ) : (
          <div className="callout">
            모집 작성·참여는 만 14세 이상 확인이 완료된 로그인 계정만
            가능합니다.{" "}
            <Link href={`/login?next=${encodeURIComponent(returnPath)}`}>
              로그인 →
            </Link>
          </div>
        )}

        <div className="section-head">
          <h2>현재 모집</h2>
          <span>{parties.length}개</span>
        </div>

        <div className="party-list">
          {parties.length ? (
            parties.map((party) => {
              const mine = user?.id === party.host_id;
              const joined = ownPartyIds.has(party.id);
              const full = party.member_count >= party.max_members;

              return (
                <article className="party-card" key={party.id}>
                  <div className="party-topline">
                    <span>{playstyleLabels[party.playstyle] ?? party.playstyle}</span>
                    <span>
                      {party.member_count}/{party.max_members}명
                    </span>
                  </div>
                  <h2>{party.title}</h2>
                  {party.note && <p>{party.note}</p>}
                  <div className="community-meta">
                    호스트{" "}
                    <Link href={`/u/${party.host_handle}`}>
                      @{party.host_handle}
                    </Link>{" "}
                    · 종료 {formatKstDateTime(party.expires_at)}
                  </div>

                  <div className="button-row">
                    {party.roblox_join_url && (
                      <a
                        className="secondary-button"
                        href={party.roblox_join_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                      >
                        Roblox에서 열기 ↗
                      </a>
                    )}

                    {canPost && mine ? (
                      <form action={closePartyAction}>
                        <input type="hidden" name="party_id" value={party.id} />
                        <input
                          type="hidden"
                          name="game_slug"
                          value={game.slug}
                        />
                        <button className="text-button" type="submit">
                          모집 닫기
                        </button>
                      </form>
                    ) : canPost && joined ? (
                      <form action={leavePartyAction}>
                        <input type="hidden" name="party_id" value={party.id} />
                        <input
                          type="hidden"
                          name="game_slug"
                          value={game.slug}
                        />
                        <button className="secondary-button" type="submit">
                          참여 취소
                        </button>
                      </form>
                    ) : canPost ? (
                      <form action={joinPartyAction}>
                        <input type="hidden" name="party_id" value={party.id} />
                        <input
                          type="hidden"
                          name="game_slug"
                          value={game.slug}
                        />
                        <button
                          className="primary-button"
                          type="submit"
                          disabled={full}
                        >
                          {full ? "정원 마감" : "참여"}
                        </button>
                      </form>
                    ) : null}

                    <ReportForm
                      targetType="party"
                      targetId={party.id}
                      returnPath={returnPath}
                    />
                  </div>
                </article>
              );
            })
          ) : (
            <div className="no-data">
              <strong>현재 열려 있는 파티 모집이 없습니다.</strong>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
