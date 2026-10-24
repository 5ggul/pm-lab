const APPROVED_REMOTE_BASES = new Set([
  'owned_original',
  'licensed',
  'explicit_permission',
  'public_domain',
  'cc0',
  'platform_media_kit'
]);

const compact = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const clip = (value, limit) => {
  const text = compact(value);
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1)).trim()}…` : text;
};
const isHttps = value => {
  try { return new URL(String(value)).protocol === 'https:'; } catch { return false; }
};
const number = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const won = value => {
  const parsed = number(value);
  return parsed ? `${parsed.toLocaleString('ko-KR')}원` : '';
};
const truthyClaim = claim => claim?.verified === true || Number(claim?.confidence) >= 0.9;

export function remoteImageApproval(item = {}) {
  const rights = item.imageRights || {};
  const basis = compact(rights.basis);
  const approved = item.imageUsageApproved === true &&
    rights.status === 'approved' &&
    APPROVED_REMOTE_BASES.has(basis) &&
    isHttps(rights.sourceUrl) &&
    compact(rights.evidence).length >= 8 &&
    isHttps(item.imageUrl);

  return {
    approved,
    basis: approved ? basis : '',
    reason: approved ? 'structured_rights_approved' : 'remote_rights_unverified'
  };
}

export function imageSafetyPlan(item = {}) {
  const remote = remoteImageApproval(item);
  if (remote.approved) return { mode: 'remote', reason: remote.reason, basis: remote.basis };
  if (item.imageRequired === true) {
    return {
      mode: 'generated_card',
      reason: item.imageUrl ? 'remote_rights_unverified' : 'required_image_missing'
    };
  }
  return { mode: 'none', reason: item.imageUrl ? 'unapproved_optional_image_removed' : 'image_not_required' };
}

export function buildInfoCardModel(item = {}) {
  if (item.verification?.status !== 'verified') {
    throw new Error('INFO_CARD_SOURCE_NOT_VERIFIED');
  }

  const context = item.copyContext || {};
  const claims = Array.isArray(context.claims) ? context.claims.filter(truthyClaim) : [];
  const currentPriceClaim = claims.find(claim => claim.key === 'current_price');
  const shippingClaim = claims.find(claim => claim.key === 'shipping');
  const price = number(currentPriceClaim?.value ?? context.price ?? item.price);
  const product = clip(context.product || item.title || item.postTitle, 76);

  if (!product || !price || !currentPriceClaim) {
    throw new Error('INFO_CARD_REQUIRED_FACT_MISSING');
  }

  const referencePrice = number(context.referencePrice);
  const saving = referencePrice && referencePrice > price
    ? referencePrice - price
    : number(context.saving);
  const discountPercent = referencePrice && referencePrice > price
    ? Math.round((saving / referencePrice) * 1000) / 10
    : number(context.benefitPercent);
  const shipping = clip(shippingClaim?.value, 50);
  const verifiedValues = new Set(claims.map(claim => compact(claim.value)).filter(Boolean));
  const conditions = [...new Set((context.requiredConditions || context.conditions || [])
    .filter(value => verifiedValues.has(compact(value)))
    .map(value => clip(value, 64))
    .filter(Boolean))]
    .slice(0, 2);
  const deadline = conditions.find(value => /(기한|마감|까지|종료|23:59|23시)/.test(value)) || '';
  const merchant = clip(context.merchant || (() => {
    try { return new URL(item.buyUrl || item.sourceUrl).hostname.replace(/^www\./, ''); } catch { return ''; }
  })(), 32);

  return {
    product,
    price: won(price),
    referencePrice: referencePrice && referencePrice > price ? won(referencePrice) : '',
    saving: saving ? won(saving) : '',
    discountPercent: discountPercent ? `${discountPercent}%` : '',
    shipping,
    deadline,
    conditions: conditions.filter(value => value !== deadline),
    merchant,
    badge: '판매 페이지 확인값',
    footer: '가격·조건은 게시 직전 다시 확인하세요'
  };
}

const escapeHtml = value => compact(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export function renderInfoCardHtml(model) {
  const rows = [];
  if (model.referencePrice && model.saving) {
    rows.push(`<div class="row"><span>판매처 할인 전</span><b>${escapeHtml(model.referencePrice)}</b></div>`);
    rows.push(`<div class="row"><span>절감액${model.discountPercent ? ` · ${escapeHtml(model.discountPercent)}` : ''}</span><b>${escapeHtml(model.saving)}</b></div>`);
  }
  if (model.shipping) rows.push(`<div class="row"><span>배송 조건</span><b>${escapeHtml(model.shipping)}</b></div>`);
  if (model.deadline) rows.push(`<div class="row"><span>적용 기한</span><b>${escapeHtml(model.deadline)}</b></div>`);
  for (const condition of model.conditions || []) {
    rows.push(`<div class="row"><span>확인 조건</span><b>${escapeHtml(condition)}</b></div>`);
  }

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;background:#f5f7f9;font-family:Arial,'Noto Sans KR',sans-serif;color:#14202b}
body{display:flex;align-items:center;justify-content:center}.card{position:relative;width:1200px;height:630px;padding:58px 68px 50px;overflow:hidden;background:linear-gradient(145deg,#ffffff 0%,#f4faf8 100%)}
.card:before{content:'';position:absolute;right:-110px;top:-160px;width:440px;height:440px;border-radius:50%;background:rgba(38,224,194,.18)}
.card:after{content:'';position:absolute;left:-150px;bottom:-220px;width:480px;height:480px;border-radius:50%;background:rgba(27,58,107,.08)}
.top{position:relative;display:flex;align-items:center;justify-content:space-between;gap:24px}.badge{display:inline-flex;padding:12px 20px;border-radius:999px;background:#1b3a6b;color:#fff;font-size:22px;font-weight:700;letter-spacing:-.4px}
.merchant{font-size:22px;color:#52606d;font-weight:700}.product{position:relative;margin-top:34px;max-width:1040px;font-size:45px;line-height:1.22;letter-spacing:-1.7px;font-weight:800}
.price{position:relative;margin-top:22px;font-size:76px;line-height:1;color:#0a7c69;font-weight:900;letter-spacing:-2px}.grid{position:relative;margin-top:34px;display:grid;grid-template-columns:1fr 1fr;gap:13px 20px;max-width:1060px}
.row{min-height:61px;padding:14px 18px;border:1px solid #dbe5e2;border-radius:16px;background:rgba(255,255,255,.86);display:flex;align-items:center;justify-content:space-between;gap:18px;font-size:20px}.row span{color:#5b6773;white-space:nowrap}.row b{text-align:right;font-size:21px;line-height:1.25}
.footer{position:absolute;left:68px;right:68px;bottom:29px;display:flex;justify-content:space-between;color:#687684;font-size:18px}.mark{font-weight:800;color:#1b3a6b}
</style></head><body><main id="card" class="card"><div class="top"><div class="badge">${escapeHtml(model.badge)}</div><div class="merchant">${escapeHtml(model.merchant)}</div></div><div class="product">${escapeHtml(model.product)}</div><div class="price">${escapeHtml(model.price)}</div><div class="grid">${rows.join('')}</div><div class="footer"><span>${escapeHtml(model.footer)}</span><span class="mark">싸그리 생활정보</span></div></main></body></html>`;
}
