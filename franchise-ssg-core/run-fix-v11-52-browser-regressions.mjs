import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Final, idempotent RC patch. Only shared assets are changed; never HTML,
// official data, candidate membership, robots, sitemap or production settings.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.SSG_BROWSER_FIX_ROOT || path.join(here, '../docs/franchise-ssg-preview'));
const appPath = path.join(root, 'assets/app.js');
const cssPath = path.join(root, 'assets/site.css');
const oldReader = "const value=(form,name)=>{const raw=form.elements[name]?.value;if(raw===''||raw==null)return 0;const n=Number(raw);return Number.isFinite(n)?Math.max(0,n):0};";
const newReader = "const value=(root,name)=>{const field=root?.elements?.namedItem?.(name)??Array.from(root?.querySelectorAll('input,select,textarea')??[]).find(el=>el.name===name);const raw=field?.value;if(raw===''||raw==null)return 0;const n=Number(raw);return Number.isFinite(n)?Math.max(0,n):0};";
const start = '/* v11.52 browser regression fixes: start */';
const end = '/* v11.52 browser regression fixes: end */';
const mobileCSS = `${start}
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
}
${end}`;
const app = fs.readFileSync(appPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
if (!app.includes(oldReader) && !app.includes(newReader)) throw new Error('Unknown calculator input reader. Refuse to rewrite an unexpected version.');
if (app.includes(oldReader) && app.split(oldReader).length !== 2) throw new Error('Multiple legacy readers found.');
const a = css.indexOf(start), b = css.indexOf(end);
if ((a < 0) !== (b < 0) || (a >= 0 && b < a)) throw new Error('Incomplete CSS patch markers.');
const nextApp = app.replace(oldReader, newReader);
const nextCSS = a < 0 ? css.trimEnd() + '\n\n' + mobileCSS + '\n' : css.slice(0,a) + mobileCSS + css.slice(b+end.length);
const changedFiles = [];
for (const [file, before, after] of [[appPath,app,nextApp],[cssPath,css,nextCSS]]) {
  if (before !== after) { fs.writeFileSync(file, after); changedFiles.push(path.relative(root,file)); }
}
console.log(JSON.stringify({patch:'v11.52-browser-regressions',changedFiles,productionDeploy:false,indexPolicyChanged:false}));
