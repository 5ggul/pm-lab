import fs from 'node:fs';
import path from 'node:path';

// Port the reviewed PR #195 fixes and the follow-up containment repairs.
// Only the two shared preview assets may be written. Importing is side-effect free.
export const OLD_READER = "const value=(form,name)=>{const raw=form.elements[name]?.value;if(raw===''||raw==null)return 0;const n=Number(raw);return Number.isFinite(n)?Math.max(0,n):0};";
export const NEW_READER = "const value=(root,name)=>{const field=root?.elements?.namedItem?.(name)??Array.from(root?.querySelectorAll('input,select,textarea')??[]).find(el=>el.name===name);const raw=field?.value;if(raw===''||raw==null)return 0;const n=Number(raw);return Number.isFinite(n)?Math.max(0,n):0};";
export const START = '/* v11.52 browser regression fixes: start */';
export const END = '/* v11.52 browser regression fixes: end */';
export const FIX_CSS = `${START}
body.v52-release-candidate .formula {
  background: #0d130f !important;
  color: #edf4ec !important;
  border-left-color: #c8ff3d !important;
}
body.v52-release-candidate .v25-bar > span,
body.v52-release-candidate .report-grid strong,
body.v52-release-candidate .v26-area-row > span {
  min-width: 0;
  max-width: 100%;
  white-space: normal;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
@media (min-width: 761px) {
  body.v52-release-candidate .v41-home-copy .v25-rail {
    display: grid !important;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    overflow: visible !important;
  }
  body.v52-release-candidate .v41-home-copy .v25-rail > div {
    min-width: 0 !important;
    padding: 12px 10px !important;
  }
  body.v52-release-candidate .v41-home-copy .v25-rail strong {
    min-width: 0;
    max-width: 100%;
    font-size: clamp(13px, 1.15vw, 18px) !important;
    letter-spacing: -.03em;
    white-space: nowrap;
  }
}
@media (max-width: 760px) {
  body.v44-v42-refined .v41-home-copy .v25-head h1.v44-home-title {
    width: auto !important;
    max-width: 100% !important;
    white-space: normal !important;
    text-wrap: balance !important;
    word-break: keep-all;
    overflow-wrap: break-word !important;
    font-size: clamp(28px, 8vw, 36px) !important;
    line-height: 1.2 !important;
    letter-spacing: -.045em !important;
  }
  body.v52-release-candidate .v25-bar > span,
  body.v52-release-candidate .report-grid strong,
  body.v52-release-candidate .v26-area-row > span {
    line-height: 1.35;
  }
}
${END}`;
const count = (text, needle) => text.split(needle).length - 1;

function readAssets(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) {
    throw new Error('An explicit absolute preview root is required.');
  }
  const appPath = path.join(root, 'assets/app.js');
  const cssPath = path.join(root, 'assets/site.css');
  return {root, appPath, cssPath, app: fs.readFileSync(appPath, 'utf8'), css: fs.readFileSync(cssPath, 'utf8')};
}

function inspect({app, css}) {
  const oldCount = count(app, OLD_READER), newCount = count(app, NEW_READER);
  if (oldCount + newCount !== 1) throw new Error('Expected exactly one known calculator input reader.');
  const starts = count(css, START), ends = count(css, END);
  if (starts !== ends || starts > 1 || (starts === 1 && css.indexOf(END) < css.indexOf(START))) {
    throw new Error('Incomplete, duplicate or reversed CSS patch markers.');
  }
  return {oldCount, newCount, starts};
}

export function validateBrowserRegressionAssets(root) {
  const assets = readAssets(root);
  const state = inspect(assets);
  if (state.oldCount !== 0 || state.newCount !== 1) throw new Error('Legacy calculator reader remains.');
  if (state.starts !== 1 || !assets.css.includes(FIX_CSS)) throw new Error('Reviewed browser CSS fix is missing or changed.');
  return {calculatorReader: true, mobileTitle: true, formulaContrast: true, desktopFreshnessRail: true, categoryLabelWrap: true};
}

export function applyBrowserRegressionFix(root) {
  const assets = readAssets(root);
  const {starts} = inspect(assets); // Validate BOTH files before making any write.
  const {app, css, appPath, cssPath} = assets;
  const nextApp = app.replace(OLD_READER, NEW_READER);
  const nextCSS = starts === 0
    ? css.trimEnd() + '\n\n' + FIX_CSS + '\n'
    : css.slice(0, css.indexOf(START)) + FIX_CSS + css.slice(css.indexOf(END) + END.length);
  const changedFiles = [];
  for (const [file, before, after] of [[appPath, app, nextApp], [cssPath, css, nextCSS]]) {
    if (before !== after) {
      fs.writeFileSync(file, after);
      changedFiles.push(path.relative(root, file).split(path.sep).join('/'));
    }
  }
  validateBrowserRegressionAssets(root);
  return {patch: 'v11.52-browser-regressions', changedFiles, productionDeploy: false, indexPolicyChanged: false};
}
