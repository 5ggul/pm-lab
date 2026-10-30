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
  constructor(code, diagnostic) {
    super(code);
    this.code = code;
    if (diagnostic) this.diagnostic = diagnostic;
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

function pageLocation(page) {
  try {
    if (page.isClosed()) return 'closed';
    const url = new URL(page.url());
    if (isExpectedEditorUrl(url.href)) return 'editor';
    if (url.hostname === 'accounts.daangn.com') return 'daangn_login';
    if (url.origin === new URL(EDITOR_URL).origin) {
      if (/^\/api\/auth(?:\/|$)|^\/(?:login|auth)(?:\/|$)/.test(url.pathname)) return 'cafe_auth';
      if (url.pathname.replace(/\/$/, '') === '/don-akkineun-sa') return 'cafe_home';
      return 'cafe_other';
    }
  } catch {}
  return 'other';
}

async function editorObservation(page) {
  const observation = { location: pageLocation(page), titleVisible: false, titleEditable: false };
  if (observation.location === 'closed') return observation;
  try {
    const title = page.locator(TITLE_SELECTOR).first();
    observation.titleVisible = await title.isVisible();
    if (observation.titleVisible) observation.titleEditable = await title.isEditable({ timeout: 500 });
  } catch {
    // A redirect or hydration can detach the input; retry within the deadline.
  }
  // Check the URL again after observing the input so a redirect cannot pass.
  observation.location = pageLocation(page);
  return observation;
}

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function assertEditorAccess(page, signal, {
  stage = 'login_editor',
  timeoutMs = 30000,
  intervalMs = 200
} = {}) {
  checkCancellation(signal);
  let navigationFailed = false;
  const deadline = Date.now() + timeoutMs;
  try {
    await page.goto(EDITOR_URL, { waitUntil: 'domcontentloaded', timeout: Math.max(1, timeoutMs) });
  } catch {
    checkCancellation(signal);
    navigationFailed = true;
  }

  let observation;
  do {
    checkCancellation(signal);
    observation = await editorObservation(page);
    if (observation.location === 'editor' && observation.titleVisible && observation.titleEditable) return;
    if (observation.location === 'closed' || Date.now() >= deadline) break;
    await pause(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
  } while (true);

  const reason = observation.location === 'closed' ? 'page_closed'
    : ['daangn_login', 'cafe_auth'].includes(observation.location) ? 'login_redirect'
      : observation.location === 'cafe_home' ? 'cafe_redirect'
        : observation.location !== 'editor' ? 'wrong_editor'
          : !observation.titleVisible ? 'title_missing' : 'title_not_editable';
  throw new AuthRefreshError('AUTH_VERIFY_FAILED', {
    stage: stage === 'fresh_context_editor' ? stage : 'login_editor',
    reason,
    ...observation,
    navigationFailed
  });
}

async function liveLoginPage(context, preferredPage) {
  const pages = context.pages().filter(page => !page.isClosed());
  const preferred = preferredPage && !preferredPage.isClosed() ? preferredPage : undefined;
  return pages.find(page => pageLocation(page) === 'editor')
    || (preferred && ['cafe_home', 'cafe_other'].includes(pageLocation(preferred)) ? preferred : undefined)
    || pages.find(page => ['cafe_home', 'cafe_other'].includes(pageLocation(page)))
    || preferred || pages[0] || await context.newPage();
}

async function waitForCafeReturn(context, preferredPage, signal, timeoutMs) {
  let page = await liveLoginPage(context, preferredPage);
  const deadline = Date.now() + timeoutMs;
  // Enter can arrive while external login is still returning to the cafe.
  // Leave its callback alone until it has set the cafe session.
  while (['daangn_login', 'cafe_auth'].includes(pageLocation(page))) {
    checkCancellation(signal);
    if (Date.now() >= deadline) {
      throw new AuthRefreshError('AUTH_VERIFY_FAILED', {
        stage: 'login_editor', reason: 'login_pending', location: pageLocation(page),
        titleVisible: false, titleEditable: false, navigationFailed: false
      });
    }
    await pause(Math.min(200, Math.max(0, deadline - Date.now())));
    page = await liveLoginPage(context, page);
  }
  return page;
}

async function retryAfterVerificationFailure(error, signal) {
  // Only fixed codes and booleans are printed. No URL, query, page text or credentials.
  console.error('AUTH_CHECK_FAILED ' + JSON.stringify(error.diagnostic));
  const stage = error.diagnostic?.stage === 'fresh_context_editor'
    ? '서버에 옮길 로그인 상태 재검사' : '현재 창의 글쓰기 화면 확인';
  console.error(`${stage}에서 멈췄습니다. 로그인한 창은 그대로 열어둡니다.`);
  console.error('브라우저에서 싸그리 카페의 글쓰기 화면을 열고, 준비되면 Enter를 누르세요.');
  await waitForUser(signal, '같은 로그인으로 다시 확인: Enter / 취소: q + Enter\n');
  return true;
}

async function verifyAndSave({ browser, loginContext, loginPage, authPath, signal, timeoutMs, onProgress }) {
  let verificationContext;
  try {
    await assertEditorAccess(loginPage, signal, { stage: 'login_editor', timeoutMs });
    const state = await loginContext.storageState({ indexedDB: true });
    onProgress('로그인을 새 창으로 옮겨 다시 확인합니다.');
    // Keep the same strict check used by the cloud publisher before replacing its state.
    verificationContext = await browser.newContext({
      ...CONTEXT_OPTIONS,
      userAgent: CLOUD_USER_AGENT,
      storageState: state
    });
    await verificationContext.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    });
    await assertEditorAccess(await verificationContext.newPage(), signal, { stage: 'fresh_context_editor', timeoutMs });
    // Verification can rotate a session cookie; persist the last verified context.
    const verifiedState = await verificationContext.storageState({ indexedDB: true });
    await saveStorageStateAtomically(authPath, verifiedState, { signal });
  } finally {
    await verificationContext?.close().catch(() => {});
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

function waitForUser(signal, prompt = '열린 브라우저에서 로그인을 마쳤으면 Enter를 누르세요. 이미 로그인되어 있으면 바로 Enter. 취소: q + Enter\n') {
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
    process.stdout.write(prompt);
  });
}

export async function refreshAuth({
  authPath = AUTH_PATH,
  launchBrowser,
  confirmLogin = waitForUser,
  retryVerification = null,
  onProgress = () => {},
  verificationTimeoutMs = 30000,
  signal
} = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let browser;
  let loginContext;
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
    let loginPage = await loginContext.newPage();
    await loginPage.goto(EDITOR_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await confirmLogin(controller.signal);
    while (true) {
      checkCancellation(controller.signal);
      loginPage = await liveLoginPage(loginContext, loginPage);
      try {
        onProgress('현재 로그인 창에서 싸그리 글쓰기 화면을 확인합니다.');
        loginPage = await waitForCafeReturn(loginContext, loginPage, controller.signal, verificationTimeoutMs);
        await verifyAndSave({
          browser, loginContext, loginPage, authPath,
          signal: controller.signal, timeoutMs: verificationTimeoutMs, onProgress
        });
        return { status: 'saved' };
      } catch (error) {
        checkCancellation(controller.signal);
        if (error.code !== 'AUTH_VERIFY_FAILED' || !retryVerification) throw error;
        // Do not discard a successful manual login because a later check failed.
        await loginPage.bringToFront().catch(() => {});
        if (!await retryVerification(error, controller.signal)) throw error;
      }
    }
  } catch (error) {
    checkCancellation(controller.signal);
    if (error instanceof AuthRefreshError) throw error;
    throw new AuthRefreshError('AUTH_BROWSER_FAILED');
  } finally {
    signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', closeOnCancel);
    browser?.removeListener('disconnected', abort);
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
    await refreshAuth({
      signal: controller.signal,
      retryVerification: retryAfterVerificationFailure,
      onProgress: message => console.log(message)
    });
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
