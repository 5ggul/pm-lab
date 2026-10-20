import { shoppingScope } from './content-scope.mjs';
import { learningFactorForItem } from './learning-engine.mjs';
import { burstQualityEligible, capReached, configuredCap, submittedTypeCount } from './volume-policy.mjs';

export function isUtilityItem(item) {
  return ['benefit', 'service', 'researched', 'digest'].includes(item?.copyContext?.kind || item?.contentKind);
}

const categoryOf = item => item?.copyContext?.category || item?.topic || '';
const kindOf = item => item?.copyContext?.kind || item?.contentKind || '';
const seriesOf = item => item?.editorialPlan?.seriesId || item?.copyContext?.seriesId || '';
const layoutOf = item => item?.copyMeta?.surfaceFamily || item?.copyMeta?.layoutFamily || '';

/** Rank only fact-checked drafts. Novelty can beat a one-point quality gap. */
export function rankUtilityCandidates(previews, recent, today, weights, config, burstRequired = false) {
  const history = recent.filter(isUtilityItem).slice(-12);
  const last = history.at(-1);
  const kinds = history.map(kindOf).filter(Boolean);
  const series = history.map(seriesOf).filter(Boolean);
  const layouts = history.map(layoutOf).filter(Boolean);
  const targets = config.utilityKindPortfolio || {};
  return previews
    .filter(item => !item.copyRejected && isUtilityItem(item) && shoppingScope(item))
    .filter(item => item.editorialPlan?.status === 'eligible')
    .filter(item => Number.isFinite(item.qualityScores?.finalScore) && item.qualityScores.finalScore >= (config.minCopyQuality ?? 72))
    .filter(item => !burstRequired || burstQualityEligible(item, config))
    .filter(item => {
      const typeCount = submittedTypeCount(today, item.type);
      return !capReached(typeCount, configuredCap(config.typeCaps?.[item.type], null));
    })
    .filter(item => {
      const category = categoryOf(item);
      const categoryCap = configuredCap(config.categoryDailyCaps?.[category], configuredCap(config.topicDailyMax, null));
      return !capReached(today.filter(post => categoryOf(post) === category).length, categoryCap);
    })
    .map(item => {
      const kind = kindOf(item), category = categoryOf(item), itemSeries = seriesOf(item), layout = layoutOf(item);
      const sameKind = kinds.filter(value => value === kind).length;
      const sameSeries = itemSeries ? series.filter(value => value === itemSeries).length : 0;
      const sameLayout = layout ? layouts.filter(value => value === layout).length : 0;
      const sameCategoryToday = today.filter(post => categoryOf(post) === category).length;
      const target = targets[kind];
      const deficitBonus = Number.isFinite(target)
        ? Math.max(-25, Math.min(35, (target - sameKind / Math.max(1, kinds.length)) * 100))
        : 0;
      const lastCategoryPenalty = last && categoryOf(last) === category ? 24 : 0;
      const diversity = 80 - sameKind * 7 - sameSeries * 9 - sameLayout * 18 - sameCategoryToday * 16 - lastCategoryPenalty;
      const quality = item.qualityScores.finalScore;
      const editorial = Number.isFinite(item.editorialPlan.score) ? item.editorialPlan.score : 0;
      const rawLearning = learningFactorForItem(item, weights);
      const learning = Number.isFinite(rawLearning) ? Math.min(1.25, Math.max(0.75, rawLearning)) : 1;
      return { item, score: quality * 3 + editorial * 1.2 + diversity + deficitBonus + learning * 10 };
    })
    .sort((a, b) => b.score - a.score || String(a.item.id || '').localeCompare(String(b.item.id || '')));
}

export function chooseUtility(previews, recent, today, weights, config, burstRequired = false) {
  return rankUtilityCandidates(previews, recent, today, weights, config, burstRequired)[0]?.item || null;
}
