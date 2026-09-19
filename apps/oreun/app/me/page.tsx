import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { logoutAction, updateProfileAction } from "@/app/actions/auth";
import { getGameCatalog } from "@/lib/catalog";
import {
  getCurrentAccessToken,
  getCurrentUser,
} from "@/lib/auth/session";
import {
  getCommunityPermissions,
  getProfile,
} from "@/lib/community/queries";
import { userSelect } from "@/lib/community/rest";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "내 계정",
  robots: { index: false, follow: false },
};

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; welcome?: string }>;
}) {
  const [user, token, games, params] = await Promise.all([
    getCurrentUser(),
    getCurrentAccessToken(),
    getGameCatalog(),
    searchParams,
  ]);
  if (!user || !token) redirect("/login?next=/me");

  const [profile, permissions, follows] = await Promise.all([
    getProfile(user.id),
    getCommunityPermissions(token),
    userSelect<{ universe_id: number | string }>("game_follows", token, {
      select: "universe_id",
      user_id: `eq.${user.id}`,
      order: "created_at.desc",
      limit: 100,
    }),
  ]);
  if (!profile) redirect("/login?error=프로필을+불러오지+못했습니다.");

  const followedIds = new Set(follows.map((row) => Number(row.universe_id)));
  const followedGames = games.filter((game) => followedIds.has(game.universeId));

  return (
    <>
      <Header games={games} />
      <main className="page account-page">
        <div className="page-title">
          <h1>내 계정</h1>
          <p>{user.email ?? "로그인 계정"} · @{profile.handle}</p>
        </div>

        {params.error && <div className="callout danger">{params.error}</div>}
        {params.saved && <div className="callout">저장했습니다.</div>}
        {params.welcome && (
          <div className="callout">
            가입이 완료됐습니다. 공개 프로필 이름을 설정해 주세요.
          </div>
        )}

        <div className="status-grid">
          <div className="status-cell">
            <strong>{permissions.active ? "정상" : "제한"}</strong>
            <span>계정 상태</span>
          </div>
          <div className="status-cell">
            <strong>
              {permissions.age_confirmed_14_plus ? "완료" : "필요"}
            </strong>
            <span>만 14세 이상 확인</span>
          </div>
          <div className="status-cell">
            <strong>{permissions.role}</strong>
            <span>권한</span>
          </div>
          <div className="status-cell">
            <strong>{followedGames.length}</strong>
            <span>팔로우 게임</span>
          </div>
        </div>

        <section className="panel profile-panel">
          <h2>공개 프로필</h2>
          <form action={updateProfileAction} className="stack-form">
            <label>
              아이디
              <input
                name="handle"
                defaultValue={profile.handle}
                minLength={3}
                maxLength={20}
                pattern="[a-z0-9_]+"
                required
              />
              <small>영문 소문자·숫자·밑줄 3~20자</small>
            </label>
            <label>
              표시 이름
              <input
                name="display_name"
                defaultValue={profile.display_name ?? ""}
                maxLength={30}
              />
            </label>
            <label>
              소개
              <textarea
                name="bio"
                defaultValue={profile.bio}
                maxLength={300}
                rows={4}
              />
            </label>
            <label className="check-line">
              <input
                type="checkbox"
                name="age_confirmed_14_plus"
                defaultChecked={permissions.age_confirmed_14_plus}
              />
              <span>만 14세 이상임을 확인합니다.</span>
            </label>
            <button className="primary-button" type="submit">
              프로필 저장
            </button>
          </form>
        </section>

        <div className="section-head">
          <h2>팔로우한 게임</h2>
          <Link href="/games">게임 찾기</Link>
        </div>
        {followedGames.length ? (
          <div className="follow-grid">
            {followedGames.map((game) => (
              <Link
                key={game.universeId}
                className="follow-card"
                href={`/game/${game.slug}`}
              >
                <strong>{game.nameKo}</strong>
                <span>{game.name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="no-data">아직 팔로우한 게임이 없습니다.</div>
        )}

        {["moderator", "admin"].includes(permissions.role ?? "") && (
          <div className="button-row">
            <Link className="secondary-button" href="/admin/moderation">
              신고·운영 큐
            </Link>
            {permissions.role === "admin" && (
              <Link className="secondary-button" href="/admin/content">
                Content Studio
              </Link>
            )}
          </div>
        )}

        <form action={logoutAction}>
          <button type="submit" className="text-button">
            로그아웃
          </button>
        </form>
      </main>
    </>
  );
}
