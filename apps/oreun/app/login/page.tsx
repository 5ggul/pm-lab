import type { Metadata } from "next";
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

        <div className="account-grid">
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
