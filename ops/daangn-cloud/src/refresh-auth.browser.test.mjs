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
  const context = await browser.newContext({ serviceWorkers: 'block', offline: true });
  t.after(() => context.close());
  const requestUrl = value => {
    const url = new URL(value);
    url.hash = '';
    return url.href;
  };
  const expectedDocuments = redirect ? [EDITOR_URL, requestUrl(redirect)] : [EDITOR_URL];
  const interceptedDocuments = [];
  const unexpectedDocuments = [];
  // Offline mode prevents network access even if a future fixture misses interception.
  // Do not fulfill HTTP redirects: Playwright routes only the first request in that chain.
  await context.route('**/*', async route => {
    const request = route.request();
    if (request.resourceType() !== 'document') {
      await route.abort();
      return;
    }
    if (!expectedDocuments.includes(request.url())) {
      unexpectedDocuments.push(request.url());
      await route.abort();
      return;
    }
    interceptedDocuments.push(request.url());
    const isRedirectPage = redirect && request.url() === EDITOR_URL;
    const fixtureType = isRedirectPage ? 'redirect' : 'destination';
    const content = isRedirectPage
      ? `<script>
          window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => window.location.replace(${JSON.stringify(redirect)}), 0);
          }, { once: true });
        </script>`
      : html ?? '<input placeholder="제목을 입력해주세요.">';
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html lang="ko" data-auth-fixture="${fixtureType}">
        <head><meta charset="utf-8"></head><body>${content}</body></html>`
    });
  });
  const page = await context.newPage();
  return {
    page,
    async assertDelivered() {
      assert.deepEqual(unexpectedDocuments, []);
      assert.deepEqual(interceptedDocuments, expectedDocuments);
      assert.equal(page.url(), redirect ?? EDITOR_URL);
      assert.equal(await page.locator('html').getAttribute('data-auth-fixture'), 'destination');
      assert.equal(await page.locator(TITLE_SELECTOR).isVisible(), true);
    }
  };
}

async function expectDenied(fixture, { reason, location, stage = 'login_editor', titleEditable = true }) {
  const { page } = fixture;
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
  await fixture.assertDelivered();
  assert.equal(await page.locator(TITLE_SELECTOR).isEditable(), titleEditable);
}

test('a visible title that becomes editable after hydration is accepted', async t => {
  const fixture = await fixturePage(t, {
    html: `<input placeholder="제목을 입력해주세요." disabled>
      <script>
        const title = document.querySelector('input');
        window.titleInitiallyDisabled = title.disabled;
        setTimeout(() => { title.disabled = false; }, 200);
      </script>`
  });
  const { page } = fixture;
  await assertEditorAccess(page, new AbortController().signal, { timeoutMs: 5000, intervalMs: 20 });
  await fixture.assertDelivered();
  assert.equal(await page.evaluate(() => window.titleInitiallyDisabled), true);
  assert.equal(await page.locator(TITLE_SELECTOR).isEditable(), true);
});

test('a login redirect is rejected without exposing its query or fragment', async t => {
  const fixture = await fixturePage(t, {
    redirect: `https://accounts.daangn.com/login?code=${PRIVATE_SENTINEL}#${PRIVATE_SENTINEL}`
  });
  await expectDenied(fixture, { reason: 'login_redirect', location: 'daangn_login' });
});

test('a cafe-home redirect is identified in fresh-context verification', async t => {
  const fixture = await fixturePage(t, {
    redirect: `https://cafe.daangn.com/don-akkineun-sa?code=${PRIVATE_SENTINEL}#${PRIVATE_SENTINEL}`
  });
  await expectDenied(fixture, {
    reason: 'cafe_redirect',
    location: 'cafe_home',
    stage: 'fresh_context_editor'
  });
});

test('a readonly title cannot authorize replacement', async t => {
  const fixture = await fixturePage(t, {
    html: '<input placeholder="제목을 입력해주세요." readonly>'
  });
  await expectDenied(fixture, { reason: 'title_not_editable', location: 'editor', titleEditable: false });
});

test('an editable title in a different cafe cannot authorize replacement', async t => {
  const fixture = await fixturePage(t, {
    redirect: `https://cafe.daangn.com/another-cafe/posts/new?code=${PRIVATE_SENTINEL}#${PRIVATE_SENTINEL}`
  });
  await expectDenied(fixture, { reason: 'wrong_editor', location: 'cafe_other' });
});
