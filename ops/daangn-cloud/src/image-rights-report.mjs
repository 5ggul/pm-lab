import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  imageRightsRegistrySnapshot,
  normalizeImageRightsUrl,
  resolveImageRights
} from './image-rights.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, 'state');
const queuePath = path.join(STATE, 'queue.json');
const outputPath = path.join(STATE, 'image-rights-review.json');

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

const queue = await readJson(queuePath, []);
const registry = imageRightsRegistrySnapshot();
const checkedAt = new Date();
const candidates = queue
  .filter(item => item?.imageRequired === true)
  .map(item => {
    const result = resolveImageRights(item, { registry, now: checkedAt });
    return {
      id: item.id || null,
      title: item.title || item.copyContext?.product || item.postTitle || null,
      sourceUrl: normalizeImageRightsUrl(item.sourceUrl || item.buyUrl) || null,
      imageUrl: normalizeImageRightsUrl(item.imageUrl) || null,
      offerFingerprint: item.verification?.fingerprint || null,
      approved: result.approved,
      reason: result.reason,
      rightsId: result.evidence?.id || null
    };
  });

const report = {
  version: 1,
  generatedAt: checkedAt.toISOString(),
  registryMode: registry.mode || null,
  registryLoadError: registry.loadError || null,
  totalCandidates: candidates.length,
  approved: candidates.filter(item => item.approved).length,
  needsReview: candidates.filter(item => !item.approved).length,
  candidates
};

await fs.mkdir(STATE, { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  stage: 'image-rights-report',
  outputPath,
  totalCandidates: report.totalCandidates,
  approved: report.approved,
  needsReview: report.needsReview
}));
