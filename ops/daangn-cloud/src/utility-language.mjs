const clean = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();

const REPLACEMENTS = [
  [/체감할 수 있는 변화가 있었고[,]?\s*/g, ''],
  [/체감할 수 있는/g, '실제로 적용된'],
  [/핵심만 보면/g, ''],
  [/기준으로 보면/g, ''],
  [/결국/g, ''],
  [/한 번 더 확인/g, '다시 확인'],
  [/한 번 체크해보세요/g, '확인할 수 있습니다'],
  [/꼼꼼히 확인하세요/g, '조건을 확인할 수 있습니다'],
  [/확인해주세요/g, '확인할 수 있습니다'],
  [/확인됩니다/g, '확인할 수 있습니다'],
  [/참고하시면 좋을 것 같(?:아요|습니다)/g, '참고할 수 있습니다'],
  [/도움이 되실 것 같(?:아요|습니다)/g, '이용할 수 있습니다'],
  [/추천드립니다/g, '이용할 수 있습니다'],
  [/합리적인 가격/g, '표시 가격'],
  [/경쟁력 있는 가격/g, '표시 가격'],
  [/덜 내는 셈/g, '비용이 줄어듭니다'],
  [/아끼는 셈/g, '비용이 줄어듭니다']
];

function alternateEnding(text, index) {
  if (index % 2 === 0) return text;
  return text
    .replace(/했어요\.$/, '했습니다.')
    .replace(/해요\.$/, '합니다.')
    .replace(/있어요\.$/, '있습니다.')
    .replace(/없어요\.$/, '없습니다.')
    .replace(/돼요\.$/, '됩니다.')
    .replace(/예요\.$/, '입니다.')
    .replace(/이에요\.$/, '입니다.')
    .replace(/가능해요\.$/, '가능합니다.')
    .replace(/받아요\.$/, '받습니다.');
}

export function sanitizeUtilityText(value, index = 0) {
  let text = clean(value);
  for (const [pattern, replacement] of REPLACEMENTS) text = text.replace(pattern, replacement);
  text = clean(text).replace(/\s+([,.!?])/g, '$1');
  return alternateEnding(text, index);
}

export function normalizeUtilityContext(context = {}) {
  const originals = [...new Set([
    ...(context.facts || []),
    ...(context.requiredFacts || []),
    ...(context.conditions || []),
    ...(context.requiredConditions || []),
    ...(context.benefitLines || [])
  ].filter(Boolean))];
  const mapped = new Map(originals.map((value, index) => [value, sanitizeUtilityText(value, index)]));
  const mapList = values => (values || []).map(value => mapped.get(value) || sanitizeUtilityText(value));

  return {
    ...context,
    sourceTitle: sanitizeUtilityText(context.sourceTitle),
    readerNeed: sanitizeUtilityText(context.readerNeed),
    editorialAngle: sanitizeUtilityText(context.editorialAngle),
    shareRecipient: sanitizeUtilityText(context.shareRecipient),
    returnReason: sanitizeUtilityText(context.returnReason),
    headlineCandidates: mapList(context.headlineCandidates),
    facts: mapList(context.facts),
    requiredFacts: mapList(context.requiredFacts),
    conditions: mapList(context.conditions),
    requiredConditions: mapList(context.requiredConditions),
    benefitLines: mapList(context.benefitLines),
    claims: (context.claims || []).map(claim => ({
      ...claim,
      value: mapped.get(claim.value) || sanitizeUtilityText(claim.value)
    }))
  };
}

export function normalizeUtilityItem(item = {}) {
  const kind = item.copyContext?.kind;
  // Registry-backed services are already human-reviewed and their exact facts
  // are part of the source-integrity contract. Normalize only generated or
  // composite utility copy that can carry repetitive/AI-like phrasing.
  if (!['benefit', 'researched', 'digest', 'question', 'event', 'policy'].includes(kind)) return item;
  item.copyContext = normalizeUtilityContext(item.copyContext);
  if (item.title) item.title = sanitizeUtilityText(item.title);
  return item;
}
