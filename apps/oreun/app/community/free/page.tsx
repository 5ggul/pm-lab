import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import Header from "@/components/Header";
import DraftForm from "@/components/DraftForm";
import CommunityAccess from "@/components/CommunityAccess";
import PlayIcon from "@/components/PlayIcon";
import BrandMascot from "@/components/BrandMascot";
import GamePicker from "@/components/GamePicker";
import { submitCommunityPost } from "@/app/actions/extra-composers";
import { getGameCatalog } from "@/lib/catalog";
import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth/session";
import {
  getCommunityPermissions,
  getCommunityPostFeed,
} from "@/lib/community/queries";
import { writeAccess } from "@/lib/community/experience-model";
import { formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "자유 톡",
  description: "로블록스 게임 이야기를 자유롭게 나누는 로블잼 커뮤니티",
  robots: { index: false, follow: true },
};

export default async function FreePage({
  searchParams,
}: {
  searchParams: Promise<{ write?: string }>;
}) {
  const [games, user, token, posts, params] = await Promise.all([
    getGameCatalog(),
    getCurrentUser(),
    getCurrentAccessToken(),
    getCommunityPostFeed({ limit: 40 }).catch(() => null),
    searchParams,
  ]);
  const permissions = token
    ? await getCommunityPermissions(token).catch(() => null)
    : null;
  const access = writeAccess(Boolean(user && token), permissions);
  const openComposer = params.write === "1";

  const composer =
    user && access === "ready" ? (
      <details
        className="panel free-compose free-compose-bottom"
        id="write"
        open={openComposer}
      >
        <summary>새 자유글 쓰기</summary>
        <DraftForm
          userId={user.id}
          scope="global"
          kind="freePost"
          initialRequestId={randomUUID()}
          fields={["game_slug", "title", "body"]}
          action={submitCommunityPost}
          submitLabel="자유글 등록"
        >
          <GamePicker games={games} allowGeneral />
          <label>
            제목
            <input
              name="title"
              minLength={2}
              maxLength={120}
              required
              placeholder="무슨 이야기를 나눌까요?"
            />
          </label>
          <label>
            내용
            <textarea
              name="body"
              minLength={10}
              maxLength={5000}
              rows={7}
              required
              placeholder="게임 이야기, 자랑, 추천, 오늘 있었던 일을 자유롭게 적어 주세요."
            />
          </label>
        </DraftForm>
      </details>
    ) : (
      <div id="write">
        <CommunityAccess
          access={access}
          mode="post"
          next="/community/free?write=1#write"
        />
      </div>
    );

  return (
    <>
      <Header games={games} />
      <main className="page free-board-page">
        <div className="community-hero free-hero">
          <span className="community-kicker">
            <PlayIcon name="chat" /> 자유롭게 놀아요
          </span>
          <h1>자유 톡</h1>
          <p>
            좋아하는 게임, 오늘 있었던 일, 추천하고 싶은 맵까지. 개인정보나
            외부 연락처는 올리지 말아 주세요.
          </p>
        </div>

        <nav className="community-switcher" aria-label="커뮤니티 메뉴">
          <Link prefetch={false} aria-current="page" href="/community/free">
            자유
          </Link>
          <Link prefetch={false} href="/community">
            질문답변
          </Link>
          <Link prefetch={false} href="/guides">
            공략
          </Link>
          <Link prefetch={false} href="/updates">
            업데이트
          </Link>
          <Link prefetch={false} href="/games?intent=party">
            파티 모집
          </Link>
        </nav>

        <div className="section-head free-list-head">
          <h2>
            <PlayIcon name="spark" /> 최근 자유글
          </h2>
          <div className="section-head-actions">
            <span>{posts === null ? "불러오는 중" : posts.length + "개 표시"}</span>
            {user && access === "ready" && (
              <Link className="secondary-button" href="?write=1#write">
                새 자유글 쓰기
              </Link>
            )}
          </div>
        </div>

        {posts === null ? (
          <div className="callout danger">자유글을 불러오지 못했습니다.</div>
        ) : posts.length ? (
          <div className="free-post-list">
            {posts.map((post) => (
              <Link
                className="free-post-row"
                href={"/community/free/" + post.id}
                key={post.id}
              >
                <div>
                  <div className="free-post-meta">
                    <span>{post.game_name_ko ?? "자유게시판"}</span>
                    <small>
                      {post.author_name} · {formatKstDateTime(post.created_at)}
                    </small>
                  </div>
                  <strong>{post.title}</strong>
                  <p>{post.body}</p>
                </div>
                <span className="free-comment-count">
                  댓글 {post.comment_count}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="community-empty-state community-empty-playground">
            <BrandMascot className="community-empty-mascot" />
            <div className="community-empty-copy">
              <span className="community-empty-kicker">첫 글 아이디어</span>
              <strong>아직 조용해요. 이런 이야기부터 시작해 보세요.</strong>
              <p>실제 이용자가 남긴 글만 보여줍니다.</p>
              <div className="starter-prompt-grid" aria-label="자유글 주제 예시">
                <span>
                  <b>오늘 한 게임</b>
                  <small>재밌었던 점이나 아쉬웠던 점</small>
                </span>
                <span>
                  <b>내가 찾은 꿀팁</b>
                  <small>친구들이 알면 좋은 작은 팁</small>
                </span>
                <span>
                  <b>추천하고 싶은 맵</b>
                  <small>같이 해보고 싶은 게임 이야기</small>
                </span>
              </div>
              {user && access === "ready" ? (
                <Link className="primary-button" href="?write=1#write">
                  첫 자유글 쓰기
                </Link>
              ) : (
                <Link
                  prefetch={false}
                  className="primary-button"
                  href={
                    "/login?next=" +
                    encodeURIComponent("/community/free?write=1#write")
                  }
                >
                  Google 로그인하고 첫 글 쓰기
                </Link>
              )}
            </div>
          </div>
        )}

        {composer}
      </main>
    </>
  );
}
