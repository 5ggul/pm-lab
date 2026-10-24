import fs from 'node:fs';

const REGISTRY_URL = new URL('../image-rights.json', import.meta.url);
const ALLOWED_BASES = new Set([
  'owned',
  'written_permission',
  'platform_license',
  'affiliate_terms',
  'merchant_terms',
  'cc_by',
  'cc_by_sa',
  'public_domain'
]);
const REQUIRED_PLATFORM = 'daangn';
const ALLOWED_USES = new Set(['community-post', 'commercial-post']);

function clean(value) {
  return String(value || '').trim();
}

export function normalizeImageRightsUrl(value) {
  try {
    const url = new URL(clean(value));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid|pWise)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.href;
  } catch {
    return '';
  }
}

function defaultRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_URL, 'utf8'));
  } catch (error) {
    return {
      version: 1,
      mode: 'enforce',
      entries: [],
      loadError: String(error?.message || error)
    };
  }
}

function registryError(registry) {
  if (!registry || registry.version !== 1 || !Array.isArray(registry.entries)) {
    return 'IMAGE_RIGHTS_REGISTRY_INVALID';
  }
  if (!['enforce', 'disabled'].includes(registry.mode || 'enforce')) {
    return 'IMAGE_RIGHTS_REGISTRY_INVALID';
  }
  if (registry.loadError) return 'IMAGE_RIGHTS_REGISTRY_INVALID';
  return '';
}

function entryFailure(entry, item, now) {
  if (entry.status !== 'approved') return 'IMAGE_RIGHTS_STATUS_INVALID';
  if (!ALLOWED_BASES.has(clean(entry.basis))) return 'IMAGE_RIGHTS_BASIS_INVALID';

  const platforms = Array.isArray(entry.platforms) ? entry.platforms.map(clean) : [];
  const uses = Array.isArray(entry.uses) ? entry.uses.map(clean) : [];
  if (!platforms.includes(REQUIRED_PLATFORM) || !uses.some(use => ALLOWED_USES.has(use))) {
    return 'IMAGE_RIGHTS_SCOPE_INVALID';
  }

  if (!clean(entry.id) || !clean(entry.rightsHolder) || !clean(entry.approvedBy) ||
      !normalizeImageRightsUrl(entry.evidenceUrl)) {
    return 'IMAGE_RIGHTS_EVIDENCE_MISSING';
  }

  const approvedAt = Date.parse(entry.approvedAt || '');
  if (!Number.isFinite(approvedAt) || approvedAt > now.getTime()) {
    return 'IMAGE_RIGHTS_APPROVAL_INVALID';
  }

  if (entry.expiresAt) {
    const expiresAt = Date.parse(entry.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      return 'IMAGE_RIGHTS_EXPIRED';
    }
  }

  if (entry.sourceFingerprint && entry.sourceFingerprint !== item.verification?.fingerprint) {
    return 'IMAGE_RIGHTS_SOURCE_CHANGED';
  }

  return '';
}

export function resolveImageRights(item, { registry = defaultRegistry(), now = new Date() } = {}) {
  if (item?.imageRequired !== true) {
    return { approved: false, required: false, reason: 'IMAGE_NOT_REQUIRED', evidence: null };
  }

  const sourceUrl = normalizeImageRightsUrl(item.sourceUrl || item.buyUrl);
  const imageUrl = normalizeImageRightsUrl(item.imageUrl);
  if (!imageUrl) {
    return { approved: false, required: true, reason: 'IMAGE_REQUIRED_MISSING', evidence: null };
  }
  if (!sourceUrl) {
    return { approved: false, required: true, reason: 'IMAGE_RIGHTS_SOURCE_INVALID', evidence: null };
  }

  const invalidRegistry = registryError(registry);
  if (invalidRegistry) {
    return { approved: false, required: true, reason: invalidRegistry, evidence: null };
  }
  if (registry.mode === 'disabled') {
    return { approved: false, required: true, reason: 'IMAGE_RIGHTS_ENFORCEMENT_DISABLED', evidence: null };
  }

  const entry = registry.entries.find(candidate =>
    normalizeImageRightsUrl(candidate.sourceUrl) === sourceUrl &&
    normalizeImageRightsUrl(candidate.imageUrl) === imageUrl
  );
  if (!entry) {
    return { approved: false, required: true, reason: 'IMAGE_RIGHTS_NOT_APPROVED', evidence: null };
  }

  const failure = entryFailure(entry, item, now);
  if (failure) {
    return { approved: false, required: true, reason: failure, evidence: null };
  }

  return {
    approved: true,
    required: true,
    reason: null,
    evidence: {
      id: clean(entry.id),
      status: 'approved',
      sourceUrl,
      imageUrl,
      rightsHolder: clean(entry.rightsHolder),
      basis: clean(entry.basis),
      evidenceUrl: normalizeImageRightsUrl(entry.evidenceUrl),
      approvedBy: clean(entry.approvedBy),
      approvedAt: new Date(entry.approvedAt).toISOString(),
      expiresAt: entry.expiresAt ? new Date(entry.expiresAt).toISOString() : null,
      platforms: [...entry.platforms],
      uses: [...entry.uses],
      sourceFingerprint: entry.sourceFingerprint || null,
      checkedAt: now.toISOString()
    }
  };
}

export function applyImageRights(item, options = {}) {
  const result = resolveImageRights(item, options);
  if (!item || result.required === false) return result;

  item.imageUsageApproved = result.approved;
  item.imageRights = result.evidence || {
    status: 'not_approved',
    reason: result.reason,
    sourceUrl: normalizeImageRightsUrl(item.sourceUrl || item.buyUrl) || null,
    imageUrl: normalizeImageRightsUrl(item.imageUrl) || null,
    checkedAt: (options.now || new Date()).toISOString()
  };
  item.verification = {
    ...(item.verification || {}),
    imageRightsId: result.evidence?.id || null,
    imageRightsStatus: result.approved ? 'approved' : 'not_approved',
    imageRightsReason: result.reason || null,
    imageRightsCheckedAt: item.imageRights.checkedAt
  };
  return result;
}

export function imageRightsRegistrySnapshot() {
  return defaultRegistry();
}
