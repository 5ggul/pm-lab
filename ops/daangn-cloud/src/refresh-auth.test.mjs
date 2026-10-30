import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import {
  AUTH_PATH,
  EDITOR_URL,
  AuthRefreshError,
  assertEditorAccess,
  isExpectedEditorUrl,
  refreshAuth,
  saveStorageStateAtomically
} from './refresh-auth.mjs';

const oldState = JSON.stringify({ cookies: [], origins: [], marker: 'previous-fixture' });
const initialState = {
  cookies: [{ name: 'fixture', value: 'initial-fake-cookie', domain: 'cafe.daangn.com', path: '/' }],
  origins: []
};
const rotatedState = {
  cookies: [{ name: 'fixture', value: 'rotated-fake-cookie', domain: 'cafe.daangn.com', path: '/' }],
  origins: []
};

async function workspace(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'daangn-refresh-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const authPath = path.join(directory, 'auth.json');
  await fs.writeFile(authPath, oldState);
  return { directory, authPath };
}

async function assertUnchanged(directory, authPath) {
  assert.equal(await fs.readFile(authPath, 'utf8'), oldState);
  assert.deepEqual(await fs.readdir(directory), ['auth.json']);
}

function pageFixture({
  url = EDITOR_URL,
  visible = () => true,
  editable = () => true,
  navigationFailure = false
} = {}) {
  const title = {
    first() { return this; },
    async isVisible() { return visible(); },
    async isEditable() { return editable(); }
  };
  return {
    closed: false,
    currentUrl: url,
    navigationCalls: 0,
    frontCalls: 0,
    isClosed() { return this.closed; },
    async bringToFront() { this.frontCalls += 1; },
    async goto(destination) {
      assert.equal(this.closed, false, 'verification must not use a closed page');
      assert.equal(destination, EDITOR_URL);
      this.navigationCalls += 1;
      if (navigationFailure) throw new Error('RAW_NAVIGATION_DETAIL_MUST_NOT_ESCAPE');
    },
    locator(selector) {
      assert.equal(selector, 'input[placeholder="제목을 입력해주세요."]');
      return title;
    },
    url() { return this.currentUrl; }
  };
}

function browserFixture({ rejectVerification = false, wrongEditor = false } = {}) {
  const browser = new EventEmitter();
  browser.contexts = [];
  browser.contextRecords = [];
  browser.snapshots = [];
  browser.closed = false;
  browser.newContext = async options => {
    const index = browser.contexts.length;
    browser.contexts.push(options);
    // No fill/click/submit methods are provided: this helper only checks access.
    const context = {
      closed: false,
      pageList: [],
      pages() { return this.pageList.filter(page => !page.closed); },
      async newPage() {
        const rejected = index > 0 && (typeof rejectVerification === 'number'
          ? index <= rejectVerification
          : rejectVerification);
        const page = pageFixture({
          url: rejected
            ? 'https://accounts.daangn.com/login?token=FAKE_QUERY_SECRET#FAKE_HASH_SECRET'
            : index === 1 && wrongEditor
              ? 'https://cafe.daangn.com/another-cafe/posts/new'
              : EDITOR_URL,
          visible: () => !rejected,
          editable: () => !rejected
        });
        this.pageList.push(page);
        return page;
      },
      storageState: async snapshotOptions => {
        assert.equal(snapshotOptions.indexedDB, true);
        browser.snapshots.push(index);
        return index === 0 ? initialState : rotatedState;
      },
      addInitScript: async () => {},
      async close() {
        this.closed = true;
        for (const page of this.pageList) page.closed = true;
      }
    };
    browser.contextRecords.push(context);
    return context;
  };
  browser.close = async () => {
    browser.closed = true;
    browser.emit('disconnected');
  };
  return browser;
}

test('auth refresh keeps the existing Windows destination and exact cafe editor identity', () => {
  assert.equal(AUTH_PATH, 'C:\\Users\\dhkim\\DealOps\\automation\\secrets\\daangn-auth.json');
  assert.equal(isExpectedEditorUrl(EDITOR_URL), true);
  for (const url of [
    'https://accounts.daangn.com/login',
    'https://cafe.daangn.com/other/posts/new',
    'https://example.com/don-akkineun-sa/posts/new',
    'https://user@cafe.daangn.com/don-akkineun-sa/posts/new',
    'invalid-url'
  ]) assert.equal(isExpectedEditorUrl(url), false);
});

test('atomic auth replacement cleans temporary files and uses private file permissions', async t => {
  const { directory, authPath } = await workspace(t);
  await saveStorageStateAtomically(authPath, initialState);
  assert.deepEqual(JSON.parse(await fs.readFile(authPath, 'utf8')), initialState);
  assert.deepEqual(await fs.readdir(directory), ['auth.json']);
  if (process.platform !== 'win32') assert.equal((await fs.stat(authPath)).mode & 0o777, 0o600);
});

test('invalid auth state leaves the previous file untouched', async t => {
  const { directory, authPath } = await workspace(t);
  await assert.rejects(saveStorageStateAtomically(authPath, { invalid: true }), { code: 'AUTH_STATE_INVALID' });
  await assertUnchanged(directory, authPath);
});

test('canceled atomic save leaves the previous file untouched', async t => {
  const { directory, authPath } = await workspace(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(saveStorageStateAtomically(authPath, initialState, { signal: controller.signal }), { code: 'AUTH_REFRESH_CANCELED' });
  await assertUnchanged(directory, authPath);
});

test('auth save refuses symlink destinations without replacing their target', { skip: process.platform === 'win32' }, async t => {
  const { directory, authPath } = await workspace(t);
  const symlink = path.join(directory, 'linked.json');
  await fs.symlink(authPath, symlink);
  await assert.rejects(saveStorageStateAtomically(symlink, initialState), { code: 'AUTH_SAVE_FAILED' });
  assert.equal(await fs.readFile(authPath, 'utf8'), oldState);
  assert.equal((await fs.lstat(symlink)).isSymbolicLink(), true);
  await fs.unlink(symlink);
  await assertUnchanged(directory, authPath);
});

test('refresh validates a fresh context and saves its rotated session cookies', async t => {
  const { directory, authPath } = await workspace(t);
  const browser = browserFixture();
  const result = await refreshAuth({
    authPath,
    launchBrowser: async options => {
      assert.equal(options.headless, false);
      return browser;
    },
    confirmLogin: async () => {}
  });
  assert.equal(result.status, 'saved');
  assert.equal(browser.contexts.length, 2);
  assert.equal(browser.contexts[1].storageState, initialState);
  assert.deepEqual(browser.snapshots, [0, 1]);
  assert.deepEqual(JSON.parse(await fs.readFile(authPath, 'utf8')), rotatedState);
  assert.deepEqual(await fs.readdir(directory), ['auth.json']);
});

test('fresh-context authentication failure preserves the previous file', async t => {
  const { directory, authPath } = await workspace(t);
  await assert.rejects(refreshAuth({
    authPath,
    launchBrowser: async () => browserFixture({ rejectVerification: true }),
    confirmLogin: async () => {},
    verificationTimeoutMs: 0
  }), error => {
    assert.equal(error.code, 'AUTH_VERIFY_FAILED');
    assert.equal(error.diagnostic.stage, 'fresh_context_editor');
    assert.equal(error.diagnostic.location, 'daangn_login');
    assert.equal(error.diagnostic.titleVisible, false);
    assert.equal(error.diagnostic.titleEditable, false);
    assert.doesNotMatch(JSON.stringify(error), /FAKE_QUERY_SECRET|FAKE_HASH_SECRET|https:|token=/);
    return true;
  });
  await assertUnchanged(directory, authPath);
});

test('access to a different cafe cannot authorize replacement', async t => {
  const { directory, authPath } = await workspace(t);
  await assert.rejects(refreshAuth({
    authPath,
    launchBrowser: async () => browserFixture({ wrongEditor: true }),
    confirmLogin: async () => {},
    verificationTimeoutMs: 0
  }), { code: 'AUTH_VERIFY_FAILED' });
  await assertUnchanged(directory, authPath);
});

test('user cancellation preserves the previous file and leaves no temporary state', async t => {
  const { directory, authPath } = await workspace(t);
  await assert.rejects(refreshAuth({
    authPath,
    launchBrowser: async () => browserFixture(),
    confirmLogin: async () => { throw new AuthRefreshError('AUTH_REFRESH_CANCELED'); }
  }), { code: 'AUTH_REFRESH_CANCELED' });
  await assertUnchanged(directory, authPath);
});

test('browser failures expose a fixed error code instead of underlying details', async t => {
  const { directory, authPath } = await workspace(t);
  await assert.rejects(refreshAuth({
    authPath,
    launchBrowser: async () => { throw new Error('RAW_DETAIL_MUST_NOT_ESCAPE'); },
    confirmLogin: async () => {}
  }), error => error.message === 'AUTH_BROWSER_FAILED');
  await assertUnchanged(directory, authPath);
});

test('editor verification waits for a visible title to become editable', async () => {
  let editable = false;
  const page = pageFixture({ editable: () => editable });
  const timer = setTimeout(() => { editable = true; }, 20);
  try {
    await assertEditorAccess(page, undefined, { timeoutMs: 500, intervalMs: 5 });
    assert.equal(editable, true);
  } finally {
    clearTimeout(timer);
  }
});

test('an editor that is already ready survives a navigation timeout', async () => {
  await assertEditorAccess(pageFixture({ navigationFailure: true }), undefined, { timeoutMs: 0 });
});

test('failed verification exposes fixed diagnostic fields without URL or raw error details', async () => {
  const page = pageFixture({
    url: 'https://accounts.daangn.com/login?token=FAKE_QUERY_SECRET#FAKE_HASH_SECRET',
    visible: () => false,
    editable: () => false,
    navigationFailure: true
  });
  await assert.rejects(assertEditorAccess(page, undefined, { timeoutMs: 0 }), error => {
    assert.equal(error.code, 'AUTH_VERIFY_FAILED');
    assert.equal(error.diagnostic.stage, 'login_editor');
    assert.equal(error.diagnostic.location, 'daangn_login');
    assert.equal(error.diagnostic.navigationFailed, true);
    assert.deepEqual(Object.keys(error.diagnostic).sort(), [
      'location', 'navigationFailed', 'reason', 'stage', 'titleEditable', 'titleVisible'
    ]);
    assert.doesNotMatch(JSON.stringify(error), /FAKE_QUERY_SECRET|FAKE_HASH_SECRET|RAW_NAVIGATION_DETAIL|https:|token=/);
    return true;
  });
});

test('refresh reuses a live login tab when the original tab was closed', async t => {
  const { authPath } = await workspace(t);
  const browser = browserFixture();
  let replacement;
  await refreshAuth({
    authPath,
    launchBrowser: async () => browser,
    confirmLogin: async () => {
      const loginContext = browser.contextRecords[0];
      loginContext.pageList[0].closed = true;
      replacement = await loginContext.newPage();
    }
  });
  assert.ok(replacement.navigationCalls > 0);
  assert.equal(browser.contexts.length, 2);
  assert.deepEqual(JSON.parse(await fs.readFile(authPath, 'utf8')), rotatedState);
});

test('refresh prefers a ready cafe tab over an original tab still showing login', async t => {
  const { authPath } = await workspace(t);
  const browser = browserFixture();
  let readyPage;
  await refreshAuth({
    authPath,
    launchBrowser: async () => browser,
    verificationTimeoutMs: 0,
    confirmLogin: async () => {
      const loginContext = browser.contextRecords[0];
      loginContext.pageList[0].currentUrl = 'https://accounts.daangn.com/login';
      readyPage = await loginContext.newPage();
    }
  });
  assert.ok(readyPage.navigationCalls > 0);
  assert.equal(browser.contexts.length, 2);
  assert.deepEqual(JSON.parse(await fs.readFile(authPath, 'utf8')), rotatedState);
});

for (const callbackTarget of ['same tab', 'new cafe tab']) {
  test(`refresh lets an in-flight login callback finish in ${callbackTarget}`, async t => {
    const { authPath } = await workspace(t);
    const browser = browserFixture();
    let callbackFinished = false;
    let interruptedNavigations = 0;
    let timer;
    try {
      await refreshAuth({
        authPath,
        launchBrowser: async () => browser,
        verificationTimeoutMs: 1000,
        confirmLogin: async () => {
          const loginContext = browser.contextRecords[0];
          const loginPage = loginContext.pageList[0];
          loginPage.currentUrl = 'https://accounts.daangn.com/login';
          const originalGoto = loginPage.goto.bind(loginPage);
          loginPage.goto = async (...args) => {
            if (!callbackFinished) interruptedNavigations += 1;
            return originalGoto(...args);
          };
          timer = setTimeout(() => {
            if (callbackTarget === 'same tab') loginPage.currentUrl = EDITOR_URL;
            else void loginContext.newPage();
            callbackFinished = true;
          }, 20);
        }
      });
      assert.equal(callbackFinished, true);
      assert.equal(interruptedNavigations, 0);
      assert.deepEqual(JSON.parse(await fs.readFile(authPath, 'utf8')), rotatedState);
    } finally {
      clearTimeout(timer);
    }
  });
}

test('verification can retry without losing login or replacing the previous file early', async t => {
  const { directory, authPath } = await workspace(t);
  const browser = browserFixture({ rejectVerification: 1 });
  let confirmations = 0;
  let retries = 0;
  const result = await refreshAuth({
    authPath,
    launchBrowser: async () => browser,
    confirmLogin: async () => { confirmations += 1; },
    verificationTimeoutMs: 0,
    retryVerification: async (error, signal) => {
      retries += 1;
      assert.equal(error.diagnostic.stage, 'fresh_context_editor');
      assert.equal(signal.aborted, false);
      assert.equal(browser.closed, false);
      assert.equal(browser.contextRecords[0].closed, false);
      assert.equal(browser.contextRecords[1].closed, true);
      assert.ok(browser.contextRecords[0].pageList[0].frontCalls > 0);
      await assertUnchanged(directory, authPath);
      return true;
    }
  });
  assert.equal(result.status, 'saved');
  assert.equal(confirmations, 1);
  assert.equal(retries, 1);
  assert.equal(browser.contexts.length, 3);
  assert.deepEqual(browser.snapshots, [0, 0, 2]);
  assert.deepEqual(JSON.parse(await fs.readFile(authPath, 'utf8')), rotatedState);
});

test('canceling after a failed verification preserves previous auth and closes the browser', async t => {
  const { directory, authPath } = await workspace(t);
  const browser = browserFixture({ rejectVerification: true });
  const controller = new AbortController();
  await assert.rejects(refreshAuth({
    authPath,
    launchBrowser: async () => browser,
    confirmLogin: async () => {},
    signal: controller.signal,
    verificationTimeoutMs: 0,
    retryVerification: async () => {
      await assertUnchanged(directory, authPath);
      controller.abort();
      return true;
    }
  }), { code: 'AUTH_REFRESH_CANCELED' });
  assert.equal(browser.closed, true);
  assert.equal(browser.contextRecords[0].closed, true);
  await assertUnchanged(directory, authPath);
});
