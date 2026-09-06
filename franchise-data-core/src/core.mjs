'use strict';

export const SOURCES = Object.freeze({
  sbiz: {
    id: 'sbiz',
    name: '소상공인시장진흥공단 상가(상권)정보',
    provider: '소상공인시장진흥공단',
    catalogUrl: 'https://www.data.go.kr/catalog/15012005/openapi.json',
    guideUrl: 'https://www.data.go.kr/data/15012005/openapi.do',
    serviceBase: 'https://apis.data.go.kr/B553077/api/open/sdsc2',
    licenseExpected: '이용허락범위 제한 없음',
    auth: 'DATA_GO_KR_SERVICE_KEY'
  },
  ftcIndustry: {
    id: 'ftcIndustry',
    name: '공정위 주요 업종별 가맹점수·개폐점률',
    provider: '공정거래위원회',
    catalogUrl: 'https://www.data.go.kr/catalog/15157660/openapi.json',
    guideUrl: 'https://www.data.go.kr/data/15157660/openapi.do',
    licenseExpected: '이용허락범위 제한 없음',
    auth: 'DATA_GO_KR_SERVICE_KEY'
  },
  fairdata: {
    id: 'fairdata',
    name: '공정위 FairData 가맹 브랜드 데이터',
    provider: '공정거래위원회',
    catalogUrl: 'https://fairdata.go.kr/ext/index.do',
    guideUrl: 'https://fairdata.go.kr/ext/index.do',
    auth: 'FAIRDATA_SERVICE_KEY',
    access: 'DATASET_DEPENDENT_APPROVAL'
  }
});

const isoNow = () => new Date().toISOString();

export async function fetchText(url, {fetchImpl = fetch, timeoutMs = 12000, headers = {}} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {'user-agent': 'pm-lab-franchise-data-core/1.0', ...headers}
    });
    const text = await response.text();
    return {ok: response.ok, status: response.status, text, headers: response.headers};
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, opts = {}) {
  const result = await fetchText(url, opts);
  if (!result.ok) throw new Error(`HTTP ${result.status}: ${url}`);
  try {
    return JSON.parse(result.text);
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error.message}`);
  }
}

export function normalizeCatalog(meta = {}, source) {
  return {
    id: source.id,
    name: meta.name || source.name,
    provider: meta.creator?.name || source.provider,
    availability: 'METADATA_VERIFIED',
    license: meta.license || null,
    modifiedAt: meta.dateModified || null,
    format: meta.encodingFormat || null,
    spatialCoverage: meta.spatialCoverage || null,
    guideUrl: meta.url || source.guideUrl,
    checkedAt: isoNow()
  };
}

export async function probeCatalog(source, opts = {}) {
  try {
    const meta = await fetchJson(source.catalogUrl, opts);
    const normalized = normalizeCatalog(meta, source);
    if (source.licenseExpected && normalized.license !== source.licenseExpected) {
      normalized.availability = 'METADATA_VERIFIED_LICENSE_REVIEW';
    }
    return normalized;
  } catch (error) {
    return {
      id: source.id,
      name: source.name,
      provider: source.provider,
      availability: 'METADATA_UNAVAILABLE',
      error: error.message,
      guideUrl: source.guideUrl,
      checkedAt: isoNow()
    };
  }
}

export async function probeSbiz(serviceKey, opts = {}) {
  const source = SOURCES.sbiz;
  if (!serviceKey) {
    return {id: source.id, live: 'KEY_REQUIRED', checkedAt: isoNow(), operation: 'storeListInDong'};
  }
  const query = new URLSearchParams({
    serviceKey,
    divId: 'ctprvnCd',
    key: '11',
    numOfRows: '1',
    pageNo: '1',
    type: 'json'
  });
  const url = `${source.serviceBase}/storeListInDong?${query.toString()}`;
  try {
    const payload = await fetchJson(url, opts);
    const body = payload?.body || payload?.response?.body;
    const count = Number(body?.totalCount);
    if (!Number.isFinite(count)) throw new Error('Unexpected response envelope: missing totalCount');
    return {id: source.id, live: 'LIVE_VERIFIED', operation: 'storeListInDong', sampleTotalCount: count, checkedAt: isoNow()};
  } catch (error) {
    return {id: source.id, live: 'LIVE_ERROR', operation: 'storeListInDong', error: error.message, checkedAt: isoNow()};
  }
}

export async function probeFtcIndustry(serviceKey, endpoint, opts = {}) {
  const source = SOURCES.ftcIndustry;
  if (!serviceKey) return {id: source.id, live: 'KEY_REQUIRED', checkedAt: isoNow()};
  if (!endpoint) return {id: source.id, live: 'ENDPOINT_MAPPING_REQUIRED', checkedAt: isoNow()};
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = `${endpoint}${sep}${new URLSearchParams({serviceKey, pageNo: '1', numOfRows: '1'}).toString()}`;
  try {
    const payload = await fetchJson(url, opts);
    const body = payload?.body || payload?.response?.body;
    return {id: source.id, live: body ? 'LIVE_VERIFIED' : 'LIVE_RESPONSE_REVIEW', checkedAt: isoNow()};
  } catch (error) {
    return {id: source.id, live: 'LIVE_ERROR', error: error.message, checkedAt: isoNow()};
  }
}

export async function probeFairdata(opts = {}) {
  const source = SOURCES.fairdata;
  try {
    const result = await fetchText(source.catalogUrl, opts);
    if (!result.ok) throw new Error(`HTTP ${result.status}`);
    const latest = [...result.text.matchAll(/2026-\d{2}-\d{2}/g)].map(x => x[0]).sort().at(-1) || null;
    return {
      id: source.id,
      availability: 'PORTAL_VERIFIED',
      live: 'APPROVAL_OR_KEY_REQUIRED_BY_DATASET',
      latestPortalDate: latest,
      checkedAt: isoNow()
    };
  } catch (error) {
    return {id: source.id, availability: 'PORTAL_UNAVAILABLE', error: error.message, checkedAt: isoNow()};
  }
}

export async function buildSourceStatus({env = process.env, fetchImpl = fetch} = {}) {
  const opts = {fetchImpl};
  const [sbizMeta, ftcMeta, fairdata] = await Promise.all([
    probeCatalog(SOURCES.sbiz, opts),
    probeCatalog(SOURCES.ftcIndustry, opts),
    probeFairdata(opts)
  ]);
  const [sbizLive, ftcLive] = await Promise.all([
    probeSbiz(env.DATA_GO_KR_SERVICE_KEY, opts),
    probeFtcIndustry(env.DATA_GO_KR_SERVICE_KEY, env.FTC_FRANCHISE_INDUSTRY_ENDPOINT, opts)
  ]);
  return {
    schemaVersion: 1,
    generatedAt: isoNow(),
    dataMode: env.DATA_GO_KR_SERVICE_KEY ? 'PUBLIC_API_READINESS' : 'METADATA_ONLY_READINESS',
    sources: [
      {...sbizMeta, ...sbizLive, id: 'sbiz'},
      {...ftcMeta, ...ftcLive, id: 'ftcIndustry'},
      fairdata,
      {
        id: 'derived',
        name: '창업데이터랩 파생지표 엔진',
        provider: '자체 계산',
        availability: 'READY',
        live: 'READY',
        checkedAt: isoNow()
      }
    ]
  };
}

export function statusToJavascript(status) {
  return `'use strict';\n// Generated by franchise-data-core. Do not hand-edit.\nglobalThis.SOURCE_STATUS=${JSON.stringify(status, null, 2)};\n`;
}
