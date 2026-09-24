import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3100';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('UX fixture QA is local-only');
const userId = 'b4a744ad-0716-47f4-a7b0-111111111111';
const key = 'oreun:question-draft:v1:' + userId + ':rivals';
const results = [];
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let posts = 0;
    page.on('request', request => { if (request.method() === 'POST' && request.url().startsWith(base + '/qa-community')) posts++; });
    await page.goto(base + '/qa-community', { waitUntil: 'networkidle' });
    const title = page.getByLabel('제목', { exact: false });
    const body = page.getByLabel('내용', { exact: false });
    const submit = page.getByRole('button', { name: '질문 등록', exact: true });
    await title.fill('[실패] 초안 유지 검증 질문');
    await body.fill('작성한 질문의 내용은 실패하거나 새로고침해도 유지되어야 합니다.');
    await page.waitForTimeout(550);
    const nonce = await page.locator('input[name=request_id]').inputValue();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await title.inputValue(), '[실패] 초안 유지 검증 질문');
    assert.equal(await page.locator('input[name=request_id]').inputValue(), nonce);
    await page.goto(base + '/qa-community?account=other', { waitUntil: 'networkidle' });
    assert.equal(await title.inputValue(), '');
    await page.goto(base + '/qa-community?game=arsenal', { waitUntil: 'networkidle' });
    assert.equal(await title.inputValue(), '');
    await page.goto(base + '/qa-community', { waitUntil: 'networkidle' });
    assert.equal(await title.inputValue(), '[실패] 초안 유지 검증 질문');
    const before = posts;
    await page.locator('form[data-testid=question-composer]').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await page.getByRole('button', { name: '등록 중…', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '등록 중…', exact: true }).isDisabled(), true);
    await page.getByRole('alert').filter({ hasText: 'QA 검증 실패' }).waitFor();
    assert.equal(posts - before, 1, 'double submission must invoke one server action');
    assert.equal(await title.inputValue(), '[실패] 초안 유지 검증 질문');
    assert.match(await body.inputValue(), /유지되어야/);
    assert.equal(await page.locator('input[name=request_id]').inputValue(), nonce);
    await title.fill('[로그인] 세션 만료 검증 질문');
    await submit.click();
    await page.getByText('QA 로그인 만료: 초안을 유지합니다.').waitFor();
    assert.equal(await page.getByRole('link', { name: '확인하고 돌아오기 →' }).getAttribute('href'), '/login?next=%2Fqa-community');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await title.inputValue(), '[로그인] 세션 만료 검증 질문');
    await page.screenshot({ path: `qa-community-ux-${name}-390.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await title.fill('정상 저장 검증 질문입니다');
    await submit.click();
    await page.getByRole('heading', { name: 'QA 성공', exact: true }).waitFor();
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), key), null, 'successful commit clears draft');
    await page.goto(base + '/qa-community', { waitUntil: 'networkidle' });
    assert.equal(await title.inputValue(), '');
    await title.fill('지울 초안 검증 질문입니다');
    await body.fill('명시적으로 지우기를 선택하면 입력과 저장된 초안이 없어집니다.');
    await page.waitForTimeout(550);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '초안 지우기' }).click();
    assert.equal(await title.inputValue(), '');
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), key), null);
    for (const [access, label] of [['guest','Google 로그인'],['restricted','문의하기'],['unavailable','다시 확인']]) {
      await page.goto(base + '/qa-community?access=' + access, { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: label, exact: true }).waitFor();
      assert.equal(await page.locator('[data-access-state]').getAttribute('data-access-state'), access);
    }
    await page.goto(base + '/community?state=unanswered&game=rivals', { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('link', { name: '답변 없는 질문', exact: true }).getAttribute('aria-current'), 'page');
    assert.equal(await page.getByLabel('게임', { exact: true }).inputValue(), 'rivals');
    await page.getByRole('link', { name: '해결된 질문', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('state') === 'resolved' && url.searchParams.get('game') === 'rivals');
    await page.goto(base + '/community?scope=following', { waitUntil: 'networkidle' });
    await page.getByText('내 관심 게임은 로그인 후 볼 수 있습니다.').waitFor();
    await page.goto(base + '/game/rivals/questions?state=unanswered', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Google 로그인', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await page.screenshot({ path: `qa-unanswered-${name}-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/qa-community', { waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    await page.screenshot({ path: `qa-community-ux-${name}-1440.png`, fullPage: true });
    assert.deepEqual(errors, []);

    // Seed an expired record BEFORE hydration in an isolated browser context.
    const expiryContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await expiryContext.addInitScript(({ key, userId }) => {
      sessionStorage.setItem(key, JSON.stringify({ version: 1, userId, gameSlug: 'rivals', requestId: 'b4a744ad-0716-47f4-a7b0-222222222222', title: '만료된 질문 초안', body: '24시간이 지난 초안은 복원하지 않습니다.', savedAt: Date.now() - 25 * 60 * 60 * 1000 }));
    }, { key, userId });
    const expiryPage = await expiryContext.newPage();
    await expiryPage.goto(base + '/qa-community', { waitUntil: 'networkidle' });
    assert.equal(await expiryPage.getByLabel('제목', { exact: false }).inputValue(), '');
    assert.equal(await expiryPage.evaluate(key => sessionStorage.getItem(key), key), null);
    await expiryContext.close();

    // Storage failure must not disable writing or submission.
    const blockedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await blockedContext.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('Storage blocked by QA', 'SecurityError'); } });
    });
    const blockedPage = await blockedContext.newPage();
    await blockedPage.goto(base + '/qa-community', { waitUntil: 'networkidle' });
    await blockedPage.getByText(/임시저장을 사용할 수 없습니다/).waitFor();
    await blockedPage.getByLabel('제목', { exact: false }).fill('[실패] 저장소 차단 검증');
    await blockedPage.getByLabel('내용', { exact: false }).fill('저장소가 막혀도 입력과 등록 시도는 계속 가능해야 합니다.');
    await blockedPage.getByRole('button', { name: '질문 등록', exact: true }).click();
    await blockedPage.getByRole('alert').filter({ hasText: 'QA 검증 실패' }).waitFor();
    assert.equal(await blockedPage.getByLabel('제목', { exact: false }).inputValue(), '[실패] 저장소 차단 검증');
    await blockedContext.close();
    results.push({ engine: name, result: 'PASS', checks: ['draft reload','same-user/game isolation','double-submit','pending','error retention','login retention','commit clears draft','manual discard','expired draft removal','blocked storage fallback','3 access states','filter routing','390/1440 layout'] });
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ status: 'PASS', kind: 'local component + public navigation QA; not real Google two-account E2E', results }, null, 2));
