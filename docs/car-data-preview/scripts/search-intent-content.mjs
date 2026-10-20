import fs from 'node:fs';
import vm from 'node:vm';

const sorento = JSON.parse(fs.readFileSync(new URL('../data/vehicles/kia/sorento-mq4.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(new URL('../data/generated/catalog.json', import.meta.url), 'utf8'));
const mathContext = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../assets/cost-math.js', import.meta.url), 'utf8'), mathContext);
const costMath = mathContext.CAR_COST_MATH;
const start = '<!-- SEARCH:HYBRID:START -->';
const end = '<!-- SEARCH:HYBRID:END -->';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));

function setMeta(html, attribute, key, value) {
  return html.replace(/<meta\b[^>]*>/gi, tag => {
    if (!new RegExp(`\\b${attribute}="${key}"`, 'i').test(tag)) return tag;
    return tag.replace(/\bcontent="[^"]*"/i, `content="${escapeHtml(value)}"`);
  });
}

function setTitle(html, title, description) {
  html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, 'property', 'og:title', title);
  if (description) {
    html = setMeta(html, 'name', 'description', description);
    html = setMeta(html, 'property', 'og:description', description);
  }
  return html;
}

function hybridSummary(vehicle) {
  // These are exact reviewed rows, not a range or a new default selection.
  const ids = ['mq4-hev16-2wd-17-0', 'mq4-hev16-4wd-17-7'];
  const variants = Array.isArray(vehicle?.variants) ? vehicle.variants : [];
  const rows = ids.map(id => variants.find(variant => variant?.variant_id === id));
  const valid = rows.every((row, index) => row?.fuel_type === 'hybrid'
    && row.drive === ['2WD', '4WD'][index] && row.wheel_inch === 17
    && row.seats === ['5', '5/6/7'][index] && row.builtin_cam === false
    && typeof row.fuel_economy_combined === 'number' && Number.isFinite(row.fuel_economy_combined)
    && row.fuel_economy_combined > 0);
  const readings = valid ? `<div class="rows">${rows.map(row => `<div class="row"><span>${escapeHtml(row.drive)} · ${row.wheel_inch}인치 · ${escapeHtml(row.seats)}인승 · 빌트인캠 미적용</span><strong>${row.fuel_economy_combined.toFixed(1)} km/L</strong></div>`).join('')}</div>` : '';
  const source = vehicle?.sources?.efficiency;
  const sourceLink = /^https:\/\//.test(source?.url ?? '') ? `<p class="source-line"><a href="${escapeHtml(source.url)}">기아 공식 신고 연비</a>${vehicle.reviewed_on ? ` · 자료 확인 ${escapeHtml(vehicle.reviewed_on)}` : ''}</p>` : '';
  return `${start}<section class="db-section" id="hybrid-efficiency" aria-labelledby="sorento-hybrid-efficiency-heading"><div class="db-shell"><div class="db-heading"><h2 id="sorento-hybrid-efficiency-heading">쏘렌토 하이브리드 연비</h2></div><p>1.6 하이브리드의 대표 신고 사양입니다. 인승·휠·빌트인캠 조건에 따라 연비가 달라집니다.</p>${readings}<p><a href="#variantButtons">구동·휠별 전체 사양 선택</a> · <a href="../../../compare/sorento-vs-santafe/">쏘렌토 vs 싼타페 2.5 가솔린 비교</a></p>${sourceLink}</div></section>${end}`;
}

function addSorentoHybridShortcut(html) {
  if (!html.includes('id="hybrid-efficiency"')) return html;
  return html.replace(/<section\b[^>]*class="[^"]*\bmodel-lite-hero\b[^"]*"[^>]*>[\s\S]*?<\/section>/, hero => {
    if (!hero.includes('class="model-lite-copy"') || /<a\b[^>]*href="#hybrid-efficiency"/.test(hero)) return hero;
    return hero.replace(/<p\b[^>]*class="model-lite-answer"[^>]*>([\s\S]*?)<\/p>/, (answer, text) => text.replace(/<[^>]+>/g, '').trim()
      ? `${answer}<a class="spec-action" href="#hybrid-efficiency">하이브리드 연비 보기</a>` : answer);
  });
}

function grandeurHybridVariant(currentCatalog) {
  const car = Array.isArray(currentCatalog?.cars) ? currentCatalog.cars.find(car => car?.id === 'grandeur-gn7') : null;
  const variant = Array.isArray(car?.variants) ? car.variants.find(row => row?.id === 'gn7-hev16-2wd-18') : null;
  return variant?.fuelType === 'hybrid' && variant.drive === '2WD' && variant.wheel === 18
    && variant.cc === 1598 && variant.combined === 18 ? variant : null;
}

function syncGrandeurCosts(html, currentCatalog) {
  const variant = grandeurHybridVariant(currentCatalog);
  if (!variant || !Number.isFinite(currentCatalog.annualKm)
    || currentCatalog.annualKm <= 0 || !Number.isFinite(currentCatalog.gasPrice) || currentCatalog.gasPrice <= 0
    || !Number.isInteger(currentCatalog.taxYear) || !/^\d{4}-\d{2}-\d{2}$/.test(currentCatalog.fuelPriceAsOf ?? '')) return html;
  const energy = costMath.energyCost(currentCatalog.annualKm, variant.combined, currentCatalog.gasPrice);
  const tax = costMath.roundedTax(costMath.annualTax(variant.cc, false, `${currentCatalog.taxYear}-01`, currentCatalog.taxYear));
  if (energy === null || tax === null) return html;
  const money = value => Math.round(value).toLocaleString('ko-KR') + '원';
  const distance = currentCatalog.annualKm === 20000 ? '2만' : currentCatalog.annualKm.toLocaleString('ko-KR');
  html = html.replace(/<div class="row"><span>연 [^<]*km 유류비 · 18인치<\/span><strong>[\d,]+원<\/strong><\/div>/, `<div class="row"><span>연 ${distance}km 유류비 · 18인치</span><strong>${money(energy)}</strong></div>`)
    .replace(/(<span>세금 \+ 유류비 · 18인치<\/span><strong>)[\d,]+원/, `$1${money(Math.round(energy) + tax.total)}`);
  const price = currentCatalog.gasPrice.toLocaleString('ko-KR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return html.replace(/(<p class="source-line">유류비 가정: )[^<]*?원\/L\./, `$1오피넷 ${currentCatalog.fuelPriceAsOf.replaceAll('-', '.')} 전국 휘발유 평균 ${price}원/L.`);
}

/** Return only the three requested editorial changes; calculators and index policy are untouched. */
export function applySearchIntentContent(html, route, data = {sorento, catalog}) {
  data ??= {};
  if (route === 'cars/kia/sorento-mq4/index.html') {
    html = setTitle(html, '쏘렌토 하이브리드 연비·MQ4 사양별 자동차세 | 픽마이카');
    const section = hybridSummary(data.sorento);
    const marker = '<section class="db-section" id="reference-section-1">';
    html = html.includes(start) ? html.replace(/<!-- SEARCH:HYBRID:START -->[\s\S]*?<!-- SEARCH:HYBRID:END -->/, section)
      : html.includes(marker) ? html.replace(marker, section + marker) : html.replace('</main>', section + '</main>');
    return addSorentoHybridShortcut(html);
  }
  if (route === 'cars/hyundai/grandeur-gn7/hybrid/index.html') {
    if (!html.includes('id="hybrid-wheel-efficiency"')) {
      html = html.replace('<div class="rows">', '<h2 id="hybrid-wheel-efficiency">그랜저 하이브리드 휠별 연비</h2><div class="rows">');
    }
    html = html.replace('<a class="button blue" href="../#compare">2.5와 상세 비교</a>', '<a class="button blue" href="../../../../compare/grandeur-gasoline-vs-hybrid/">그랜저 가솔린·하이브리드 비교</a>')
      .replace('>하이브리드 자동차세 기준</a>', '>그랜저 하이브리드 자동차세 기준</a>');
    html = html.replace(/<a class="(button(?: blue)?)"(?= href="(?:\.\.\/\.\.\/\.\.\/\.\.\/compare\/grandeur-gasoline-vs-hybrid\/|\.\/automobile-tax\/)"\>)/g, '<a class="$1 spec-action"');
    if (grandeurHybridVariant(data.catalog)) {
      html = html.replace('<a href="../../../../compare/">다른 차량과 비교</a>', '<a class="spec-action" href="../../../../tools/annual-cost/?mode=reviewed&amp;car=grandeur-gn7&amp;variant=gn7-hev16-2wd-18">내 조건으로 계산</a>');
    }
    return syncGrandeurCosts(html, data.catalog);
  }
  if (route === 'compare/sorento-vs-santafe/index.html') {
    return setTitle(html, '쏘렌토 vs 싼타페 2.5 가솔린 터보 비교 | 픽마이카', '2WD·18인치 기준 쏘렌토 MQ4와 싼타페 MX5의 복합연비·자동차세·유류비를 비교합니다. 쏘렌토 5·6·7인승, 싼타페 5·6인승 공시 사양입니다.');
  }
  return html;
}
