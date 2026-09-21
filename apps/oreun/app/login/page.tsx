import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";
import { loginAction, signupAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "로그인 · 가입",
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    confirmed?: string;
    next?: string;
  }>;
}) {
  const [games, params] = await Promise.all([getGameCatalog(), searchParams]);
  const next =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/me";

  return (
    <>
      <Header games={games} />
      <main className="page account-page">
        <div className="page-title">
          <h1>계정</h1>
          <p>
            오름의 질문·답변·팔로우·알림 기능은 만 14세 이상 이용자에게
            제공합니다. Roblox 계정 비밀번호나 .ROBLOSECURITY를 요구하지
            않습니다.
          </p>
        </div>

        {params.error && <div className="callout danger">{params.error}</div>}
        {params.message && <div className="callout">{params.message}</div>}
        {params.confirmed && (
          <div className="callout">이메일 확인이 완료됐다면 로그인해 주세요.</div>
        )}

        <section className="panel google-auth-panel">
          <span className="eyebrow">RECOMMENDED</span>
          <h2>Google 계정으로 빠르게 시작</h2>
          <p>
            비밀번호를 새로 만들 필요 없이 Google 계정으로 로그인합니다.
            처음 로그인한 뒤 커뮤니티를 사용하려면 만 14세 이상 확인과 공개
            프로필 설정을 한 번만 진행합니다.
          </p>
          <Link
            className="google-auth-button"
            href={"/auth/google?next=" + encodeURIComponent(next)}
          >
            Google로 계속하기
          </Link>
          <small>
            오름은 Google 비밀번호를 받거나 저장하지 않습니다.
          </small>
        </section>

        <div className="auth-divider" aria-hidden="true">
          <span>또는 이메일로 계속</span>
        </div>

        <div className="account-grid email-auth-grid">
          <section className="panel">
            <h2>로그인</h2>
            <form action={loginAction} className="stack-form">
              <input type="hidden" name="next" value={next} />
              <label>
                이메일
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                비밀번호
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  minLength={8}
                  required
                />
              </label>
              <button type="submit" className="primary-button">
                로그인
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>가입</h2>
            <form action={signupAction} className="stack-form">
              <input type="hidden" name="next" value={next} />
              <label>
                이메일
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                비밀번호
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  required
                />
              </label>
              <label className="check-line">
                <input
                  name="age_confirmed_14_plus"
                  type="checkbox"
                  required
                />
                <span>만 14세 이상이며 커뮤니티 가이드라인에 동의합니다.</span>
              </label>
              <button type="submit" className="primary-button">
                가입
              </button>
            </form>
          </section>
        </div>

        <div className="callout">
          <strong>보안 안내</strong>
          <br />
          오름은 Roblox 로그인 정보, 쿠키, API Key, 전화번호, 학교나 정확한
          위치를 가입에 요구하지 않습니다.
        </div>
      </main>
    </>
  );
}
