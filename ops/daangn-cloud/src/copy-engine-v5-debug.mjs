import { selectCommunityCopy } from './copy-engine.mjs';

const hot = {
  id: 'test:hot:1',
  type: 'hotdeal',
  board: '🎁 핫딜 정보',
  sourceUrl: 'https://example.com/p/1',
  price: 16500,
  saving: 5500,
  discountPct: 25,
  baselineSource: '상품 페이지 기준가',
  copyContext: {
    kind: 'hotdeal',
    intent: 'DEAL_UNIT',
    product: '테스트 물티슈 20팩',
    price: 16500,
    baselinePrice: 22000,
    baselineSource: '상품 페이지 기준가',
    saving: 5500,
    discountPct: 25,
    unitInfo: { count: 20, unit: '팩' },
    unitPrice: 825,
    shipping: '무료배송',
    category: '생활용품',
    merchant: '테스트몰',
    buyUrl: 'https://example.com/p/1',
    claims: []
  }
};

const productNames = [
  '주방세제 리필 4개', '물티슈 20팩', '햇반 24개', '커피 30개', '샴푸 3개',
  '두루마리 휴지 30롤', '키친타월 12롤', '간식 24개', '과일 선물세트 2박스', '반찬 세트 8팩',
  '치약 10개', '우유 24팩', '세탁세제 6개', '섬유유연제 4개', '생수 24병',
  '라면 20개', '주방수건 10매', '침구 세트 1개', '손세정제 6개', '종이컵 1000개'
];

const recent = [];
for (let i = 0; i < productNames.length; i += 1) {
  const price = 12000 + i * 731;
  const baselinePrice = price + 5000 + i * 11;
  const saving = baselinePrice - price;
  const product = productNames[i];
  const countMatch = product.match(/(\d+)\s*(개|팩|롤|병|매|박스)/);
  const unitInfo = countMatch ? { count: Number(countMatch[1]), unit: countMatch[2] } : null;
  const item = {
    ...hot,
    id: 'debug:' + i,
    sourceUrl: 'https://example.com/debug/' + i,
    price,
    saving,
    discountPct: saving / baselinePrice * 100,
    copyContext: {
      ...hot.copyContext,
      product,
      price,
      baselinePrice,
      saving,
      discountPct: saving / baselinePrice * 100,
      unitInfo,
      unitPrice: unitInfo ? Math.round(price / unitInfo.count) : 0,
      category: /세제|휴지|물티슈|샴푸|치약|수건|세정제|종이컵|침구/.test(product) ? '생활용품' : '식품',
      buyUrl: 'https://example.com/debug/' + i,
      claims: [
        { key: 'current_price', value: price, confidence: 0.95 },
        { key: 'baseline_price', value: baselinePrice, confidence: 0.90 },
        { key: 'saving', value: saving, confidence: 0.99 },
        { key: 'discount_pct', value: saving / baselinePrice * 100, confidence: 0.99 },
        ...(unitInfo ? [{ key: 'unit_price', value: Math.round(price / unitInfo.count), confidence: 0.99 }] : [])
      ]
    }
  };
  const picked = selectCommunityCopy(item, recent, 'daangn');
  if (picked.copyRejected) {
    console.log('COPY_EXHAUSTION', JSON.stringify({
      index: i,
      product,
      recent: recent.slice(-10).map(post => ({
        title: post.title,
        styleMode: post.styleMode,
        skeleton: post.copyMeta?.skeleton,
        openingKey: post.copyMeta?.openingKey,
        closingKey: post.copyMeta?.closingKey,
        rhythm: post.copyMeta?.rhythmSignature
      })),
      reasons: picked.copyRejectReasons,
      renderCandidateCount: picked.renderCandidateCount
    }, null, 2));
    break;
  }
  console.log('COPY_PICK', i, picked.styleMode, picked.copyMeta?.skeleton, picked.copyMeta?.openingKey, picked.copyMeta?.closingKey);
  recent.push({
    title: picked.postTitle,
    bodyText: picked.postBody,
    copyMeta: picked.copyMeta,
    styleMode: picked.styleMode,
    sourceUrl: item.sourceUrl,
    topic: item.copyContext.category
  });
}
