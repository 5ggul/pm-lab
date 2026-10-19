import { volumeSummary } from './volume-policy.mjs';
import fs from 'node:fs/promises';
import { kstDay, isCommercialContent, isUtilityContent } from './growth-engine.mjs';

const read = async (name, fallback) => {
  try { return JSON.parse(await fs.readFile(name, 'utf8')); }
  catch { return fallback; }
};

const [report, published, config, queue] = await Promise.all([
  read('state/editorial-report.json', {}),
  read('state/published.json', []),
  read('growth-config.json', {}),
  read('state/queue.json', [])
]);

const day = kstDay();
const today = published.filter(item =>
  item.status === 'published' && kstDay(new Date(item.publishedAt)) === day
);
const count = today.length;
const commercialCount = today.filter(isCommercialContent).length;
const utilityCount = today.filter(isUtilityContent).length;
const volume = volumeSummary(config, count);
const remaining = volume.remaining === null ? '수량 목표 없음' : `${volume.remaining}건`;
const selectionReady = (report.previews || []).filter(item => item.selectionReady).length;
const copyRejected = (report.previews || []).filter(item => item.rejected).length;
const floor = report.copyQualityFloor ?? config.minCopyQuality ?? 0;
const commercialMax = config.commercialDailyMax ?? 3;
const utilityTarget = config.utilityDailyTarget ?? 2;

const lines = [
  `### 당근 발행 현황 (${day}, KST)`,
  '',
  `실제 발행: **${count}건 / ${volume.capLabel}**`,
  `구성: 상업성 ${commercialCount}/${commercialMax}건 · 생활정보 ${utilityCount}/${utilityTarget}건`,
  `이번 실행: ${report.mode || 'unknown'}`,
  `검증 후보: ${queue.length}건 / 최종 선택 가능: ${selectionReady}건 / 카피 탈락: ${copyRejected}건`,
  `최종 카피 품질 하한: ${floor}점 / 남은 발행 가능량: ${remaining}`,
  `발행 간 최소 간격: ${volume.minPublishGapMinutes}분`,
  selectionReady === 0 && queue.length
    ? '경고: 큐는 있지만 최종 선택 가능한 후보가 0건입니다. 카피 점수·반복·카테고리 필터를 확인하세요.'
    : `하루 최대 ${config.dailyMax ?? 5}건, 상업성 최대 ${commercialMax}건, 검증된 생활정보 목표 ${utilityTarget}건입니다. 적격 후보가 없으면 빈 슬롯으로 둡니다.`,
  '',
  ...((report.collection || []).map(item =>
    `- ${item.source}: ${item.count || 0}건${item.failures?.length ? `, 실패/보류 ${item.failures.length}건` : ''}`
  ))
];

if (process.env.GITHUB_STEP_SUMMARY) {
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}
console.log(lines.join('\n'));
