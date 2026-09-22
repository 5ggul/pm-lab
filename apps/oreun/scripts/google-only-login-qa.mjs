import { request as playwrightRequest } from "playwright";

export async function checkGoogleOnlyLogin({ browser, base, failures, collectErrors, hasOverflow }) {
  const next = "/game/rivals/questions";
  for (const width of [360, 375, 390, 430, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const flush = await collectErrors(page, `Google-only login ${width}px`);
    try {
      const response = await page.goto(base + "/login?next=" + encodeURIComponent(next), { waitUntil: "networkidle" });
      if (!response?.ok()) failures.push(`Google login ${width}px HTTP ${response?.status()}`);
      const link = page.getByRole("link", { name: "Google로 계속하기", exact: true });
      const disabled = page.getByRole("button", { name: "Google 로그인 준비 중", exact: true });
      const ready = await link.isVisible().catch(() => false);
      const blocked = await disabled.isVisible().catch(() => false);
      const button = ready ? link : disabled;
      if (!ready && !blocked) {
        failures.push(`Google login ${width}px readiness CTA missing`);
      } else {
        if (ready) {
          const href = await link.getAttribute("href");
          if (!href || !href.startsWith("/auth/google?next=") || new URL(href, base).searchParams.get("next") !== next) {
            failures.push(`Google login ${width}px safe return destination lost`);
          }
          if (!(await page.getByText(/Google 비밀번호를 받거나 저장하지 않습니다/).isVisible())) {
            failures.push(`Google login ${width}px privacy copy missing`);
          }
        } else {
          if (!(await disabled.isDisabled())) failures.push("blocked Google CTA is not disabled");
          if (!(await page.getByText(/Google 로그인이 아직 열리지 않았습니다|Google 로그인 제공자 상태를 확인하지 못했습니다/).isVisible())) {
            failures.push("Google blocked-state explanation missing");
          }
          const retry = page.getByRole("link", { name: "로그인 상태 다시 확인", exact: true });
          const href = await retry.getAttribute("href");
          if (!href || new URL(href, base).searchParams.get("next") !== next) failures.push("Google retry lost destination");
        }
        const box = await button.boundingBox();
        if (!box || box.height < 44) failures.push(`Google login ${width}px button below 44px`);
        const icon = button.locator("img.google-auth-icon");
        const iconLoaded = await icon.evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false);
        if (!iconLoaded) failures.push(`Google login ${width}px official logo did not load`);
        if ((await icon.getAttribute("alt").catch(() => null)) !== "") failures.push("Google logo must be decorative");
        const iconBox = await icon.boundingBox();
        const textBox = await button.locator("span").boundingBox();
        if (!iconBox || !textBox || iconBox.x + iconBox.width > textBox.x || Math.abs(iconBox.width - iconBox.height) > 1) {
          failures.push(`Google login ${width}px logo alignment/aspect ratio incorrect`);
        }
        await button.focus();
        if (ready && !(await link.evaluate((element) => element === document.activeElement))) failures.push("Google button keyboard focus failed");
      }
      if ((await page.locator('.email-login-panel, input[type="email"], input[type="password"], input[name="password"], .auth-divider').count()) !== 0) {
        failures.push(`Google login ${width}px legacy email/password UI remains`);
      }
      if (!(await page.getByText("가입과 로그인은 Google 계정 하나로 진행합니다.", { exact: false }).isVisible())) failures.push("Google-only login guidance missing");
      if (!(await page.getByRole("link", { name: /로그인 없이 게임 둘러보기/ }).isVisible())) failures.push("Guest browsing CTA missing");
      for (const path of ["/terms", "/privacy", "/guidelines"]) {
        if (!(await page.locator(`.google-auth-panel a[href="${path}"]`).isVisible())) failures.push(`Sign-in policy link missing: ${path}`);
      }
      if (await hasOverflow(page)) failures.push(`Google login ${width}px horizontal overflow`);
      await page.screenshot({ path: `qa-login-google-${width}.png`, fullPage: true });
      flush();
    } finally {
      await page.close();
    }
  }

  // No real accounts, grants or mutations: an isolated cancelled OAuth attempt.
  const api = await playwrightRequest.newContext();
  try {
    const start = await api.get(base + "/auth/google?next=" + encodeURIComponent(next), { maxRedirects: 0 });
    if ((start.headers().location ?? "").includes("/auth/v1/authorize")) {
      const cancelled = await api.get(base + "/auth/google/callback?error=access_denied", { maxRedirects: 0 });
      const destination = new URL(cancelled.headers().location ?? "/", base);
      if (destination.origin !== new URL(base).origin || destination.pathname !== "/login" || destination.searchParams.get("next") !== next) {
        failures.push("Cancelled Google login lost safe original destination");
      }
      if (!(cancelled.headers()["cache-control"] ?? "").includes("no-store")) failures.push("OAuth cancellation must not be cached");
      const cookies = (await api.storageState()).cookies;
      if (cookies.some((cookie) => cookie.name === "oreun_oauth_verifier" && cookie.value)) failures.push("Cancelled OAuth verifier cookie not cleared");
    }
  } finally {
    await api.dispose();
  }
}
