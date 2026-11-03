import fs from 'node:fs/promises';
import { publicationHealth } from './publication-health.mjs';

// This command is read-only: the workflow owns the incident issue lifecycle.
const rows = JSON.parse(await fs.readFile('state/published.json', 'utf8'));
const health = publicationHealth(rows);
console.log(JSON.stringify(health));
if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(process.env.GITHUB_OUTPUT, `stalled=${health.stalled}\n`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const last = health.lastConfirmedAt || '확인된 게시 없음';
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### 싸그리 실제 발행 점검\n확인된 마지막 게시: ${last} (UTC)\n` +
    `오늘 실제 게시: ${health.confirmedToday}건 · ${health.thresholdHours}시간 이상 중단: ${health.stalled ? '예' : '아니요'}\n`);
}
