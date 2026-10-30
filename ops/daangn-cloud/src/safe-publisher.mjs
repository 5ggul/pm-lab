import http from 'node:http';
import { chromium } from 'playwright';
import { publishOne as originalPublishOne } from './publisher.mjs?image-safety-original=1';
import { buildInfoCardModel, imageSafetyPlan, renderInfoCardHtml } from './image-safety.mjs';
import { assertPublicationRoute } from './topic-routing.mjs';

async function renderInfoCard(item) {
  const model = buildInfoCardModel(item);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.setContent(renderInfoCardHtml(model), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts?.ready);
    const buffer = await page.locator('#card').screenshot({ type: 'png' });
    if (!buffer || buffer.length < 5000) throw new Error('GENERATED_INFO_CARD_INVALID');
    return buffer;
  } finally {
    await browser.close();
  }
}

async function withLocalPng(buffer, run) {
  const server = http.createServer((request, response) => {
    if (request.url !== '/card.png') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }
    response.writeHead(200, {
      'content-type': 'image/png',
      'content-length': String(buffer.length),
      'cache-control': 'no-store'
    });
    response.end(buffer);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/card.png`;
  try {
    return await run(url);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function publishGeneratedCard(item, options, safetyReason) {
  const png = await renderInfoCard(item);
  return withLocalPng(png, async imageUrl => {
    const safeItem = {
      ...item,
      imageUrl,
      imageUsageApproved: true,
      imageRights: {
        status: 'approved',
        basis: 'owned_original',
        sourceUrl: 'https://github.com/5ggul/pm-lab',
        evidence: 'Original information card generated from verified facts without third-party imagery.'
      }
    };
    const result = await originalPublishOne(safeItem, options);
    return { ...result, imageMode: 'generated_info_card', imageSafetyReason: safetyReason };
  });
}

export async function publishOne(item, options = {}) {
  assertPublicationRoute(item);
  const plan = imageSafetyPlan(item);
  if (plan.mode === 'none') {
    const result = await originalPublishOne({ ...item, imageUrl: '', imageUsageApproved: false }, options);
    return { ...result, imageMode: 'none', imageSafetyReason: plan.reason };
  }

  if (plan.mode === 'remote') {
    try {
      const result = await originalPublishOne(item, options);
      return { ...result, imageMode: 'approved_remote', imageSafetyReason: plan.reason };
    } catch (error) {
      if (item.imageRequired === true && String(error?.message || error).includes('PRODUCT_IMAGE_NOT_ATTACHED')) {
        return publishGeneratedCard(item, options, 'approved_remote_download_failed');
      }
      throw error;
    }
  }

  // Preserve the publisher's normal auth-missing response without launching Chromium.
  if (!process.env.DAANGN_AUTH_STATE_B64) {
    return originalPublishOne({ ...item, imageUrl: '', imageUsageApproved: false }, options);
  }

  try {
    return await publishGeneratedCard(item, options, plan.reason);
  } catch (error) {
    error.beforeSubmit = true;
    throw error;
  }
}
