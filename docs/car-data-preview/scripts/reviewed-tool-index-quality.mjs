// Indexing approval is limited to the two reviewed calculator routes.
// Check their published formulas, worked amounts, limitations and related links;
// collapsible saved-condition widgets are not evidence of editorial quality.
export const REVIEWED_TOOL_FILES = Object.freeze(['tools/fuel-efficiency/index.html', 'tools/car-installment/index.html']);
export const REVIEWED_TOOL_ROUTES = Object.freeze(REVIEWED_TOOL_FILES.map(file => '/' + file.replace(/index\.html$/, '')));
const clean = html => String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const compact = html => clean(html).replace(/\s/g, '');
const result = (name, pass, actual) => ({name, pass:Boolean(pass), ...(actual === undefined ? {} : {actual})});
function marked(html, attribute, value, tag = 'p') {
  const pattern = new RegExp('<' + tag + '\\b[^>]*\\b' + attribute + '="' + value + '"[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'gi');
  return [...html.matchAll(pattern)].map(match => match[1]);
}
export function reviewedToolIndexChecks(file, html) {
  if (!REVIEWED_TOOL_FILES.includes(file)) return null;
  const slug = file.split('/')[1];
  const methods = marked(html, 'data-reviewed-tool', slug, 'section');
  const body = methods.length === 1 ? methods[0] : '';
  const checks = [result('reviewed_method_section', methods.length === 1, methods.length)];
  const requiredLinks = slug === 'fuel-efficiency' ? ['../fuel-cost/', '../ev-charge-cost/', '../../guide/official-efficiency/'] : ['../car-tax/', '../annual-cost/', '../../methodology/'];
  checks.push(result('related_calculation_links', requiredLinks.every(href => body.includes('href="' + href + '"')), requiredLinks));
  if (slug === 'fuel-efficiency') {
    const formula = compact(marked(body, 'data-calculation-formula', 'measured').join(' '));
    checks.push(result('measured_formula_and_units', formula.includes('실연비=주행거리(km)÷주유량(L)') && formula.includes('실전비=주행거리(km)÷사용전력량(kWh)')));
    const fuel = compact(marked(body, 'data-calculation-example', 'fuel').join(' '));
    const electric = compact(marked(body, 'data-calculation-example', 'electric').join(' '));
    checks.push(result('measured_worked_examples', /600km.*40L.*15km\/L.*1,800원\/L.*12,000원/.test(fuel) && /600km.*120kWh.*5km\/kWh.*300원\/kWh.*36,000원/.test(electric)));
    const limits = compact(marked(body, 'data-calculation-limits', 'measured').join(' '));
    checks.push(result('measured_scope_and_measurement_limits', ['같은구간', '충전손실', '공인연비·전비', '전체유지비'].every(term => limits.includes(term))));
  } else {
    const monthly = compact(marked(body, 'data-calculation-formula', 'monthly-rate').join(' '));
    const equalPayment = compact(marked(body, 'data-calculation-formula', 'equal-payment').join(' '));
    const equalPrincipal = compact(marked(body, 'data-calculation-formula', 'equal-principal').join(' '));
    checks.push(result('installment_formulas', monthly.includes('월이율=견적연금리(%)÷100÷12') && equalPayment.includes('원금×월이율÷[1−(1+월이율)−개월수]') && equalPayment.includes('0%') && equalPrincipal.includes('원금÷개월수') && equalPrincipal.includes('월초남은원금×월이율')));
    const payment = compact(marked(body, 'data-calculation-example', 'equal-payment').join(' '));
    const principal = compact(marked(body, 'data-calculation-example', 'equal-principal').join(' '));
    checks.push(result('installment_worked_examples', /3,000만원.*연5%.*36개월/.test(compact(body)) && /899,127원.*2,368,569원.*32,368,569원/.test(payment) && /958,333원.*836,805원.*2,312,500원/.test(principal)));
    const limits = compact(marked(body, 'data-calculation-limits', 'installment').join(' '));
    checks.push(result('installment_quote_and_scope_limits', ['계산예시', '현재금융상품의금리가아닙니다', '고정연금리', '원단위반올림', '수수료', '거치기간', '중도상환'].every(term => limits.includes(term))));
  }
  return checks;
}

// These calculators publish methods and personal estimates, not software offers
// or reviewed financial products. Other tools retain their existing schema.
export function reviewedToolStructuredData(file, {url, title, base}) {
  if (!REVIEWED_TOOL_FILES.includes(file)) return null;
  return [
    {'@type':'WebPage','@id':url+'#page',url,name:title,inLanguage:'ko-KR'},
    {'@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'홈',item:base},
      {'@type':'ListItem',position:2,name:'계산 도구',item:new URL('tools/',base).href},
      {'@type':'ListItem',position:3,name:title,item:url}
    ]}
  ];
}
export function reviewedToolSchemaChecks(html) {
  const nodes = [], types = [], forbiddenFields = [];
  let parsed = true;
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value['@type']) types.push(...[value['@type']].flat().map(String));
    for (const [key, child] of Object.entries(value)) {
      if (['offers','review','aggregateRating','applicationCategory','operatingSystem'].includes(key)) forbiddenFields.push(key);
      if (Array.isArray(child)) child.forEach(visit); else visit(child);
    }
  }
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const node = JSON.parse(match[1]); nodes.push(node); visit(node); }
    catch { parsed = false; }
  }
  return [
    result('reviewed_informational_schema', parsed && nodes.length > 0 && types.includes('WebPage') && types.includes('BreadcrumbList') && !types.some(type => /^(?:https?:\/\/schema\.org\/)?(?:WebApplication|SoftwareApplication|Product|Vehicle|Car)$/.test(type)), types),
    result('no_unsubstantiated_app_offer_or_rating', forbiddenFields.length === 0, forbiddenFields)
  ];
}
