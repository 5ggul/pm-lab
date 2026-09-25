import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const CAFE_SLUG = process.env.DAANGN_CAFE_SLUG || 'don-akkineun-sa';
const CAFE_BASE = `https://cafe.daangn.com/${CAFE_SLUG}`;
const BANNED = /(확인됩니다|확인해주세요|한 번 더 확인|쿠폰 적용 여부|가격 변동|판매처:\s|확인가:\s)/;

async function downloadImage(url) {
  if (!url) return '';
  const r = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 DealOpsCloud/2.0', accept: 'image/avif,image/webp,image/*,*/*' }
  });
  if (!r.ok) return '';
  const type = (r.headers.get('content-type') || '').toLowerCase();
  if (!type.startsWith('image/')) return '';
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 5000) return '';
  const ext = type.includes('png') ? '.png' :
    type.includes('webp') ? '.webp' :
    type.includes('avif') ? '.avif' : '.jpg';
  const file = path.join(os.tmpdir(), 'daangn-upload-' + Date.now() + ext);
  await fs.writeFile(file, buf);
  return file;
}

function validate(item) {
  if (!item?.postTitle || !item?.postBody || !item?.board) throw new Error('INVALID_ITEM');
  if (item.postTitle.includes('｜')) throw new Error('BANNED_TITLE_SEPARATOR');
  if (BANNED.test(item.postTitle) || BANNED.test(item.postBody)) throw new Error('BANNED_AI_PHRASE');
  if (item.postTitle.length > 90) item.postTitle = item.postTitle.slice(0, 90).trim();
  return item;
}

async function selectBoard(page, board) {
  const current = page.getByRole('button', { name: '자유 게시판', exact: true });
  if (await current.count()) {
    await current.first().click();
  } else {
    const selector = page.locator('button').filter({ hasText: /게시판|핫딜|꿀팁|카드|생활|오늘어디가지/ }).first();
    if (!await selector.count()) throw new Error('BOARD_SELECTOR_MISSING');
    await selector.click();
  }
  const option = page.getByRole('option', { name: board, exact: true });
  await option.waitFor({ state: 'visible', timeout: 5000 });
  await option.click();
}

async function isAuthenticated(page) {
  if (/login|accounts/.test(page.url())) return false;
  const title = page.locator('input[placeholder="제목을 입력해주세요."]');
  return (await title.count()) > 0;
}

export async function publishOne(item) {
  validate(item);
  const encoded = process.env.DAANGN_AUTH_STATE_B64 || '';
  if (!encoded) return { status: 'auth_missing' };

  let storageState;
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8').replace(/^\uFEFF/, '');
    storageState = JSON.parse(decoded);
  } catch {
    throw new Error('AUTH_SECRET_INVALID');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();
  let imageFile = '';
  let submitClicked = false;

  try {
    await page.goto(`${CAFE_BASE}/posts/new`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(800);
    if (!await isAuthenticated(page)) return { status: 'auth_expired' };

    await selectBoard(page, item.board);

    const title = page.locator('input[placeholder="제목을 입력해주세요."]');
    await title.fill(item.postTitle);

    const editor = page.locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: 5000 });
    await editor.fill(item.postBody);

    if (item.imageUrl) {
      imageFile = await downloadImage(item.imageUrl);
      if (imageFile) {
        const input = page.locator('input[type="file"][accept*="image"]').first();
        if (await input.count()) {
          await input.setInputFiles(imageFile);
          await page.waitForTimeout(900);
        }
      }
    }

    const submit = page.getByRole('button', { name: '글쓰기', exact: true });
    if (!await submit.count()) throw new Error('SUBMIT_BUTTON_MISSING');
    submitClicked = true;
    await submit.last().click();

    try {
      await page.waitForURL(u => u.pathname.includes('/posts/') && !u.pathname.endsWith('/posts/new'), { timeout: 12000 });
      const postUrl = page.url().replace(/[?].*$/, '');
      return { status: 'published', postUrl };
    } catch {
      await page.screenshot({ path: 'last-publish-uncertain.png', fullPage: true }).catch(() => {});
      return { status: 'needs_review', reason: 'submit_clicked_but_not_verified' };
    }
  } catch (e) {
    await page.screenshot({ path: 'last-publish-error.png', fullPage: true }).catch(() => {});
    if (submitClicked) return { status: 'needs_review', reason: String(e?.message || e) };
    throw e;
  } finally {
    if (imageFile) await fs.rm(imageFile, { force: true }).catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
