import type { Metadata } from "next";
import Header from "@/components/Header";
import { getGameCatalog } from "@/lib/catalog";
import { getGoogleAuthProviderStatus } from "@/lib/auth/session";
import { normalizeAuthNext } from "@/lib/auth/oauth";
import styles from "./login.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "로그인",
  robots: { index: false, follow: true },
};

function GoogleLogo() {
  // Official current Google G. Do not redraw or recolor the brand asset.
  return (
    <img
      className="google-auth-icon"
      src="https://developers.google.com/static/identity/images/g-logo.png"
      width={20}
      height={20}
      alt=""
      aria-hidden="true"
      referrerPolicy="no-referrer"
      decoding="async"
    />
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const [games, params, googleProvider] = await Promise.all([
    getGameCatalog(),
    searchParams,
    getGoogleAuthProviderStatus().catch(() => ({
      enabled: false,
      error: "provider status unavailable",
      status: 503,
    })),
  ]);
  const next = normalizeAuthNext(params.next);

  return (
    <>
      <Header games={games} />
      <main className={`page account-page ${styles.loginPage}`}>
        <div className="page-title">
          <h1>계정</h1>
          <p>게임 정보는 로그인 없이 볼 수 있습니다. 질문·답변·팔로우·알림은 만 14세 이상 이용자에게 제공합니다.</p>
        </div>

        {params.error && <div className="callout danger" role="alert">{params.error.slice(0, 180)}</div>}
        {params.message && <div className="callout" role="status">{params.message.slice(0, 180)}</div>}

        <section className={`panel google-auth-panel ${styles.loginPanel}`}>
          <h2>Google 계정으로 시작하기</h2>
          <p>가입과 로그인은 Google 계정 하나로 진행합니다. 처음 이용할 때 공개 프로필과 만 14세 이상 여부를 한 번만 확인합니다.</p>
          {googleProvider.enabled ? (
            <a
              className={`google-auth-button ${styles.googleButton}`}
              href={"/auth/google?next=" + encodeURIComponent(next)}
              aria-describedby="google-auth-status"
            >
              <GoogleLogo />
              <span>Google로 계속하기</span>
            </a>
          ) : (
            <button
              className={`google-auth-button google-auth-button-disabled ${styles.googleButton}`}
              type="button"
              disabled
              aria-describedby="google-auth-status"
            >
              <GoogleLogo />
              <span>Google 로그인 준비 중</span>
            </button>
          )}
          <small id="google-auth-status">
            {googleProvider.enabled
              ? "로블잼은 Google 비밀번호를 받거나 저장하지 않습니다."
              : googleProvider.status === 200
                ? "Google 로그인이 아직 열리지 않았습니다. 잠시 뒤 다시 확인해 주세요."
                : "Google 로그인 제공자 상태를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요."}
          </small>
          {!googleProvider.enabled && (
            <a className={styles.retryLink} href={"/login?next=" + encodeURIComponent(next)}>
              로그인 상태 다시 확인
            </a>
          )}
          <p className={styles.policyLinks}>
            <a href="/terms">이용약관</a>
            <span aria-hidden="true"> · </span>
            <a href="/privacy">개인정보 처리방침</a>
            <span aria-hidden="true"> · </span>
            <a href="/guidelines">커뮤니티 이용규칙</a>
          </p>
        </section>

        <p className={styles.browseLink}><a href="/games">로그인 없이 게임 둘러보기 →</a></p>
        <div className="callout">
          <strong>보안 안내</strong>
          <br />
          Roblox 계정 비밀번호나 .ROBLOSECURITY 쿠키, API Key를 입력하지 마세요. 로블잼은 전화번호, 학교, 정확한 위치를 가입에 요구하지 않습니다.
        </div>
      </main>
    </>
  );
}
