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

function browserFixture({ rejectVerification = false, wrongEditor = false } = {}) {
  const browser = new EventEmitter();
  browser.contexts = [];
  browser.snapshots = [];
  browser.newContext = async options => {
    const index = browser.contexts.length;
    browser.contexts.push(options);
    const title = {
      first() { return this; },
      async waitFor() {
        if (index === 1 && rejectVerification) throw new Error('fixture: session rejected');
      },
      async isVisible() { return true; },
      async isEditable() { return true; }
    };
    const page = {
      async goto(url) { assert.equal(url, EDITOR_URL); },
      locator(selector) {
        assert.equal(selector, 'input[placeholder="제목을 입력해주세요."]');
        return title;
      },
      url() {
        return index === 1 && wrongEditor
          ? 'https://cafe.daangn.com/another-cafe/posts/new'
          : EDITOR_URL;
      }
    };
    // No fill/click/submit methods are provided: this helper only checks access.
    return {
      newPage: async () => page,
      storageState: async snapshotOptions => {
        assert.equal(snapshotOptions.indexedDB, true);
        browser.snapshots.push(index);
        return index === 0 ? initialState : rotatedState;
      },
      addInitScript: async () => {},
      close: async () => {}
    };
  };
  browser.close = async () => { browser.emit('disconnected'); };
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
    confirmLogin: async () => {}
  }), { code: 'AUTH_VERIFY_FAILED' });
  await assertUnchanged(directory, authPath);
});

test('access to a different cafe cannot authorize replacement', async t => {
  const { directory, authPath } = await workspace(t);
  await assert.rejects(refreshAuth({
    authPath,
    launchBrowser: async () => browserFixture({ wrongEditor: true }),
    confirmLogin: async () => {}
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
