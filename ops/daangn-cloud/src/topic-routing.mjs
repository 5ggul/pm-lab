const BOARD = Object.freeze({
  deal: '🎁 핫딜 정보',
  tip: '💰 꿀팁 공유',
  card: '💳 카드 혜택',
  life: '📢 생활 이슈',
  refund: '🔍 환급 질문'
});

const CARD_RE = /(신용|체크)?카드|카드포인트|포인트(?:현금화|통합조회)?|자동납부|간편결제|선불|페이\b|문화누리|바우처/i;
const EVENT_RE = /축제|행사|공연|전시|박람회|체험|문화주간|이벤트|나들이/i;
const REFUND_RE = /환급|미환급|숨은\s*돈|휴면|돌려받|환불/i;

function routeText(item = {}) {
  const context = item.copyContext || {};
  return [
    item.title,
    item.postTitle,
    item.type,
    context.kind,
    context.intent,
    context.category,
    context.sourceTitle,
    context.readerNeed,
    ...(context.facts || []),
    ...(context.conditions || [])
  ].filter(Boolean).join(' ');
}

export function routeContent(item = {}) {
  const context = item.copyContext || {};
  const kind = context.kind || item.contentKind || item.type || '';
  const text = routeText(item);
  const cardLike = CARD_RE.test(text);
  const eventLike = EVENT_RE.test(text);
  const refundLike = REFUND_RE.test(text);

  if (kind === 'hotdeal' || item.type === 'hotdeal') {
    return { family: 'deal', type: 'hotdeal', board: BOARD.deal };
  }
  if (kind === 'comparison') {
    return { family: 'comparison', type: 'tip', board: BOARD.tip };
  }
  if (kind === 'event' || (kind === 'researched' && eventLike)) {
    return { family: 'event', type: 'event', board: BOARD.life };
  }
  if (cardLike && ['benefit', 'service', 'researched', 'digest', 'question'].includes(kind)) {
    return { family: 'card', type: 'card', board: BOARD.card };
  }
  if (kind === 'researched' || kind === 'digest' || kind === 'policy') {
    return { family: 'life', type: 'life', board: BOARD.life };
  }
  if (kind === 'benefit') {
    return { family: 'benefit', type: 'tip', board: BOARD.tip };
  }
  if (kind === 'service') {
    return { family: 'service', type: 'tip', board: BOARD.tip };
  }
  if (kind === 'question' && refundLike) {
    return { family: 'refund', type: 'tip', board: BOARD.refund };
  }
  return { family: refundLike ? 'refund' : 'utility', type: 'tip', board: BOARD.tip };
}

export function applyTopicRoute(item = {}) {
  const route = routeContent(item);
  item.type = route.type;
  item.board = route.board;
  item.topicFamily = route.family;
  item.contentRoute = { ...route, version: 1 };
  return item;
}

export function topicFamilyFor(item = {}) {
  return item.topicFamily || item.contentRoute?.family || routeContent(item).family;
}

export function isUtilityPublicationType(value) {
  return ['tip', 'card', 'life', 'event'].includes(value);
}

export const topicBoards = BOARD;
