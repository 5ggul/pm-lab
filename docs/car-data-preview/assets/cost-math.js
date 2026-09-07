(function(root){
  function energyCost(distance, efficiency, price) {
    if (![distance, efficiency, price].every(Number.isFinite) || distance < 0 || efficiency <= 0 || price <= 0) return null;
    const result = distance / efficiency * price;
    return Number.isFinite(result) ? result : null;
  }
  function annualTax(cc, electric, registration, year) {
    if (!Number.isInteger(year) || year < 1900) return null;
    if (electric) return {base:100000, auto:100000, education:30000, total:130000, discount:0};
    if (!Number.isInteger(cc) || cc <= 0 || !/^\d{4}-\d{2}$/.test(registration || '')) return null;
    const [y,m] = registration.split('-').map(Number);
    if (m < 1 || m > 12 || y < 1900 || y > year) return null;
    const base = cc * (cc <= 1000 ? 80 : cc <= 1600 ? 140 : 200);
    const half = age => base / 2 * (1 - Math.min(0.5, Math.max(0, age - 2) * 0.05));
    const auto = half(year - y + (m <= 6 ? 1 : 0)) + half(year - y + 1);
    return {base, auto, education:auto * 0.3, total:auto * 1.3, discount:1-auto/base};
  }
  root.CAR_COST_MATH = {energyCost, annualTax};
})(globalThis);
