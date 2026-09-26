import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateGeneratedCopy } from './copy-engine.mjs';

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
  if (item.postTitle.length > 90) item.postTitle = item.postTitle.slice(0, 90).trim();
  const qa = validateGeneratedCopy(item, item.postTitle, item.postBody, [], item.platform || 'daangn');
  if (!qa.ok) throw new Error('COPY_QA_FAILED:' + qa.reasons.join(','));
  item.copyMeta = item.copyMeta || qa.meta;
  item.qualityScores = item.qualityScores || qa.scores;
  return item;
}

const BOARD_ALIASES = Object.freeze({
  '📍 오늘어디가지': '💰 꿀팁 공유'
});
const BOARD_ORDER = Object.freeze([
  '자유 게시판',
  '공지사항',
  '중고거래',
  '💰 꿀팁 공유',
  '💸 절약 인증',
  '🎁 핫딜 정보',
  '💳 카드 혜택',
  '🔍 환급 질문',
  '📢 생활 이슈',
  '가입인사'
]);

async function clickClosestExactText(page, text) {
  return page.evaluate((wanted) => {
    const anchor = document.querySelector('input[placeholder="제목을 입력해주세요."]');
    const anchorBox = anchor?.getBoundingClientRect();
    const visible = (el) => {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        box.width > 0 &&
        box.height > 0;
    };
    const nodes = [...document.querySelectorAll(
      'button,[role="option"],[role="menuitem"],[role="menuitemradio"],[role="radio"],li,div,span'
    )]
      .filter(el => {
        if ((el.textContent || '').trim() !== wanted || !visible(el)) return false;
        if (el.closest('nav,aside')) return false;
        if (el.closest('a[href]') && !el.matches('[role="menuitem"],[role="menuitemradio"],[role="option"]')) return false;
        return true;
      })
      .map(el => {
        const box = el.getBoundingClientRect();
        const distance = anchorBox
          ? Math.abs(box.top - anchorBox.top) + Math.abs(box.left - anchorBox.left)
          : 0;
        return { el, distance, area: box.width * box.height };
      })
      .sort((a, b) => a.distance - b.distance || a.area - b.area);

    const hit = nodes[0]?.el;
    if (!hit) return false;
    hit.click();
    return true;
  }, text);
}

async function boardSelectorButton(page) {
  const known = /^(?:게시판을 선택해주세요|자유 게시판|공지사항|중고거래|💰 꿀팁 공유|💸 절약 인증|🎁 핫딜 정보|💳 카드 혜택|🔍 환급 질문|📢 생활 이슈|가입인사)$/;
  const title = page.locator('input[placeholder="제목을 입력해주세요."]');
  const titleBox = await title.boundingBox();
  const buttons = page.locator('button');
  const hits = [];

  for (let i = 0, count = await buttons.count(); i < count; i += 1) {
    const button = buttons.nth(i);
    if (!await button.isVisible().catch(() => false)) continue;
    const text = (await button.innerText().catch(() => '')).trim();
    if (!known.test(text)) continue;
    const box = await button.boundingBox();
    if (!box) continue;
    const distance = titleBox
      ? Math.abs(box.y - titleBox.y) + Math.abs(box.x - titleBox.x)
      : i;
    hits.push({ button, distance, text });
  }

  hits.sort((a, b) => a.distance - b.distance);
  return hits[0] || null;
}

async function currentBoardText(page) {
  const selector = await boardSelectorButton(page);
  return selector?.text || '';
}

async function selectBoardWithKeyboard(page, candidate) {
  const index = BOARD_ORDER.indexOf(candidate);
  if (index < 0) return '';

  const selector = await boardSelectorButton(page);
  if (!selector) return '';

  // Ensure the list is open. If it already is, an extra click merely toggles it;
  // verify and reopen once when needed.
  if (selector.text !== '게시판을 선택해주세요') {
    await selector.button.click().catch(() => {});
    await page.waitForTimeout(120);
  }

  await page.keyboard.press('Home').catch(() => {});
  for (let i = 0; i < index; i += 1) {
    await page.keyboard.press('ArrowDown').catch(() => {});
  }
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(220);
  return currentBoardText(page);
}

async function selectBoard(page, board) {
  const preferred = BOARD_ALIASES[board] || board;
  const names = [...new Set([preferred, board])];

  let selector = await boardSelectorButton(page);
  if (!selector) throw new Error('BOARD_SELECTOR_MISSING');

  const initialBoard = selector.text || '게시판을 선택해주세요';
  if (names.includes(initialBoard)) return initialBoard;

  await selector.button.click();
  await page.waitForTimeout(180);

  for (const candidate of names) {
    const clicked = await clickClosestExactText(page, candidate).catch(() => false);
    if (clicked) {
      await page.waitForTimeout(220);
      const actual = await currentBoardText(page);
      if (actual && actual !== '게시판을 선택해주세요') {
        console.log(JSON.stringify({
          stage: 'board-selected',
          requested: board,
          selected: actual,
          method: 'text'
        }));
        return actual;
      }
    }
  }

  // Radix/native-select style menus remain keyboard navigable even when
  // their portal markup changes and text locators fail.
  for (const candidate of names) {
    selector = await boardSelectorButton(page);
    if (!selector) break;
    const current = selector.text || '';
    if (current !== '게시판을 선택해주세요' && current !== initialBoard) {
      if (names.includes(current)) return current;
      await selector.button.click().catch(() => {});
      await page.waitForTimeout(120);
    } else if (current === '게시판을 선택해주세요') {
      await selector.button.click().catch(() => {});
      await page.waitForTimeout(120);
    }

    const actual = await selectBoardWithKeyboard(page, candidate).catch(() => '');
    if (actual === candidate) {
      console.log(JSON.stringify({
        stage: 'board-selected',
        requested: board,
        selected: actual,
        method: 'keyboard'
      }));
      return actual;
    }
  }

  const actualAfterAttempts = await currentBoardText(page);
  if (actualAfterAttempts && actualAfterAttempts !== '게시판을 선택해주세요') {
    console.log(JSON.stringify({
      stage: 'board-fallback',
      requested: board,
      selected: actualAfterAttempts,
      reason: 'requested-board-not-confirmed'
    }));
    return actualAfterAttempts;
  }

  selector = await boardSelectorButton(page);
  if (selector) {
    await selector.button.click().catch(() => {});
    await page.waitForTimeout(120);
  }
  const fallbackClicked = await clickClosestExactText(page, '자유 게시판').catch(() => false);
  if (fallbackClicked) {
    await page.waitForTimeout(220);
    const fallbackActual = await currentBoardText(page);
    if (fallbackActual && fallbackActual !== '게시판을 선택해주세요') {
      console.log(JSON.stringify({
        stage: 'board-fallback',
        requested: board,
        selected: fallbackActual,
        reason: 'requested-board-not-found'
      }));
      return fallbackActual;
    }
  }

  await page.keyboard.press('Escape').catch(() => {});
  throw new Error('BOARD_OPTION_MISSING:' + board);
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
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 800, height: 600 }
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
  });
  const page = await context.newPage();
  let imageFile = '';
  let submitClicked = false;

  try {
    await page.goto(`${CAFE_BASE}/posts/new`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(800);
    if (!await isAuthenticated(page)) return { status: 'auth_expired' };

    const actualBoard = await selectBoard(page, item.board);

    const title = page.locator('input[placeholder="제목을 입력해주세요."]');
    await title.fill(item.postTitle);

    const editor = page.locator('.ProseMirror');
    await editor.waitFor({ state: 'visible', timeout: 5000 });
    await editor.evaluate((el, body) => {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('insertText', false, body);
    }, item.postBody);
    await page.waitForTimeout(300);

    if (item.imageUrl) {
      imageFile = await downloadImage(item.imageUrl);
      if (imageFile) {
        const input = page.locator('input[type="file"][accept*="image"]').first();
        if (await input.count()) {
          await input.setInputFiles(imageFile);
          const preparing = page.getByText('준비중', { exact: true });
          if (await preparing.count()) {
            await preparing.last().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
          }
          await page.waitForTimeout(500);
        }
      }
    }

    const submit = page.getByRole('button', { name: '글쓰기', exact: true }).last();
    if (!await submit.count()) throw new Error('SUBMIT_BUTTON_MISSING');
    await page.waitForFunction(() => {
      const buttons = [...document.querySelectorAll('button')]
        .filter(b => (b.textContent || '').trim() === '글쓰기');
      const button = buttons.at(-1);
      return !!button && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
    }, null, { timeout: 15000 });
    submitClicked = true;
    await submit.click();

    try {
      await page.waitForURL(u => u.pathname.includes('/posts/') && !u.pathname.endsWith('/posts/new'), { timeout: 8000 });
      const postUrl = page.url().replace(/[?].*$/, '');
      return { status: 'published', postUrl, board: actualBoard };
    } catch {
      const verify = await context.newPage();
      try {
        await verify.goto(CAFE_BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await verify.waitForTimeout(1200);
        const found = await verify.locator('a').evaluateAll((links, title) => {
          const hit = links.find(a => (a.href || '').includes('/posts/') && (a.innerText || '').includes(title));
          return hit ? hit.href : '';
        }, item.postTitle);
        if (found) return { status: 'published', postUrl: found.replace(/[?].*$/, ''), board: actualBoard };
      } finally {
        await verify.close().catch(() => {});
      }
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
