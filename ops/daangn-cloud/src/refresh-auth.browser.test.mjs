import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { assertEditorAccess, EDITOR_URL } from './refresh-auth.mjs';

const TITLE_SELECTOR = 'input[placeholder="제목을 입력해주세요."]';
const PRIVATE_SENTINEL = 'fixture-private-query-and-fragment';
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
});

async function fixturePage(t, { html, redirect } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  t.after(() => context.close());
  // Every request is intercepted. These fixtures never contact Daangn or use a login.
  await context.route('**/*', async route => {
    const request = route.request();
    if (request.resourceType() !== 'document') {
      await route.abort();
      return;
    }
    if (redirect && request.url() === EDITOR_URL) {
      await route.fulfill({ status: 302, headers: { location: redirect } });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: html ?? '<!doctype html><html lang="ko"><input placeholder="제목을 입력해주세요."></html>'
    });
  });
  return context.newPage();
}

async function expectDenied(page, { reason, location, stage = 'login_editor', titleEditable = true }) {
  await assert.rejects(assertEditorAccess(page, new AbortController().signal, {
    stage,
    timeoutMs: 1500,
    intervalMs: 20
  }), error => {
    assert.equal(error.code, 'AUTH_VERIFY_FAILED');
    assert.deepEqual(error.diagnostic, {
      stage,
      reason,
      location,
      titleVisible: true,
      titleEditable,
      navigationFailed: false
    });
    const emitted = JSON.stringify({ message: error.message, diagnostic: error.diagnostic });
    assert.equal(emitted.includes(PRIVATE_SENTINEL), false);
    assert.equal(emitted.includes('https://'), false);
    return true;
  });
}

test('a visible title that becomes editable after hydration is accepted', async t => {
  const page = await fixturePage(t, {
    html: `<!doctype html><html lang="ko">
      <input placeholder="제목을 입력해주세요." disabled>
      <script>
        const title = document.querySelector('input');
        window.titleInitiallyDisabled = title.disabled;
        setTimeout(() => { title.disabled = false; }, 200);
      </script>
    </html>`
  });
  await assertEditorAccess(page, new AbortController().signal, { timeoutMs: 5000, intervalMs: 20 });
  assert.equal(await page.evaluate(() => window.titleInitiallyDisabled), true);
  assert.equal(await page.locator(TITLE_SELECTOR).isEditable(), true);
});

test('a login redirect is rejected without exposing its query or fragment', async t => {
  const page = await fixturePage(t, {
    redirect: `https://accounts.daangn.com/login?code=${PRIVATE_SENTINEL}#${PRIVATE_SENTINEL}`
  });
  await expectDenied(page, { reason: 'login_redirect', location: 'daangn_login' });
});

test('a cafe-home redirect is identified in fresh-context verification', async t => {
  const page = await fixturePage(t, {
    redirect: `https://cafe.daangn.com/don-akkineun-sa?code=${PRIVATE_SENTINEL}#${PRIVATE_SENTINEL}`
  });
  await expectDenied(page, {
    reason: 'cafe_redirect',
    location: 'cafe_home',
    stage: 'fresh_context_editor'
  });
});

test('a readonly title cannot authorize replacement', async t => {
  const page = await fixturePage(t, {
    html: '<!doctype html><html lang="ko"><input placeholder="제목을 입력해주세요." readonly></html>'
  });
  await expectDenied(page, { reason: 'title_not_editable', location: 'editor', titleEditable: false });
});

test('an editable title in a different cafe cannot authorize replacement', async t => {
  const page = await fixturePage(t, {
    redirect: `https://cafe.daangn.com/another-cafe/posts/new?code=${PRIVATE_SENTINEL}#${PRIVATE_SENTINEL}`
  });
  await expectDenied(page, { reason: 'wrong_editor', location: 'cafe_other' });
});
