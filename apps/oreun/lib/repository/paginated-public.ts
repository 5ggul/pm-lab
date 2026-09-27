export type PublicReadConfig = { url: string; publishableKey: string };
type Value = string | number | boolean | null | undefined;

// Never mistake a capped REST response for a complete data set. Count and range
// must agree on EVERY page. A failure throws instead of returning a partial list.
export async function selectAllPublicRows<T>(
  config: PublicReadConfig,
  table: string,
  query: Record<string, Value>,
  options: { pageSize?: number; maxRows?: number; key: (row: T) => string; fetcher?: typeof fetch },
): Promise<{ rows: T[]; total: number; pages: number }> {
  const pageSize = options.pageSize ?? 500;
  const maxRows = options.maxRows ?? 50000;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000 || !query.order) throw new Error("Invalid pagination configuration");
  const rows: T[] = [];
  const seen = new Set<string>();
  let total: number | null = null;
  let pages = 0;
  while (total === null || rows.length < total) {
    if (++pages > 1000) throw new Error("Public pagination did not terminate");
    const url = new URL(`/rest/v1/${table}`, config.url);
    for (const [key, value] of Object.entries(query)) if (value != null) url.searchParams.set(key, String(value));
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(rows.length));
    const response = await (options.fetcher ?? fetch)(url, {
      headers: { apikey: config.publishableKey, accept: "application/json", Prefer: "count=exact" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Public paginated read HTTP ${response.status}`);
    const range = response.headers.get("content-range") ?? "";
    const match = /^(?:(\d+)-(\d+)|\*)\/(\d+)$/.exec(range);
    if (!match) throw new Error("Missing exact Content-Range; completeness is unknown");
    const count = Number(match[3]);
    if (!Number.isSafeInteger(count) || count > maxRows || (total !== null && total !== count)) throw new Error("Public result count changed or exceeds safe bound");
    total = count;
    const batch: T[] = await response.json();
    if (!Array.isArray(batch)) throw new Error("Invalid public row response");
    if (count === 0 && batch.length === 0 && rows.length === 0) break;
    if (!batch.length || Number(match[1]) !== rows.length || Number(match[2]) + 1 !== rows.length + batch.length || rows.length + batch.length > count) throw new Error("Truncated or inconsistent public page");
    for (const row of batch) {
      const key = options.key(row);
      if (!key || seen.has(key)) throw new Error("Duplicate public row across pages");
      seen.add(key); rows.push(row);
    }
  }
  return { rows, total: total ?? 0, pages };
}
