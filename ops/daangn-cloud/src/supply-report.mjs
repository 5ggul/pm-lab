import { volumeSummary } from './volume-policy.mjs';
import fs from 'node:fs/promises';
import { kstDay, isCommercialContent, isUtilityContent, chooseItem } from './growth-engine.mjs';

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
const readyPreviews = new Map((report.previews || []).filter(item => item.selectionReady).map(item => [item.id, item]));
const remainingCandidates = queue.flatMap(item => {
  const preview = readyPreviews.get(item.id);
  return preview ? [{ ...item, postTitle: preview.title, postBody: preview.body,
    qualityScores: preview.qualityScores || item.qualityScores }] : [];
});
const nextEligible = chooseItem(remainingCandidates, published.filter(item => item.status === 'published').slice(-100),
  today, config, () => 1, new Date());
const burstReady = (report.previews || []).filter(item => item.burstEligible).length;
const copyRejected = (report.previews || []).filter(item => item.rejected).length;
const floor = report.copyQualityFloor ?? config.minCopyQuality ?? 0;
const commercialMax = config.commercialDailyMax ?? 4;
const utilityTarget = config.utilityDailyTarget ?? 3;
const lastPublished = published
  .filter(item => item.status === 'published' && Number.isFinite(Date.parse(item.publishedAt)))
  .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0];
const hoursSincePublished = lastPublished
  ? (Date.now() - Date.parse(lastPublished.publishedAt)) / 3600_000
  : Infinity;
const publicationStarved = hoursSincePublished >= 48;
const shopping = report.shoppingDiagnostics || {};

const lines = [
  `### 당근 발행 현황 (${day}, KST)`,
  '',
  `실제 발행: **${count}건 / ${volume.capLabel}**`,
  `구성: 상업성 ${commercialCount}/${commercialMax}건 · 생활정보 ${utilityCount}/${utilityTarget}건`,
  `이번 실행: ${report.mode || 'unknown'}${report.burstSlot ? ' · 우수 후보 보너스 슬롯' : ''}`,
  `현재 대기열: ${queue.length}건 / 수집 당시 카피 통과: ${selectionReady}건 / 우수 후보: ${burstReady}건 / 카피 탈락: ${copyRejected}건`,
  `현재 대기열 중 카피 통과: ${remainingCandidates.length}건 · 당일 구성·종류·분야 제한까지 통과해 다음 슬롯에 편성 가능: ${nextEligible ? '1건 이상' : '0건'} (발행 직전 원문 재검증은 별도)`,
  `일반 카피 하한: ${floor}점 / 추가 발행 하한: ${config.burstMinCopyQuality ?? 88}점 / 남은 최대 발행량: ${remaining}`,
  `발행 간 최소 간격: ${volume.minPublishGapMinutes}분`,
  shopping.cjOfficialListing
    ? `CJ 공식몰 검증: 목록 ${shopping.cjOfficialListing.discovered}건 · 상세확인 ${shopping.cjOfficialListing.detailChecked}건 · 통과 ${shopping.cjOfficialListing.verifiedOffers}건${shopping.cjOfficialListing.error ? ' · 접근 실패: ' + shopping.cjOfficialListing.error : ''}`
    : 'CJ 공식몰 검증: 이전 실행(새 수집 코드 미적용)',
  shopping.officialListing
    ? `공식 타임딜 목록 검증: ${shopping.officialListing.verifiedOffers}건${shopping.officialListing.error ? ' · 접근 실패: ' + shopping.officialListing.error : ''}`
    : '공식 타임딜 목록 검증: 이전 실행(새 수집 코드 미적용)',
  publicationStarved
    ? `⚠️ 48시간 이상 발행 중단: 마지막 확인된 게시 ${lastPublished ? lastPublished.publishedAt + ' (UTC)' : '기록 없음'}. 실행 성공과 게시 성공은 다릅니다.`
    : `최근 확인된 게시: ${lastPublished?.publishedAt || '없음'} (UTC)`,
  selectionReady === 0 && queue.length
    ? '경고: 큐는 있지만 이번 슬롯 조건을 통과한 후보가 없습니다. 품질을 낮춰 억지 발행하지 않습니다.'
    : `기본 ${volume.baseDailyTarget}건이며, 검증된 우수 후보가 있으면 최대 ${config.dailyMax ?? 8}건까지 늘어납니다. 상업성 최대 ${commercialMax}건, 생활정보 목표 ${utilityTarget}건입니다.`,
  '',
  ...((report.collection || []).map(item =>
    `- ${item.source}: ${item.count || 0}건${item.failures?.length ? `, 실패/보류 ${item.failures.length}건` : ''}`
  ))
];

if (process.env.GITHUB_STEP_SUMMARY) {
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}
console.log(lines.join('\n'));
if (publicationStarved && process.env.GITHUB_ACTIONS === 'true') {
  console.log('::warning::Daangn publication has been idle 48h or longer; workflow success does not mean publishing recovered.');
}
