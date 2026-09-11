const ENDPOINT = 'https://apis.data.go.kr/1230000/ao/PriceInfoService/getPriceInfoListFcltyCmmnMtrilBildng';

function decodedServiceKey(input) {
  const value = String(input || '').trim();
  if (!value) throw new Error('DATA_GO_KR_SERVICE_KEY_MISSING');
  if (!/%[0-9a-f]{2}/i.test(value)) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error('DATA_GO_KR_SERVICE_KEY_INVALID_ENCODING');
  }
}

function firstMatch(text, regex) {
  return text.match(regex)?.[1]?.trim() || '';
}

function parseEnvelope(text) {
  try {
    const json = JSON.parse(text);
    const root = json?.response || json;
    const header = root?.header || json?.OpenAPI_ServiceResponse?.cmmMsgHeader || {};
    return {
      code: String(header?.resultCode ?? header?.returnReasonCode ?? ''),
      message: String(header?.resultMsg ?? header?.returnAuthMsg ?? header?.errMsg ?? ''),
      totalCount: root?.body?.totalCount ?? null,
      format: 'json',
    };
  } catch {
    return {
      code:
        firstMatch(text, /<resultCode>\s*([^<]+)\s*<\/resultCode>/i) ||
        firstMatch(text, /<returnReasonCode>\s*([^<]+)\s*<\/returnReasonCode>/i),
      message:
        firstMatch(text, /<resultMsg>\s*([^<]+)\s*<\/resultMsg>/i) ||
        firstMatch(text, /<returnAuthMsg>\s*([^<]+)\s*<\/returnAuthMsg>/i) ||
        firstMatch(text, /<errMsg>\s*([^<]+)\s*<\/errMsg>/i),
      totalCount: firstMatch(text, /<totalCount>\s*([^<]+)\s*<\/totalCount>/i) || null,
      format: 'xml-or-text',
    };
  }
}

function classify(code) {
  const normalized = String(code || '').replace(/^0+/, '') || '0';
  if (['0'].includes(normalized)) return 'OK';
  if (normalized === '20') return 'SERVICE_APPROVAL_NOT_PROPAGATED_OR_ACCESS_DENIED';
  if (['30', '31'].includes(normalized)) return 'KEY_NOT_REGISTERED_OR_ENCODING';
  if (['10', '11', '12'].includes(normalized)) return 'REQUEST_PARAMETER_OR_ENDPOINT';
  if (normalized === '22') return 'DAILY_QUOTA_EXCEEDED';
  return 'OTHER_PROVIDER_ERROR';
}

async function probe() {
  const key = decodedServiceKey(process.env.DATA_GO_KR_SERVICE_KEY);
  const url = new URL(ENDPOINT);
  url.searchParams.set('ServiceKey', key);
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '1');
  url.searchParams.set('type', 'json');
  // Use a documented building-material classification to avoid an unconstrained bulk response.
  url.searchParams.set('prdctClsfcNo', '30103698');

  let response;
  try {
    response = await fetch(url, {
      headers: { accept: 'application/json, application/xml;q=0.9, text/xml;q=0.8' },
      signal: AbortSignal.timeout(25000),
    });
  } catch (error) {
    console.log(JSON.stringify({
      ok: false,
      endpoint: ENDPOINT,
      transport: error?.name || 'FETCH_ERROR',
      classification: 'TRANSPORT_FAILURE',
    }));
    process.exitCode = 1;
    return;
  }

  const text = await response.text();
  const parsed = parseEnvelope(text);
  const classification = classify(parsed.code);
  const ok = response.ok && classification === 'OK';

  // Never print the URL or service key. Only sanitized diagnostics leave this process.
  console.log(JSON.stringify({
    ok,
    endpoint: ENDPOINT,
    httpStatus: response.status,
    contentType: response.headers.get('content-type') || '',
    providerCode: parsed.code || 'UNPARSED',
    providerMessage: parsed.message.slice(0, 160),
    totalCount: parsed.totalCount,
    responseFormat: parsed.format,
    classification,
    checkedAt: new Date().toISOString(),
  }, null, 2));

  if (!ok) process.exitCode = classification === 'SERVICE_APPROVAL_NOT_PROPAGATED_OR_ACCESS_DENIED' ? 2 : 1;
}

await probe();
