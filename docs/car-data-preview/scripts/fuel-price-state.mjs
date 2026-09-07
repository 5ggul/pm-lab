export function isPriceStale(date, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return true;
  const time = Date.parse(date + 'T00:00:00+09:00');
  return !Number.isFinite(time) || time > now || now - time > 3 * 86400000;
}
export function normalizeFuelSnapshot(snapshot, status = {}, now = Date.now()) {
  if (!snapshot) return null;
  const failedAfterSuccess = status.ok === false &&
    Date.parse(status.checked_at || '') >= Date.parse(snapshot.last_successful_at || '1970-01-01');
  return {...snapshot, stale: Boolean(snapshot.stale || failedAfterSuccess || isPriceStale(snapshot.price_as_of, now))};
}
