import { chromium } from 'playwright';

const CAFE_SLUG = process.env.DAANGN_CAFE_SLUG || 'don-akkineun-sa';
const CAFE_BASE = `https://cafe.daangn.com/${CAFE_SLUG}`;
const encoded = process.env.DAANGN_AUTH_STATE_B64 || '';

if (!encoded) {
  console.error('AUTH_MISSING');
  process.exit(2);
}

let storageState;
try {
  const decoded = Buffer.from(encoded, 'base64').toString('utf8').replace(/^\uFEFF/, '');
  storageState = JSON.parse(decoded);
} catch {
  console.error('AUTH_SECRET_INVALID');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36',
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
  viewport: { width: 800, height: 600 }
});
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
});
const page = await context.newPage();

try {
  await page.goto(`${CAFE_BASE}/posts/new`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);

  const titleInput = page.locator('input[placeholder="제목을 입력해주세요."]');
  const authenticated =
    !/login|accounts/.test(page.url()) &&
    (await titleInput.count()) > 0;

  if (!authenticated) {
    console.error(JSON.stringify({
      status: 'AUTH_EXPIRED',
      url: page.url(),
      title: await page.title()
    }));
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify({
      status: 'AUTH_OK',
      url: page.url(),
      title: await page.title()
    }));
  }
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}
