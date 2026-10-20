import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const markers = {
  section: ['<!-- OFFICIAL:ISSUES:START -->', '<!-- OFFICIAL:ISSUES:END -->'],
  runtime: ['<!-- OFFICIAL:ISSUES:RUNTIME:START -->', '<!-- OFFICIAL:ISSUES:RUNTIME:END -->']
};
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');

function stripBlock(html, [start, end]) {
  const first = html.indexOf(start);
  if (first < 0) return html;
  const last = html.indexOf(end, first);
  if (last < 0) throw new Error(`Unclosed official issues marker: ${start}`);
  return stripBlock(html.slice(0, first) + html.slice(last + end.length), [start, end]);
}

function afterRecall(html) {
  const start = html.search(/<section\b[^>]*\bid=["']recall["'][^>]*>/i);
  if (start < 0) return -1;
  const tags = /<\/?section\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 0;
  for (let match; (match = tags.exec(html));) {
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (depth === 0) return tags.lastIndex;
  }
  throw new Error('Unclosed recall section');
}

function staticLinks(config, prefix) {
  if (!config.families?.length) return '<p>차종을 선택하면 공식 신고 기록과 리콜 정보를 연결합니다.</p>';
  return config.families.map((family, index) => {
    const label = config.kind === 'pair' ? `${index ? 'B' : 'A'} ${family.name}` : family.name;
    const query = `family=${encodeURIComponent(family.family_id)}`;
    return `<div class="vehicle-official-issues-row"><h3>${escape(label)}</h3><p>차종 전체의 공개 신고 기록을 확인합니다. 현재 선택한 세대의 고장률을 뜻하지 않습니다.</p><nav class="vehicle-official-issues-links" aria-label="${escape(label)} 공식 정보"><a href="${prefix}recalls/?tab=reports&amp;${query}">공식 신고 현황</a><a href="${prefix}recalls/?tab=recalls&amp;${query}">리콜</a><a href="${prefix}recalls/?tab=free-repairs&amp;${query}">무상수리</a></nav></div>`;
  }).join('');
}

export function patchOfficialIssuesHtml(original, config, prefix) {
  let html = stripBlock(stripBlock(original, markers.section), markers.runtime);
  // Vehicle components use the shared base stylesheet. Remove an older
  // feature-owned recall-page stylesheet without adding another page skin.
  html = html.replace(/<link\b[^>]*href=["'][^"']*assets\/recalls\.css(?:\?[^"']*)?["'][^>]*data-official-issues-style[^>]*>/gi, '');
  if (!config) return html;
  if (!['static', 'family', 'custom', 'pair'].includes(config.kind)) throw new Error('Unsupported official issues page');
  if ((config.families || []).some(family => !family.family_id || !family.name)) throw new Error('Missing reviewed family identity');
  const section = `${markers.section[0]}<section id="vehicle-issues" class="vehicle-official-issues db-section" aria-labelledby="vehicle-issues-title"><div class="db-shell"><h2 id="vehicle-issues-title">공식 신고·리콜</h2><div class="vehicle-official-issues-content" aria-live="polite">${staticLinks(config, prefix)}</div><p class="vehicle-official-issues-note">신고는 접수 기록이며 확정 결함이나 고장률이 아닙니다.</p></div></section>${markers.section[1]}`;
  const insertion = config.kind === 'static' ? afterRecall(html) : -1;
  if (insertion >= 0) html = html.slice(0, insertion) + section + html.slice(insertion);
  else if (/<\/main>/i.test(html)) html = html.replace(/<\/main>/i, section + '</main>');
  else throw new Error('Official issues page has no main element');
  const runtime = `${markers.runtime[0]}<script type="application/json" id="official-issues-config">${json(config)}</script><script defer src="${prefix}assets/vehicle-official-issues.js"></script>${markers.runtime[1]}`;
  if (!/<\/body>/i.test(html)) throw new Error('Official issues page has no body element');
  html = html.replace(/<\/body>/i, runtime + '</body>');
  return html;
}

export function configForPage(relative, html, reviewedPages, knownFamilies) {
  const cleanPath = value => String(value || '').replace(/^\.\//, '').replace(/^\/+/, '');
  const pageByPath = new Map(reviewedPages.map(page => [cleanPath(page.path), page]));
  const family = id => {
    const found = knownFamilies.get(id);
    return found ? {family_id: id, name: found.family_name || found.name || id} : null;
  };
  if (relative === 'cars/family/index.html') return {kind:'family'};
  if (relative === 'compare/index.html') {
    return {kind:'custom', reviewed_paths: Object.fromEntries(reviewedPages.map(page => [cleanPath(page.path), page.family_id]))};
  }
  if (relative.startsWith('cars/')) {
    // Sub-pages of a reviewed detail inherit only its reviewed family, never a guessed generation.
    const page = reviewedPages.slice().sort((a,b) => b.path.length - a.path.length).find(page => relative.startsWith(cleanPath(page.path)));
    const found = page && family(page.family_id);
    return found ? {kind:'static', families:[found]} : null;
  }
  if (!relative.startsWith('compare/') || /http-equiv=["']refresh["']/i.test(html)) return null;
  const payload = html.match(/<script\b[^>]*\bid=["']decision-data["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!payload) return null;
  let parsed;
  try { parsed = JSON.parse(payload); } catch { return null; }
  const pair = parsed.kind === 'compare' && parsed.pairs?.length === 1 ? parsed.pairs[0] : null;
  if (!pair) return null;
  const sides = [pair.left, pair.right].map(side => pageByPath.get(cleanPath(side?.path))?.family_id).map(family);
  return sides.every(Boolean) ? {kind:'pair', families:sides} : null;
}

export function patchOfficialIssuesPages(siteRoot = root) {
  const pages = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/static-model-pages.json'), 'utf8')).records;
  const hierarchy = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/generated/service-hierarchy.json'), 'utf8'));
  const families = new Map(hierarchy.families.map(family => [family.family_id, family]));
  for (const page of pages) if (!families.has(page.family_id)) throw new Error(`Unverified static family: ${page.family_id}`);
  const counts = {static:0, family:0, custom:0, pair:0, navigation:0, changed:0};
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!['scripts', 'data', 'assets'].includes(entry.name)) walk(file); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const relative = path.relative(siteRoot, file).split(path.sep).join('/');
      const original = fs.readFileSync(file, 'utf8');
      const config = configForPage(relative, original, pages, families);
      const prefix = '../'.repeat(relative.split('/').length - 1);
      let html = config ? patchOfficialIssuesHtml(original, config, prefix) : original;
      if (config) counts[config.kind]++;
      // Limit the label change to primary navigation; vehicle-specific recall anchors remain unchanged.
      html = html.replace(/<nav\b[^>]*class=["'][^"']*\bdb-nav\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi, nav => nav.replace(/>리콜<\/a>/g, () => { counts.navigation++; return '>리콜·신고</a>'; }));
      if (html !== original) { fs.writeFileSync(file, html); counts.changed++; }
    }
  }
  walk(siteRoot);
  return counts;
}

export function patchOfficialIssuesLinks({root: siteRoot = root} = {}) {
  return patchOfficialIssuesPages(path.resolve(siteRoot));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const target = process.argv.slice(2).find(argument => argument.startsWith('--root='))?.slice('--root='.length);
  console.log('Official issue links patched:', JSON.stringify(patchOfficialIssuesLinks(target ? {root:target} : {})));
}
