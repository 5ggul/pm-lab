import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

export const AUTH_PATH = 'C:\\Users\\dhkim\\DealOps\\automation\\secrets\\daangn-auth.json';
export const EDITOR_URL = 'https://cafe.daangn.com/don-akkineun-sa/posts/new';
const TITLE_SELECTOR = 'input[placeholder="제목을 입력해주세요."]';
const CONTEXT_OPTIONS = {
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
  viewport: { width: 1100, height: 800 }
};
const CLOUD_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36';

export class AuthRefreshError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function checkCancellation(signal) {
  if (signal?.aborted) throw new AuthRefreshError('AUTH_REFRESH_CANCELED');
}

export function isExpectedEditorUrl(value) {
  try {
    const actual = new URL(value);
    const expected = new URL(EDITOR_URL);
    return actual.origin === expected.origin &&
      actual.pathname.replace(/\/$/, '') === expected.pathname &&
      !actual.username && !actual.password;
  } catch {
    return false;
  }
}

async function assertEditorAccess(page, signal) {
  checkCancellation(signal);
  try {
    await page.goto(EDITOR_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const title = page.locator(TITLE_SELECTOR).first();
    await title.waitFor({ state: 'visible', timeout: 15000 });
    checkCancellation(signal);
    if (!isExpectedEditorUrl(page.url()) || !await title.isVisible() || !await title.isEditable()) {
      throw new AuthRefreshError('AUTH_VERIFY_FAILED');
    }
  } catch (error) {
    checkCancellation(signal);
    if (error instanceof AuthRefreshError) throw error;
    throw new AuthRefreshError('AUTH_VERIFY_FAILED');
  }
}

export async function saveStorageStateAtomically(authPath, state, { signal } = {}) {
  checkCancellation(signal);
  let serialized;
  try {
    if (!state || !Array.isArray(state.cookies) || !Array.isArray(state.origins)) {
      throw new Error('invalid state');
    }
    serialized = JSON.stringify(state);
  } catch {
    throw new AuthRefreshError('AUTH_STATE_INVALID');
  }

  const directory = path.dirname(authPath);
  const temporaryPath = path.join(directory, `.${path.basename(authPath)}.${randomUUID()}.tmp`);
  let handle;
  try {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const existing = await fs.lstat(authPath).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (existing && !existing.isFile()) throw new AuthRefreshError('AUTH_SAVE_FAILED');

    // A private, exclusive file in the same directory keeps the final rename atomic.
    handle = await fs.open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(serialized, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    checkCancellation(signal);
    await fs.rename(temporaryPath, authPath);
  } catch (error) {
    if (error instanceof AuthRefreshError) throw error;
    throw new AuthRefreshError('AUTH_SAVE_FAILED');
  } finally {
    await handle?.close().catch(() => {});
    await fs.unlink(temporaryPath).catch(() => {});
  }
}

function waitForUser(signal) {
  checkCancellation(signal);
  return new Promise((resolve, reject) => {
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    const finish = (error) => {
      signal.removeEventListener('abort', cancel);
      terminal.removeListener('line', confirm);
      terminal.removeListener('SIGINT', cancel);
      terminal.removeListener('close', cancel);
      terminal.close();
      if (error) reject(error);
      else resolve();
    };
    const cancel = () => finish(new AuthRefreshError('AUTH_REFRESH_CANCELED'));
    const confirm = answer => /^(q|quit|cancel|취소)$/i.test(answer.trim()) ? cancel() : finish();
    signal.addEventListener('abort', cancel, { once: true });
    terminal.once('line', confirm);
    terminal.once('SIGINT', cancel);
    terminal.once('close', cancel);
    process.stdout.write('브라우저에서 당근 로그인을 마친 뒤 이 창에서 Enter를 누르세요. 취소: q + Enter\n');
  });
}

export async function refreshAuth({
  authPath = AUTH_PATH,
  launchBrowser,
  confirmLogin = waitForUser,
  signal
} = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let browser;
  let loginContext;
  let verificationContext;
  const closeOnCancel = () => { void browser?.close().catch(() => {}); };

  try {
    checkCancellation(controller.signal);
    let launcher = launchBrowser;
    if (!launcher) {
      const { chromium } = await import('playwright');
      launcher = options => chromium.launch(options);
    }
    browser = await launcher({ headless: false });
    browser.once('disconnected', abort);
    controller.signal.addEventListener('abort', closeOnCancel, { once: true });
    checkCancellation(controller.signal);
    loginContext = await browser.newContext(CONTEXT_OPTIONS);
    const loginPage = await loginContext.newPage();
    await loginPage.goto(EDITOR_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await confirmLogin(controller.signal);
    await assertEditorAccess(loginPage, controller.signal);

    const state = await loginContext.storageState({ indexedDB: true });
    // Verify the serialized state in a fresh context with the cloud publisher's identity.
    verificationContext = await browser.newContext({
      ...CONTEXT_OPTIONS,
      userAgent: CLOUD_USER_AGENT,
      storageState: state
    });
    await verificationContext.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    });
    await assertEditorAccess(await verificationContext.newPage(), controller.signal);
    // Verification can rotate a session cookie; persist the last verified context.
    const verifiedState = await verificationContext.storageState({ indexedDB: true });
    await saveStorageStateAtomically(authPath, verifiedState, { signal: controller.signal });
    return { status: 'saved' };
  } catch (error) {
    checkCancellation(controller.signal);
    if (error instanceof AuthRefreshError) throw error;
    throw new AuthRefreshError('AUTH_BROWSER_FAILED');
  } finally {
    signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', closeOnCancel);
    browser?.removeListener('disconnected', abort);
    await verificationContext?.close().catch(() => {});
    await loginContext?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

async function main() {
  if (process.platform !== 'win32' || !process.stdin.isTTY) {
    console.error('Windows PowerShell의 대화형 창에서 refresh-auth.ps1을 실행하세요.');
    return 2;
  }
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once('SIGINT', interrupt);
  try {
    await refreshAuth({ signal: controller.signal });
    console.log('AUTH_SAVED: 글쓰기 접근을 확인한 새 로그인 상태를 저장했습니다.');
    return 0;
  } catch (error) {
    if (error.code === 'AUTH_REFRESH_CANCELED') return 10;
    const messages = {
      AUTH_VERIFY_FAILED: '로그인 또는 카페 글쓰기 권한을 확인하지 못했습니다. 기존 인증 파일을 유지합니다.',
      AUTH_STATE_INVALID: '새 로그인 상태를 저장할 수 없습니다. 기존 인증 파일을 유지합니다.',
      AUTH_SAVE_FAILED: '인증 파일을 안전하게 교체하지 못했습니다. 파일 권한을 확인한 뒤 다시 시도하세요.',
      AUTH_BROWSER_FAILED: '브라우저를 열거나 로그인 화면에 접근하지 못했습니다. 네트워크와 Chromium 설치를 확인하세요.'
    };
    console.error(messages[error.code] || '로그인 갱신에 실패했습니다. 인증 정보는 출력하지 않았습니다.');
    return 2;
  } finally {
    process.removeListener('SIGINT', interrupt);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
